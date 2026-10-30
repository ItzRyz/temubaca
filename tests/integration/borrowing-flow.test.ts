import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

import { loanGroup } from "../../src/features/borrowing/lifecycle";
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
const LISTING = id(200), SECOND_LISTING = id(201), THIRD_LISTING = id(202);

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
        { id: THIRD_LISTING, ownerId: OWNER, bookId: BOOK, condition: "GOOD", publicLocation: "Taman Suropati", borrowingRules: "Lama pinjam: 7 hari." },
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

        // Each side sees who acted relative to themselves.
        const [ownerView] = (await borrowing.listLoansForUser(OWNER)).filter((item) => item.requestId === requestId);
        expect(ownerView.events.map((event) => event.by)).toEqual(["other", "you", "you", "other", "system", "other", "you", "system"]);
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

        await borrowing.resolveBorrowingDispute(loan.borrowingId!, ADMIN, { outcome: "LOST", note: "Kedua pihak sepakat buku tidak dapat dipakai.", consequence: { type: "WARNING", party: "REQUESTER" } });
        expect(await listingAvailability(SECOND_LISTING)).toBe("UNAVAILABLE");
        await expect(borrowing.resolveBorrowingDispute(loan.borrowingId!, ADMIN, { outcome: "RETURNED", note: "Ulang", consequence: { type: "NONE" } })).rejects.toThrow("sudah diputuskan");

        const [dispute] = await borrowing.listBorrowingDisputes();
        expect(dispute.status).toBe("LOST");
        expect(dispute.reportedByOwner).toBe(true);
        const audit = await testDb.query.adminAuditLogs.findMany({ where: eq(schema.adminAuditLogs.targetId, loan.borrowingId!) });
        expect(audit.map((entry) => entry.action)).toEqual(["BORROWING_DISPUTE_RESOLVED"]);
    });
});

describe("loan extension", () => {
    test("the reader asks once; accepting moves the due date", async () => {
        const { id: requestId } = await ask(READER, { listingId: THIRD_LISTING, loanDays: 7 });
        await borrowing.actOnBorrowRequest(requestId, OWNER, { action: "approve" });
        await borrowing.actOnBorrowRequest(requestId, OWNER, { action: "confirm_handover" });
        await borrowing.actOnBorrowRequest(requestId, READER, { action: "confirm_handover" });
        const [loan] = (await borrowing.listLoansForUser(OWNER)).filter((item) => item.requestId === requestId);
        const borrowingId = loan.borrowingId!;

        await expect(borrowing.actOnBorrowing(borrowingId, OWNER, { action: "request_extension", days: 7, note: undefined })).rejects.toThrow("Hanya peminjam");
        await expect(borrowing.actOnBorrowing(borrowingId, OWNER, { action: "approve_extension" })).rejects.toThrow("Tidak ada permintaan");
        await borrowing.actOnBorrowing(borrowingId, READER, { action: "request_extension", days: 7, note: "Belum selesai dibaca." });
        await expect(borrowing.actOnBorrowing(borrowingId, READER, { action: "request_extension", days: 7, note: undefined })).rejects.toThrow("menunggu jawaban");
        await expect(borrowing.actOnBorrowing(borrowingId, READER, { action: "approve_extension" })).rejects.toThrow("Hanya pemilik");

        const [pending] = (await borrowing.listLoansForUser(OWNER)).filter((item) => item.requestId === requestId);
        expect(pending.extension).toEqual({ status: "PENDING", days: 7, note: "Belum selesai dibaca.", responseNote: null });
        const result = await borrowing.actOnBorrowing(borrowingId, OWNER, { action: "approve_extension" });
        expect(result.extensionStatus).toBe("APPROVED");

        const [after] = (await borrowing.listLoansForUser(READER)).filter((item) => item.requestId === requestId);
        expect(after.dueAt!.getTime() - loan.dueAt!.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
        await expect(borrowing.actOnBorrowing(borrowingId, READER, { action: "request_extension", days: 7, note: undefined })).rejects.toThrow("satu kali");
        expect((await borrowing.listBorrowEvents(requestId)).map((event) => event.type).slice(-2)).toEqual(["EXTENSION_REQUESTED", "EXTENSION_APPROVED"]);
    });

    test("a declined extension keeps the due date and cannot be asked again", async () => {
        const [loan] = (await borrowing.listLoansForUser(READER)).filter((item) => item.listingId === THIRD_LISTING);
        await borrowing.actOnBorrowing(loan.borrowingId!, READER, { action: "confirm_return" });
        await borrowing.actOnBorrowing(loan.borrowingId!, OWNER, { action: "confirm_return" });

        const { id: requestId } = await ask(OTHER_READER, { listingId: THIRD_LISTING, loanDays: 7 });
        await borrowing.actOnBorrowRequest(requestId, OWNER, { action: "approve" });
        await borrowing.actOnBorrowRequest(requestId, OWNER, { action: "confirm_handover" });
        await borrowing.actOnBorrowRequest(requestId, OTHER_READER, { action: "confirm_handover" });
        const [active] = (await borrowing.listLoansForUser(OTHER_READER)).filter((item) => item.requestId === requestId);

        await borrowing.actOnBorrowing(active.borrowingId!, OTHER_READER, { action: "request_extension", days: 14, note: undefined });
        await borrowing.actOnBorrowing(active.borrowingId!, OWNER, { action: "reject_extension", note: "Bukunya akan saya pakai." });
        const [after] = (await borrowing.listLoansForUser(OTHER_READER)).filter((item) => item.requestId === requestId);
        expect(after.dueAt!.getTime()).toBe(active.dueAt!.getTime());
        expect(after.extension?.status).toBe("REJECTED");
        expect(after.extension?.responseNote).toBe("Bukunya akan saya pakai.");
        await expect(borrowing.actOnBorrowing(active.borrowingId!, OTHER_READER, { action: "request_extension", days: 7, note: undefined })).rejects.toThrow("satu kali");
    });
});

describe("admin overview", () => {
    test("open-loan counts match the states the loan list derives", async () => {
        for (const now of [new Date(), new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)]) {
            const loans = await borrowing.listLoansForUser(OWNER, now);
            const count = (state: string) => loans.filter((loan) => loan.state === state).length;
            expect(await borrowing.countOpenLoans(now)).toEqual({
                pending: count("PENDING"),
                awaitingHandover: count("AWAITING_HANDOVER"),
                active: count("ACTIVE"),
                overdue: count("OVERDUE"),
                disputed: count("DISPUTED"),
                extensionPending: loans.filter((loan) => loan.extension?.status === "PENDING" && (loan.state === "ACTIVE" || loan.state === "OVERDUE")).length,
            });
            for (const userId of [OWNER, READER, OTHER_READER]) {
                const mine = await borrowing.listLoansForUser(userId, now);
                expect(await borrowing.countLoansNeedingAction(userId, now)).toBe(mine.filter((loan) => loanGroup(loan.snapshot, loan.role, now) === "action").length);
            }
        }
    });
});

describe("dispute follow-up and consequences", () => {
    const FOURTH_LISTING = id(203), FIFTH_LISTING = id(204);
    const disputeOn = async (listingId: string, requesterId: string) => {
        const { id: requestId } = await ask(requesterId, { listingId, loanDays: 7 });
        await borrowing.actOnBorrowRequest(requestId, OWNER, { action: "approve" });
        await borrowing.actOnBorrowRequest(requestId, OWNER, { action: "confirm_handover" });
        await borrowing.actOnBorrowRequest(requestId, requesterId, { action: "confirm_handover" });
        const [loan] = (await borrowing.listLoansForUser(requesterId)).filter((item) => item.requestId === requestId);
        await borrowing.actOnBorrowing(loan.borrowingId!, OWNER, { action: "report_problem", reason: "Buku tidak dikembalikan", details: "Sudah dua minggu tidak ada kabar." });
        return loan.borrowingId!;
    };
    const loanOf = async (userId: string, borrowingId: string) =>
        (await borrowing.listLoansForUser(userId)).find((item) => item.borrowingId === borrowingId)!;

    beforeAll(async () => {
        await testDb.insert(schema.bookListings).values([
            { id: FOURTH_LISTING, ownerId: OWNER, bookId: BOOK, condition: "GOOD", publicLocation: "Taman Suropati", borrowingRules: "Lama pinjam: 7 hari.\nJaminan: Tunjukkan kartu pelajar" },
            { id: FIFTH_LISTING, ownerId: OWNER, bookId: BOOK, condition: "GOOD", publicLocation: "Taman Suropati", borrowingRules: "Lama pinjam: 7 hari." },
        ]);
    });

    test("an admin question needs the asked party's answer; the request keeps the guarantee", async () => {
        const borrowingId = await disputeOn(FOURTH_LISTING, STRANGER);
        const loan = await loanOf(STRANGER, borrowingId);
        const [request] = await testDb.select({ guarantee: schema.borrowRequests.guarantee }).from(schema.borrowRequests).where(eq(schema.borrowRequests.id, loan.requestId));
        expect(request.guarantee).toBe("Tunjukkan kartu pelajar");

        await borrowing.askDisputeParty(borrowingId, ADMIN, { party: "REQUESTER", question: "Kapan Anda terakhir memegang buku ini?" });
        expect(loanGroup((await loanOf(STRANGER, borrowingId)).snapshot, "requester")).toBe("action");
        expect(loanGroup((await loanOf(OWNER, borrowingId)).snapshot, "owner")).toBe("ongoing");
        expect(await borrowing.countLoansNeedingAction(STRANGER)).toBeGreaterThan(0);

        await borrowing.actOnBorrowing(borrowingId, STRANGER, { action: "add_dispute_info", details: "Terakhir saya bawa di KRL hari Senin." });
        const answered = await loanOf(STRANGER, borrowingId);
        expect(loanGroup(answered.snapshot, "requester")).toBe("ongoing");
        expect(answered.events.map((event) => event.type)).toEqual(expect.arrayContaining(["DISPUTE_INFO_REQUESTED", "DISPUTE_INFO_ADDED"]));

        await borrowing.resolveBorrowingDispute(borrowingId, ADMIN, { outcome: "LOST", note: "Peminjam tidak mengembalikan buku.", consequence: { type: "BORROW_BLOCK", party: "REQUESTER", days: 30 } });
        await expect(ask(STRANGER, { listingId: FIFTH_LISTING, loanDays: 7 })).rejects.toThrow("belum dapat mengajukan pinjam");
        await expect(borrowing.actOnBorrowing(borrowingId, STRANGER, { action: "add_dispute_info", details: "Saya keberatan dengan keputusan." })).rejects.toThrow("selama sengketa");
    });

    test("a suspension applies to the chosen party, never to an admin", async () => {
        const borrowingId = await disputeOn(FIFTH_LISTING, OTHER_READER);
        await testDb.update(schema.userProfiles).set({ role: "ADMIN" }).where(eq(schema.userProfiles.id, OTHER_READER));
        await expect(borrowing.resolveBorrowingDispute(borrowingId, ADMIN, { outcome: "RETURNED", note: "Buku sudah kembali.", consequence: { type: "SUSPENSION", party: "REQUESTER" } })).rejects.toThrow("admin");
        await testDb.update(schema.userProfiles).set({ role: "MEMBER" }).where(eq(schema.userProfiles.id, OTHER_READER));

        await borrowing.resolveBorrowingDispute(borrowingId, ADMIN, { outcome: "RETURNED", note: "Buku kembali setelah ditegur.", consequence: { type: "SUSPENSION", party: "REQUESTER" } });
        const profile = await testDb.query.userProfiles.findFirst({ where: eq(schema.userProfiles.id, OTHER_READER) });
        expect(profile?.suspendedAt).not.toBeNull();
        const audit = await testDb.select().from(schema.adminAuditLogs).where(eq(schema.adminAuditLogs.targetId, OTHER_READER));
        expect(audit.map((row) => row.action)).toContain("USER_SUSPENDED");
        const [row] = await testDb.select().from(schema.borrowings).where(eq(schema.borrowings.id, borrowingId));
        expect([row.consequence, row.consequenceUserId]).toEqual(["SUSPENSION", OTHER_READER]);
    });
});
