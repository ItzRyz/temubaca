import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../../src/lib/db/schema";

// A community's book collection (30 Okt 2026): any manager lends it, against every migration.
const pg = new PGlite();
const testDb = drizzle({ client: pg, schema });
mock.module("server-only", () => ({}));
mock.module(resolve(import.meta.dir, "../../src/lib/db/client.ts"), () => ({ db: testDb }));

setDefaultTimeout(60_000);

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const FOUNDER = id(1), MANAGER = id(2), READER = id(3), STRANGER = id(4), ADMIN = id(5);
const COMMUNITY = id(10), BOOK = id(100);
const SHARED = id(200), SECOND = id(201), PERSONAL = id(202);

let books: typeof import("../../src/lib/db/queries/books");
let borrowing: typeof import("../../src/lib/db/queries/borrowing");

beforeAll(async () => {
    const files = (await readdir("drizzle/migrations")).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
        const sql = await readFile(`drizzle/migrations/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await pg.exec(statement);
    }
    await testDb.insert(schema.userProfiles).values([
        { id: FOUNDER, displayName: "Pendiri" },
        { id: MANAGER, displayName: "Pengurus" },
        { id: READER, displayName: "Pembaca" },
        { id: STRANGER, displayName: "Orang Lain" },
        { id: ADMIN, displayName: "Admin", role: "ADMIN" },
    ]);
    await testDb.insert(schema.communities).values({ id: COMMUNITY, ownerId: FOUNDER, name: "Klub Baca Taman", status: "VERIFIED" });
    await testDb.insert(schema.communityMemberships).values({ communityId: COMMUNITY, userId: MANAGER, role: "MANAGER", status: "ACTIVE" });
    await testDb.insert(schema.books).values({ id: BOOK, provider: "MANUAL", providerId: "cc-1", title: "Bumi Manusia", authors: ["Pramoedya Ananta Toer"] });
    // The manager added the community's copies; one copy is the manager's own.
    await testDb.insert(schema.bookListings).values([
        { id: SHARED, ownerId: MANAGER, communityId: COMMUNITY, bookId: BOOK, condition: "GOOD", publicLocation: "Taman Suropati" },
        { id: SECOND, ownerId: MANAGER, communityId: COMMUNITY, bookId: BOOK, condition: "FAIR", publicLocation: "Taman Suropati" },
        { id: PERSONAL, ownerId: MANAGER, bookId: BOOK, condition: "GOOD", publicLocation: "Taman Menteng" },
    ]);
    books = await import("../../src/lib/db/queries/books");
    borrowing = await import("../../src/lib/db/queries/borrowing");
});

afterAll(async () => {
    await pg.close();
});

const ask = (requesterId: string, listingId: string) =>
    borrowing.createBorrowRequest(requesterId, { listingId, loanDays: 14, meetingPoint: "Taman Suropati", agreed: true } as never);

describe("community collection", () => {
    test("the collection lives with the community, not in the manager's own books", async () => {
        expect((await books.listUserBookListings(MANAGER)).map((listing) => listing.id)).toEqual([PERSONAL]);
        expect((await books.listCommunityBookListings(COMMUNITY)).map((listing) => listing.id).sort()).toEqual([SHARED, SECOND].sort());
        const onBookPage = await books.listBookListings(BOOK);
        expect(onBookPage.find((listing) => listing.id === SHARED)?.community?.name).toBe("Klub Baca Taman");
    });

    test("every manager edits the collection; others cannot", async () => {
        expect(await books.updateBookListing(SHARED, FOUNDER, { borrowingRules: "Maksimal 14 hari." })).not.toBeNull();
        expect(await books.updateBookListing(SHARED, STRANGER, { borrowingRules: "Diubah orang lain." })).toBeNull();
        expect(await books.updateBookListing(PERSONAL, FOUNDER, { borrowingRules: "Bukan milik pendiri." })).toBeNull();
    });

    test("managers cannot borrow from their own community", async () => {
        await expect(ask(FOUNDER, SHARED)).rejects.toThrow("koleksi komunitasnya sendiri");
        await expect(ask(MANAGER, SHARED)).rejects.toThrow("koleksi komunitasnya sendiri");
    });

    test("a reader borrows; any manager handles the loan for the community", async () => {
        const { id: requestId } = await ask(READER, SHARED);
        await expect(borrowing.actOnBorrowRequest(requestId, STRANGER, { action: "approve" })).rejects.toThrow("tidak ditemukan");
        expect(await borrowing.countCommunityLoansNeedingAction(FOUNDER)).toEqual(new Map([[COMMUNITY, 1]]));
        // The request is the community's, not the personal "Pinjam & pinjamkan" of whoever added the copy.
        expect(await borrowing.countLoansNeedingAction(MANAGER)).toBe(0);
        expect(await books.listingsNeedAttention(MANAGER)).toBe(false);

        expect((await borrowing.actOnBorrowRequest(requestId, FOUNDER, { action: "approve" })).status).toBe("APPROVED");
        await borrowing.actOnBorrowRequest(requestId, MANAGER, { action: "confirm_handover" });
        expect((await borrowing.actOnBorrowRequest(requestId, READER, { action: "confirm_handover" })).status).toBe("ACTIVE");

        const [asReader] = await borrowing.listLoansForUser(READER);
        expect([asReader.role, asReader.otherParty.displayName]).toEqual(["requester", "Klub Baca Taman"]);
        const [asCommunity] = await borrowing.listLoansForCommunity(COMMUNITY, FOUNDER);
        expect([asCommunity.role, asCommunity.otherParty.displayName]).toEqual(["owner", "Pembaca"]);
        // The other manager's handover reads as the community's own step, not the borrower's.
        expect(asCommunity.events.find((event) => event.type === "HANDOVER_CONFIRMED" && event.by !== "other")?.by).toBe("you");
        expect(await borrowing.listLoansForUser(MANAGER)).toEqual([]);
    });

    test("an owner-side dispute consequence falls on the manager who last handled the loan", async () => {
        const { id: requestId } = await ask(READER, SECOND);
        await borrowing.actOnBorrowRequest(requestId, FOUNDER, { action: "approve" });
        await borrowing.actOnBorrowRequest(requestId, READER, { action: "confirm_handover" });
        await borrowing.actOnBorrowRequest(requestId, MANAGER, { action: "confirm_handover" });
        const [loan] = (await borrowing.listLoansForCommunity(COMMUNITY, FOUNDER)).filter((item) => item.requestId === requestId);
        await borrowing.actOnBorrowing(loan.borrowingId!, READER, { action: "report_problem", reason: "Buku tidak sesuai", details: "Halaman hilang saat diterima." });

        await borrowing.resolveBorrowingDispute(loan.borrowingId!, ADMIN, { outcome: "RETURNED", note: "Pengurus menyerahkan buku rusak.", consequence: { type: "BORROW_BLOCK", party: "OWNER", days: 14 } });
        const [manager] = await testDb.select({ until: schema.userProfiles.borrowBlockedUntil }).from(schema.userProfiles).where(eq(schema.userProfiles.id, MANAGER));
        const [founder] = await testDb.select({ until: schema.userProfiles.borrowBlockedUntil }).from(schema.userProfiles).where(eq(schema.userProfiles.id, FOUNDER));
        expect(manager.until).not.toBeNull();
        expect(founder.until).toBeNull();
        const [dispute] = await borrowing.listBorrowingDisputes();
        expect([dispute.communityName, dispute.consequenceToOwner, dispute.reportedByOwner]).toEqual(["Klub Baca Taman", true, false]);
    });

    test("a suspended community's collection leaves public pages and cannot be borrowed", async () => {
        await testDb.update(schema.communities).set({ status: "SUSPENDED" }).where(eq(schema.communities.id, COMMUNITY));
        expect((await books.listBookListings(BOOK)).map((listing) => listing.id)).toEqual([PERSONAL]);
        expect(await books.listPublicCommunityBookListings(COMMUNITY)).toEqual([]);
        await expect(ask(STRANGER, SHARED)).rejects.toThrow("tidak ditemukan");
        // Its managers no longer act for it either.
        expect(await books.updateBookListing(SHARED, FOUNDER, { borrowingRules: "Ditangguhkan." })).toBeNull();
        await testDb.update(schema.communities).set({ status: "VERIFIED" }).where(eq(schema.communities.id, COMMUNITY));
    });
});
