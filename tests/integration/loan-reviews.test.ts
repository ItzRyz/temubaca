import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../../src/lib/db/schema";

// Revisions of 30 Okt 2026: return reviews, the borrower profile, "kabar baru", meeting time, and "Dipesan".
const pg = new PGlite();
const testDb = drizzle({ client: pg, schema });
mock.module("server-only", () => ({}));
mock.module(resolve(import.meta.dir, "../../src/lib/db/client.ts"), () => ({ db: testDb }));

setDefaultTimeout(60_000);

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OWNER = id(1), READER = id(2), STRANGER = id(3), ADMIN = id(4), OTHER_OWNER = id(5);
const BOOK = id(100), LISTING = id(200), SECOND = id(201), THIRD = id(202);

let borrowing: typeof import("../../src/lib/db/queries/borrowing");
let profiles: typeof import("../../src/lib/db/queries/borrower-profile");
let users: typeof import("../../src/lib/db/queries/users");

beforeAll(async () => {
    const files = (await readdir("drizzle/migrations")).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
        const sql = await readFile(`drizzle/migrations/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await pg.exec(statement);
    }
    await testDb.insert(schema.userProfiles).values([
        { id: OWNER, displayName: "Pemilik" },
        { id: READER, displayName: "Pembaca Setia", regionCode: "31.71" },
        { id: STRANGER, displayName: "Orang Lain" },
        { id: ADMIN, displayName: "Admin", role: "ADMIN" },
        { id: OTHER_OWNER, displayName: "Pemilik Lain" },
    ]);
    await testDb.insert(schema.books).values({ id: BOOK, provider: "MANUAL", providerId: "rv-1", title: "Laskar Pelangi" });
    await testDb.insert(schema.bookListings).values([
        { id: LISTING, ownerId: OWNER, bookId: BOOK, condition: "GOOD", publicLocation: "Taman Suropati" },
        { id: SECOND, ownerId: OWNER, bookId: BOOK, condition: "GOOD", publicLocation: "Taman Suropati" },
        { id: THIRD, ownerId: OTHER_OWNER, bookId: BOOK, condition: "GOOD", publicLocation: "Taman Suropati" },
    ]);
    borrowing = await import("../../src/lib/db/queries/borrowing");
    profiles = await import("../../src/lib/db/queries/borrower-profile");
    users = await import("../../src/lib/db/queries/users");
});

afterAll(async () => {
    await pg.close();
});

const ask = (listingId: string, extra: Record<string, unknown> = {}) =>
    borrowing.createBorrowRequest(READER, { listingId, loanDays: 14, meetingPoint: "Taman Suropati", agreed: true, ...extra } as never);

/** Ask, approve and hand over; returns the borrowing id. */
async function lend(listingId: string, owner = OWNER) {
    const { id: requestId } = await ask(listingId);
    await borrowing.actOnBorrowRequest(requestId, owner, { action: "approve" });
    await borrowing.actOnBorrowRequest(requestId, owner, { action: "confirm_handover" });
    await borrowing.actOnBorrowRequest(requestId, READER, { action: "confirm_handover" });
    const [loan] = (await borrowing.listLoansForUser(READER)).filter((item) => item.requestId === requestId);
    return { requestId, borrowingId: loan.borrowingId! };
}

describe("meeting time and reservation state", () => {
    test("the preferred WIB time is stored and read back; a copy reads as reserved, then lent", async () => {
        const at = new Date(Date.now() + 3 * 86_400_000);
        const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
        const { id: requestId } = await ask(LISTING, { preferredDate: date, preferredClock: "09:30" });
        const [loan] = await borrowing.listLoansForUser(OWNER);
        expect(new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(loan.preferredAt!)).toBe("09.30");

        expect(await borrowing.listingLoanStates([LISTING])).toEqual(new Map());
        await borrowing.actOnBorrowRequest(requestId, OWNER, { action: "approve" });
        expect(await borrowing.listingLoanStates([LISTING])).toEqual(new Map([[LISTING, "AWAITING_HANDOVER"]]));
        await borrowing.actOnBorrowRequest(requestId, OWNER, { action: "confirm_handover" });
        await borrowing.actOnBorrowRequest(requestId, READER, { action: "confirm_handover" });
        expect(await borrowing.listingLoanStates([LISTING])).toEqual(new Map([[LISTING, "BORROWED"]]));
    });
});

describe("review on return", () => {
    test("the borrower cannot review; the owner confirms with a review, once, in one transaction", async () => {
        const [loan] = (await borrowing.listLoansForUser(READER)).filter((item) => item.listingId === LISTING);
        await expect(borrowing.actOnBorrowing(loan.borrowingId!, READER, { action: "confirm_return", review: { rating: 5, comment: undefined } })).rejects.toThrow("Hanya pemilik");
        // Nothing of the refused request was kept.
        expect((await testDb.select().from(schema.borrowings).where(eq(schema.borrowings.id, loan.borrowingId!)))[0].requesterReturnAt).toBeNull();

        await borrowing.actOnBorrowing(loan.borrowingId!, READER, { action: "confirm_return" });
        expect((await borrowing.actOnBorrowing(loan.borrowingId!, OWNER, { action: "confirm_return", review: { rating: 4, comment: "Tepat waktu, buku terawat." } })).status).toBe("RETURNED");
        const reviews = await testDb.select().from(schema.borrowerReviews);
        expect(reviews.map((review) => [review.rating, review.reviewerId, review.requesterId])).toEqual([[4, OWNER, READER]]);
        expect(await borrowing.listingLoanStates([LISTING])).toEqual(new Map());
    });

    test("a second review for the same loan is refused and the confirmation rolls back", async () => {
        const { borrowingId } = await lend(SECOND);
        await testDb.insert(schema.borrowerReviews).values({ borrowingId, requesterId: READER, reviewerId: OWNER, rating: 3 });
        await expect(borrowing.actOnBorrowing(borrowingId, OWNER, { action: "confirm_return", review: { rating: 5, comment: undefined } })).rejects.toThrow("sudah ada");
        const [row] = await testDb.select().from(schema.borrowings).where(eq(schema.borrowings.id, borrowingId));
        expect(row.ownerReturnAt).toBeNull();
        // Confirming without a review still works.
        await borrowing.actOnBorrowing(borrowingId, OWNER, { action: "confirm_return" });
        expect((await borrowing.actOnBorrowing(borrowingId, READER, { action: "confirm_return" })).status).toBe("RETURNED");
    });
});

describe("borrower profile", () => {
    test("only the borrower, admins and lenders who got a request may open it", async () => {
        expect(await profiles.canViewBorrowerProfile({ id: READER, role: "MEMBER" }, READER)).toBe(true);
        expect(await profiles.canViewBorrowerProfile({ id: ADMIN, role: "ADMIN" }, READER)).toBe(true);
        expect(await profiles.canViewBorrowerProfile({ id: OWNER, role: "MEMBER" }, READER)).toBe(true);
        expect(await profiles.canViewBorrowerProfile({ id: STRANGER, role: "MEMBER" }, READER)).toBe(false);
        expect(await profiles.canViewBorrowerProfile({ id: OTHER_OWNER, role: "MEMBER" }, READER)).toBe(false);
    });

    test("returned books count each loan once and leave out running ones; reviews come with their lender", async () => {
        // A loan still running at another owner does not count as returned.
        await lend(THIRD, OTHER_OWNER);
        const data = await profiles.getBorrowerProfile(READER);
        expect(data?.returnedCount).toBe(2);
        expect(data?.returns).toHaveLength(2);
        // Newest first: the review added directly in the previous test, then the one given on return.
        expect(data?.reviews.map((review) => [review.rating, review.reviewer])).toEqual([[3, "Pemilik"], [4, "Pemilik"]]);
        expect(data?.average).toBe(3.5);
        expect(Object.keys(data!.profile)).not.toContain("email");
        expect(await profiles.getBorrowerProfile(id(999))).toBeNull();
    });
});

describe("kabar baru", () => {
    test("answers by someone else light the dot until the reader opens their loans", async () => {
        const before = new Date(Date.now() - 60_000);
        expect(await borrowing.countLoanUpdatesSince(READER, before)).toBeGreaterThan(0); // the reviews above
        await users.markLoansSeen(READER);
        const [{ preferences }] = await testDb.select({ preferences: schema.userProfiles.preferences }).from(schema.userProfiles).where(eq(schema.userProfiles.id, READER));
        const seen = users.loansSeenAt(preferences);
        expect(await borrowing.countLoanUpdatesSince(READER, seen)).toBe(0);

        await new Promise((done) => setTimeout(done, 5));
        const listing = id(203);
        await testDb.insert(schema.bookListings).values({ id: listing, ownerId: OWNER, bookId: BOOK, condition: "GOOD", publicLocation: "Taman Suropati" });
        const { id: requestId } = await ask(listing);
        // The reader's own request is not news to them.
        expect(await borrowing.countLoanUpdatesSince(READER, seen)).toBe(0);
        await borrowing.actOnBorrowRequest(requestId, OWNER, { action: "reject", reason: "Buku sedang tidak tersedia", note: undefined });
        expect(await borrowing.countLoanUpdatesSince(READER, seen)).toBe(1);
    });
});
