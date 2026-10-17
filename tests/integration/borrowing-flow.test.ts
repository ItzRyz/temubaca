import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../../src/lib/db/schema";

// The DEC-02 lifecycle against an in-memory Postgres with every migration applied.
const pg = new PGlite();
const testDb = drizzle({ client: pg, schema });
mock.module("server-only", () => ({}));
mock.module(resolve(import.meta.dir, "../../src/lib/db/client.ts"), () => ({ db: testDb }));

setDefaultTimeout(60_000);

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OWNER = id(1), READER = id(2), OTHER_READER = id(3), STRANGER = id(4), ADMIN = id(5);
const BOOK = id(100);
const LISTING = id(200), SECOND_LISTING = id(201);

let borrowing: typeof import("../../src/lib/db/queries/borrowing");

const listingAvailability = async (listingId: string) =>
    (await testDb.query.bookListings.findFirst({ where: eq(schema.bookListings.id, listingId) }))?.availability;

beforeAll(async () => {
    const files = (await readdir("drizzle/migrations")).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
        const sql = await readFile(`drizzle/migrations/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) {
            await pg.exec(statement);
        }
    }
    await testDb.insert(schema.userProfiles).values([
        { id: OWNER, displayName: "Pemilik" },
        { id: READER, displayName: "Pembaca" },
        { id: OTHER_READER, displayName: "Pembaca Lain" },
        { id: STRANGER, displayName: "Orang Lain" },
        { id: ADMIN, displayName: "Admin", role: "ADMIN" },
    ]);
    await testDb.insert(schema.books).values({ id: BOOK, provider: "MANUAL", providerId: "test-100", title: "Laut Bercerita", authors: ["Leila S. Chudori"] });
    await testDb.insert(schema.bookListings).values([
        { id: LISTING, ownerId: OWNER, bookId: BOOK, condition: "GOOD", publicLocation: "Taman Suropati & TIM Cikini", borrowingRules: "Lama pinjam: 14 hari." },
        { id: SECOND_LISTING, ownerId: OWNER, bookId: BOOK, condition: "GOOD", publicLocation: "Taman Suropati", borrowingRules: "Lama pinjam: 7 hari." },
    ]);
    borrowing = await import("../../src/lib/db/queries/borrowing");
});

afterAll(async () => {
    await pg.close();
});

const ask = (requesterId: string, overrides: Partial<{ listingId: string; loanDays: number; meetingPoint: string }> = {}) =>
    borrowing.createBorrowRequest(requesterId, { listingId: LISTING, loanDays: 14, meetingPoint: "Taman Suropati", agreed: true, ...overrides } as never);

describe("borrow request rules", () => {
    test("rejects own copies, periods over the owner's limit, and unknown meeting points", async () => {
        await expect(ask(OWNER)).rejects.toThrow("milik sendiri");
        await expect(ask(READER, { loanDays: 21 })).rejects.toThrow("maksimal 14 hari");
        await expect(ask(READER, { meetingPoint: "Rumah saya" })).rejects.toThrow("titik temu");
    });

    test("one open request per reader per copy", async () => {
        await ask(READER);
        await expect(ask(READER)).rejects.toThrow("sudah punya permintaan aktif");
    });
});

describe("full lifecycle", () => {
    let requestId: string;
    let otherRequestId: string;

    test("accepting reserves the copy and rejects the other waiting requests", async () => {
        otherRequestId = (await ask(OTHER_READER)).id;
        const [mine] = (await borrowing.listLoansForUser(READER)).filter((loan) => loan.listingId === LISTING);
        requestId = mine.requestId;

        await expect(borrowing.actOnBorrowRequest(requestId, READER, { action: "approve" })).rejects.toThrow("Hanya pemilik");
        await expect(borrowing.actOnBorrowRequest(requestId, STRANGER, { action: "approve" })).rejects.toThrow("tidak ditemukan");

        expect((await borrowing.actOnBorrowRequest(requestId, OWNER, { action: "approve" })).status).toBe("APPROVED");
        expect(await listingAvailability(LISTING)).toBe("RESERVED");
        const [other] = await borrowing.listLoansForUser(OTHER_READER);
        expect(other.state).toBe("REJECTED");
        expect(other.rejectionReason).toBe("Buku sedang tidak tersedia");
        expect(other.requestId).toBe(otherRequestId);
    });

    test("handover starts only after both sides confirm", async () => {
        expect((await borrowing.actOnBorrowRequest(requestId, OWNER, { action: "confirm_handover" })).status).toBe("AWAITING_HANDOVER");
        await expect(borrowing.actOnBorrowRequest(requestId, OWNER, { action: "confirm_handover" })).rejects.toThrow("sudah mengonfirmasi");
        expect((await borrowing.actOnBorrowRequest(requestId, READER, { action: "confirm_handover" })).status).toBe("ACTIVE");

        const [loan] = (await borrowing.listLoansForUser(READER)).filter((item) => item.requestId === requestId);
        expect(loan.state).toBe("ACTIVE");
        expect(loan.dueAt!.getTime() - loan.handedOverAt!.getTime()).toBe(14 * 24 * 60 * 60 * 1000);
        await expect(borrowing.actOnBorrowRequest(requestId, READER, { action: "cancel" })).rejects.toThrow("tidak dapat dibatalkan");
    });

    test("return needs both confirmations and frees the copy", async () => {
        const [loan] = (await borrowing.listLoansForUser(OWNER)).filter((item) => item.requestId === requestId);
        await borrowing.actOnBorrowing(loan.borrowingId!, READER, { action: "confirm_return" });
        expect(await listingAvailability(LISTING)).toBe("RESERVED");
        expect((await borrowing.actOnBorrowing(loan.borrowingId!, OWNER, { action: "confirm_return" })).status).toBe("RETURNED");
        expect(await listingAvailability(LISTING)).toBe("AVAILABLE");

        const history = (await borrowing.listBorrowEvents(requestId)).map((event) => event.type);
        expect(history).toEqual(["REQUESTED", "APPROVED", "HANDOVER_CONFIRMED", "HANDOVER_CONFIRMED", "BORROWING_STARTED", "RETURN_CONFIRMED", "RETURN_CONFIRMED", "RETURNED"]);
    });
});

describe("cancellation and disputes", () => {
    test("cancelling after acceptance frees the copy", async () => {
        const { id: requestId } = await ask(OTHER_READER, { listingId: SECOND_LISTING, loanDays: 7 });
        await borrowing.actOnBorrowRequest(requestId, OWNER, { action: "approve" });
        expect(await listingAvailability(SECOND_LISTING)).toBe("RESERVED");
        await borrowing.actOnBorrowRequest(requestId, OWNER, { action: "cancel" });
        expect(await listingAvailability(SECOND_LISTING)).toBe("AVAILABLE");
        const [loan] = (await borrowing.listLoansForUser(OTHER_READER)).filter((item) => item.requestId === requestId);
        expect(loan.state).toBe("CANCELLED");
        expect(loan.cancelledByOther).toBe(true);
    });

    test("a reported problem locks the loan until an admin settles it", async () => {
        const { id: requestId } = await ask(READER, { listingId: SECOND_LISTING, loanDays: 7 });
        await borrowing.actOnBorrowRequest(requestId, OWNER, { action: "approve" });
        await borrowing.actOnBorrowRequest(requestId, OWNER, { action: "confirm_handover" });
        await borrowing.actOnBorrowRequest(requestId, READER, { action: "confirm_handover" });
        const [loan] = (await borrowing.listLoansForUser(OWNER)).filter((item) => item.requestId === requestId);

        await borrowing.actOnBorrowing(loan.borrowingId!, OWNER, { action: "report_problem", reason: "Buku rusak", details: "Sampul sobek saat dikembalikan." });
        await expect(borrowing.actOnBorrowing(loan.borrowingId!, READER, { action: "confirm_return" })).rejects.toThrow("sedang dipinjam");
        expect(await borrowing.countOpenBorrowingDisputes()).toBe(1);

        await borrowing.resolveBorrowingDispute(loan.borrowingId!, ADMIN, { outcome: "LOST", note: "Kedua pihak sepakat buku tidak dapat dipakai." });
        expect(await listingAvailability(SECOND_LISTING)).toBe("UNAVAILABLE");
        await expect(borrowing.resolveBorrowingDispute(loan.borrowingId!, ADMIN, { outcome: "RETURNED", note: "Ulang" })).rejects.toThrow("sudah diputuskan");

        const [dispute] = await borrowing.listBorrowingDisputes();
        expect(dispute.status).toBe("LOST");
        expect(dispute.reportedByOwner).toBe(true);
        const audit = await testDb.query.adminAuditLogs.findMany({ where: eq(schema.adminAuditLogs.targetId, loan.borrowingId!) });
        expect(audit.map((entry) => entry.action)).toEqual(["BORROWING_DISPUTE_RESOLVED"]);
    });
});
