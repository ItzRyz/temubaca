import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../../src/lib/db/schema";

// DEC-11 deletion and retention against an in-memory Postgres with every migration applied.
const pg = new PGlite();
const testDb = drizzle({ client: pg, schema });
mock.module("server-only", () => ({}));
mock.module(resolve(import.meta.dir, "../../src/lib/db/client.ts"), () => ({ db: testDb }));

setDefaultTimeout(60_000);

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const LEAVER = id(1), BORROWER = id(2), OWNER = id(3), MANAGER = id(4);
const BOOK = id(100);
const LEAVER_LISTING = id(200), LEAVER_LISTING_WITH_HISTORY = id(201), OWNER_LISTING = id(202);
const VERIFIED_COMMUNITY = id(300), PENDING_COMMUNITY = id(301);
const DAY = 24 * 60 * 60 * 1000;

let deletion: typeof import("../../src/lib/db/queries/account-deletion");
let management: typeof import("../../src/lib/db/queries/community-management");
let borrowing: typeof import("../../src/lib/db/queries/borrowing");

beforeAll(async () => {
    const files = (await readdir("drizzle/migrations")).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
        const sql = await readFile(`drizzle/migrations/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) {
            await pg.exec(statement);
        }
    }
    await testDb.insert(schema.userProfiles).values([
        { id: LEAVER, displayName: "Akan Pergi" },
        { id: BORROWER, displayName: "Peminjam" },
        { id: OWNER, displayName: "Pemilik Lain" },
        { id: MANAGER, displayName: "Pengurus" },
    ]);
    await testDb.insert(schema.books).values({ id: BOOK, provider: "MANUAL", providerId: "test-100", title: "Laut Bercerita", authors: ["Leila S. Chudori"] });
    await testDb.insert(schema.bookListings).values([
        { id: LEAVER_LISTING, ownerId: LEAVER, bookId: BOOK, condition: "GOOD", publicLocation: "Taman Suropati" },
        { id: LEAVER_LISTING_WITH_HISTORY, ownerId: LEAVER, bookId: BOOK, condition: "GOOD", publicLocation: "TIM Cikini", borrowingRules: "Lama pinjam: 14 hari." },
        { id: OWNER_LISTING, ownerId: OWNER, bookId: BOOK, condition: "GOOD", borrowingRules: "Lama pinjam: 14 hari." },
    ]);
    await testDb.insert(schema.bookmarks).values({ userId: LEAVER, bookId: BOOK });
    await testDb.insert(schema.userInterests).values({ userId: LEAVER, subject: "Sejarah" });
    await testDb.insert(schema.communities).values([
        { id: VERIFIED_COMMUNITY, ownerId: LEAVER, name: "Klub Terverifikasi", status: "VERIFIED" },
        { id: PENDING_COMMUNITY, ownerId: LEAVER, name: "Klub Menunggu", status: "PENDING" },
    ]);
    await testDb.insert(schema.communityMemberships).values([
        { userId: LEAVER, communityId: VERIFIED_COMMUNITY, role: "OWNER", status: "ACTIVE" },
        { userId: MANAGER, communityId: VERIFIED_COMMUNITY, role: "MANAGER", status: "ACTIVE" },
    ]);
    deletion = await import("../../src/lib/db/queries/account-deletion");
    management = await import("../../src/lib/db/queries/community-management");
    borrowing = await import("../../src/lib/db/queries/borrowing");
});

afterAll(async () => {
    await pg.close();
});

describe("account deletion (DEC-11)", () => {
    let loanRequestId: string;

    test("blocked by an ongoing loan and a verified community", async () => {
        loanRequestId = (await borrowing.createBorrowRequest(BORROWER, { listingId: LEAVER_LISTING_WITH_HISTORY, loanDays: 14, meetingPoint: "TIM Cikini", agreed: true } as never)).id;
        await borrowing.actOnBorrowRequest(loanRequestId, LEAVER, { action: "approve" });
        const overview = await deletion.getDeletionOverview(LEAVER);
        expect(overview).toMatchObject({ bookmarks: 1, interests: 1, listings: 2 });
        expect(overview.blockers).toHaveLength(2);
        await expect(deletion.requestAccountDeletion(LEAVER)).rejects.toThrow("Klub Terverifikasi");
    });

    test("handing over the community and finishing the loan unblocks it", async () => {
        await expect(management.transferCommunityOwnership(VERIFIED_COMMUNITY, LEAVER, BORROWER)).rejects.toThrow("pengurus aktif");
        await management.transferCommunityOwnership(VERIFIED_COMMUNITY, LEAVER, MANAGER);
        expect((await management.getCommunityAccess(MANAGER, VERIFIED_COMMUNITY))?.role).toBe("owner");
        expect((await management.getCommunityAccess(LEAVER, VERIFIED_COMMUNITY))?.role).toBe("manager");
        await borrowing.actOnBorrowRequest(loanRequestId, BORROWER, { action: "cancel" });
        expect((await deletion.getDeletionOverview(LEAVER)).blockers).toEqual([]);
    });

    test("requesting closes waiting requests and can be cancelled", async () => {
        const waiting = await borrowing.createBorrowRequest(LEAVER, { listingId: OWNER_LISTING, loanDays: 14, agreed: true } as never);
        const now = new Date("2026-10-18T00:00:00Z");
        const { scheduledFor } = await deletion.requestAccountDeletion(LEAVER, now);
        expect(scheduledFor.getTime() - now.getTime()).toBe(14 * DAY);
        const [mine] = (await borrowing.listLoansForUser(OWNER)).filter((loan) => loan.requestId === waiting.id);
        expect(mine.state).toBe("CANCELLED");
        expect(await deletion.countPendingDeletions()).toBe(1);

        expect(await deletion.cancelAccountDeletion(LEAVER)).toBe(true);
        expect(await deletion.countPendingDeletions()).toBe(0);
        await deletion.requestAccountDeletion(LEAVER, now);
    });

    test("nothing happens before the grace period ends", async () => {
        expect((await deletion.purgeAccount(LEAVER, new Date("2026-10-25T00:00:00Z"))).status).toBe("skipped");
    });

    test("after 14 days personal data goes and shared history is anonymised", async () => {
        const due = new Date("2026-11-02T00:00:00Z");
        expect((await deletion.listDueDeletions(due)).map((row) => row.id)).toEqual([LEAVER]);
        expect((await deletion.purgeAccount(LEAVER, due)).status).toBe("purged");

        const profile = await testDb.query.userProfiles.findFirst({ where: eq(schema.userProfiles.id, LEAVER) });
        expect(profile).toMatchObject({ displayName: "Akun dihapus", role: "MEMBER" });
        expect(profile?.deletedAt).not.toBeNull();
        expect(await testDb.query.bookmarks.findMany({ where: eq(schema.bookmarks.userId, LEAVER) })).toEqual([]);
        expect(await testDb.query.bookListings.findFirst({ where: eq(schema.bookListings.id, LEAVER_LISTING) })).toBeUndefined();
        const kept = await testDb.query.bookListings.findFirst({ where: eq(schema.bookListings.id, LEAVER_LISTING_WITH_HISTORY) });
        expect(kept).toMatchObject({ availability: "UNAVAILABLE", publicLocation: null });
        expect(kept?.hiddenAt).not.toBeNull();
        expect(await testDb.query.communities.findFirst({ where: eq(schema.communities.id, PENDING_COMMUNITY) })).toBeUndefined();
        expect((await management.getCommunityAccess(LEAVER, VERIFIED_COMMUNITY))?.role).toBeNull();
        const [loan] = (await borrowing.listLoansForUser(BORROWER)).filter((item) => item.requestId === loanRequestId);
        expect(loan.otherParty.displayName).toBe("Akun dihapus");
        expect((await deletion.purgeAccount(LEAVER, due)).status).toBe("skipped");
    });
});

describe("retention (DEC-11)", () => {
    test("erases old report details, audit entries, and finished loans only", async () => {
        const now = new Date("2028-12-01T00:00:00Z");
        const [oldReport] = await testDb.insert(schema.reports).values({ reporterId: BORROWER, targetType: "BOOK", targetId: BOOK, reason: "Informasi keliru", details: "Detail lama", status: "RESOLVED", reviewedAt: new Date("2027-10-01T00:00:00Z") }).returning();
        const [recentReport] = await testDb.insert(schema.reports).values({ reporterId: BORROWER, targetType: "BOOK", targetId: BOOK, reason: "Informasi keliru", details: "Detail baru", status: "RESOLVED", reviewedAt: new Date("2028-11-01T00:00:00Z") }).returning();
        await testDb.insert(schema.adminAuditLogs).values({ action: "SETTINGS_UPDATED", targetType: "OTHER", targetId: BOOK, createdAt: new Date("2026-06-01T00:00:00Z") });

        const result = await deletion.applyRetention(now);
        expect(result.reportDetails).toBe(1);
        expect(result.auditEntries).toBeGreaterThanOrEqual(1);
        expect(result.loans).toBeGreaterThanOrEqual(1);
        expect((await testDb.query.reports.findFirst({ where: eq(schema.reports.id, oldReport.id) }))?.details).toBeNull();
        expect((await testDb.query.reports.findFirst({ where: eq(schema.reports.id, recentReport.id) }))?.details).toBe("Detail baru");
    });
});
