import "server-only";

import { and, count, desc, eq, inArray, isNotNull, isNull, lt, lte, ne, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
    AUDIT_RETENTION_MONTHS,
    deletionBlockerMessages,
    deletionDate,
    DELETED_ACCOUNT_NAME,
    LOAN_HISTORY_RETENTION_MONTHS,
    monthsBefore,
    OWNER_CLOSED_REASON,
    REPORT_DETAILS_RETENTION_MONTHS,
    type DeletionBlockers,
} from "@/features/account-deletion/rules";
import { ConflictError } from "@/lib/api/errors";

import { db } from "../client";
import {
    borrowerReviews,
    adminAuditLogs,
    appSettings,
    bookAccesses,
    bookListings,
    bookmarks,
    books,
    borrowEvents,
    borrowings,
    borrowRequests,
    communities,
    communityMemberships,
    communitySubmissions,
    libraries,
    libraryManagers,
    reports,
    userInterests,
    userProfiles,
} from "../schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = Tx | typeof db;

const RETENTION_KEY = "retention";
const SYSTEM_TARGET_ID = "00000000-0000-0000-0000-000000000000";

/** Loans that keep the account alive: accepted, ongoing, or disputed, on either side (a community's loans belong to the community). */
async function countActiveLoans(executor: Executor, userId: string) {
    const [row] = await executor
        .select({ total: count() })
        .from(borrowRequests)
        .innerJoin(bookListings, eq(bookListings.id, borrowRequests.listingId))
        .leftJoin(borrowings, eq(borrowings.requestId, borrowRequests.id))
        .where(and(
            or(eq(borrowRequests.requesterId, userId), and(eq(bookListings.ownerId, userId), isNull(bookListings.communityId))),
            or(eq(borrowRequests.status, "APPROVED"), inArray(borrowings.status, ["ACTIVE", "OVERDUE", "DISPUTED"])),
        ));
    return row?.total ?? 0;
}

async function findBlockers(executor: Executor, userId: string): Promise<DeletionBlockers> {
    const [activeLoans, owned] = await Promise.all([
        countActiveLoans(executor, userId),
        executor.select({ name: communities.name }).from(communities).where(and(eq(communities.ownerId, userId), eq(communities.status, "VERIFIED"))),
    ]);
    return { activeLoans, verifiedCommunities: owned.map((row) => row.name) };
}

/** What the "Hapus akun dan data?" dialog lists, plus anything that blocks the request. */
export async function getDeletionOverview(userId: string) {
    const [[bookmarkRow], [interestRow], [listingRow], blockers] = await Promise.all([
        db.select({ total: count() }).from(bookmarks).where(eq(bookmarks.userId, userId)),
        db.select({ total: count() }).from(userInterests).where(eq(userInterests.userId, userId)),
        db.select({ total: count() }).from(bookListings).where(eq(bookListings.ownerId, userId)),
        findBlockers(db, userId),
    ]);
    return {
        bookmarks: bookmarkRow?.total ?? 0,
        interests: interestRow?.total ?? 0,
        listings: listingRow?.total ?? 0,
        blockers: deletionBlockerMessages(blockers),
    };
}

/** Starts the 14-day grace period; waiting loan requests are closed so nobody waits on a leaving account. */
export async function requestAccountDeletion(userId: string, now = new Date()) {
    return db.transaction(async (tx) => {
        const [profile] = await tx.select({ deletionRequestedAt: userProfiles.deletionRequestedAt, deletionScheduledFor: userProfiles.deletionScheduledFor })
            .from(userProfiles).where(eq(userProfiles.id, userId)).for("update");
        if (!profile) throw new ConflictError("Akun tidak ditemukan.");
        if (profile.deletionRequestedAt) return { scheduledFor: profile.deletionScheduledFor! };

        const messages = deletionBlockerMessages(await findBlockers(tx, userId));
        if (messages.length > 0) throw new ConflictError(messages.join(" "));

        const ownPending = await tx.update(borrowRequests)
            .set({ status: "CANCELLED", cancelledById: userId, updatedAt: now })
            .where(and(eq(borrowRequests.requesterId, userId), eq(borrowRequests.status, "PENDING")))
            .returning({ id: borrowRequests.id });
        const incoming = await tx.update(borrowRequests)
            .set({ status: "REJECTED", rejectionReason: OWNER_CLOSED_REASON, respondedAt: now, updatedAt: now })
            .where(and(eq(borrowRequests.status, "PENDING"), inArray(borrowRequests.listingId, tx.select({ id: bookListings.id }).from(bookListings).where(and(eq(bookListings.ownerId, userId), isNull(bookListings.communityId))))))
            .returning({ id: borrowRequests.id });
        const events = [
            ...ownPending.map((row) => ({ requestId: row.id, actorId: userId, type: "CANCELLED" as const, note: "Peminjam menutup akunnya." })),
            ...incoming.map((row) => ({ requestId: row.id, actorId: userId, type: "REJECTED" as const, note: OWNER_CLOSED_REASON })),
        ];
        if (events.length > 0) await tx.insert(borrowEvents).values(events);
        // Library requests still open are withdrawn too (TB-023); the libraries see them as cancelled.
        await tx.update(bookAccesses).set({ status: "CANCELLED", updatedAt: now })
            .where(and(eq(bookAccesses.requesterId, userId), inArray(bookAccesses.status, ["PENDING", "APPROVED"])));

        const scheduledFor = deletionDate(now);
        await tx.update(userProfiles).set({ deletionRequestedAt: now, deletionScheduledFor: scheduledFor, updatedAt: now }).where(eq(userProfiles.id, userId));
        return { scheduledFor };
    });
}

export async function cancelAccountDeletion(userId: string) {
    const [profile] = await db.update(userProfiles)
        .set({ deletionRequestedAt: null, deletionScheduledFor: null, updatedAt: new Date() })
        .where(and(eq(userProfiles.id, userId), isNotNull(userProfiles.deletionRequestedAt), isNull(userProfiles.deletedAt)))
        .returning({ id: userProfiles.id });
    return Boolean(profile);
}

/**
 * Anonymises one account whose grace period ended. Returns the storage paths of evidence files
 * that belonged to deleted communities so the caller can remove them after the commit.
 */
export async function purgeAccount(userId: string, now = new Date()) {
    return db.transaction(async (tx) => {
        const [profile] = await tx.select({ deletionScheduledFor: userProfiles.deletionScheduledFor, deletedAt: userProfiles.deletedAt })
            .from(userProfiles).where(eq(userProfiles.id, userId)).for("update");
        if (!profile || profile.deletedAt || !profile.deletionScheduledFor || profile.deletionScheduledFor > now) return { status: "skipped" as const, filePaths: [] };

        const messages = deletionBlockerMessages(await findBlockers(tx, userId));
        if (messages.length > 0) return { status: "blocked" as const, reason: messages.join(" "), filePaths: [] };

        await tx.delete(bookmarks).where(eq(bookmarks.userId, userId));
        await tx.delete(userInterests).where(eq(userInterests.userId, userId));
        // Reviews about this borrower go with the account; reviews they wrote stay without their name (30 Okt 2026).
        await tx.delete(borrowerReviews).where(eq(borrowerReviews.requesterId, userId));
        await tx.update(borrowerReviews).set({ reviewerId: null }).where(eq(borrowerReviews.reviewerId, userId));

        // Copies with loan history stay (hidden, stripped of location and notes) so borrowers keep their record.
        const withHistory = tx.select({ id: borrowRequests.listingId }).from(borrowRequests);
        const personal = and(eq(bookListings.ownerId, userId), isNull(bookListings.communityId));
        await tx.update(bookListings)
            .set({ hiddenAt: now, hiddenReason: "Akun pemilik dihapus", availability: "UNAVAILABLE", publicLocation: null, borrowingRules: null, updatedAt: now })
            .where(and(personal, inArray(bookListings.id, withHistory)));
        await tx.delete(bookListings).where(and(personal, notInArray(bookListings.id, withHistory)));
        await tx.update(borrowRequests).set({ note: null, preferredTime: null }).where(eq(borrowRequests.requesterId, userId));
        await tx.update(bookAccesses).set({ message: null }).where(eq(bookAccesses.requesterId, userId));
        await tx.delete(libraryManagers).where(eq(libraryManagers.userId, userId));

        const owned = await tx.select({ id: communities.id }).from(communities).where(and(eq(communities.ownerId, userId), ne(communities.status, "VERIFIED")));
        const ownedIds = owned.map((row) => row.id);
        if (ownedIds.length > 0) {
            // A collection of a community that goes with the account: loan history stays as hidden copies, the rest goes.
            const ofOwned = inArray(bookListings.communityId, ownedIds);
            await tx.update(bookListings)
                .set({ communityId: null, hiddenAt: now, hiddenReason: "Komunitas dihapus bersama akun pemiliknya", availability: "UNAVAILABLE", publicLocation: null, borrowingRules: null, updatedAt: now })
                .where(and(ofOwned, inArray(bookListings.id, withHistory)));
            await tx.delete(bookListings).where(and(ofOwned, notInArray(bookListings.id, withHistory)));
        }
        // Copies this manager added to other communities stay in those collections, now under each community's owner.
        await tx.update(bookListings)
            .set({ ownerId: sql`(select "communities"."ownerId" from "communities" where "communities"."id" = "book_listings"."communityId")`, updatedAt: now })
            .where(and(eq(bookListings.ownerId, userId), isNotNull(bookListings.communityId)));
        const files = ownedIds.length > 0
            ? await tx.select({ path: communitySubmissions.filePath }).from(communitySubmissions).where(and(inArray(communitySubmissions.communityId, ownedIds), isNotNull(communitySubmissions.filePath)))
            : [];
        if (ownedIds.length > 0) await tx.delete(communities).where(inArray(communities.id, ownedIds));
        await tx.delete(communityMemberships).where(eq(communityMemberships.userId, userId));

        await tx.update(userProfiles).set({
            displayName: DELETED_ACCOUNT_NAME,
            preferences: {},
            role: "MEMBER",
            suspendedAt: null,
            suspendedReason: null,
            suspendedById: null,
            deletedAt: now,
            updatedAt: now,
        }).where(eq(userProfiles.id, userId));
        await tx.insert(adminAuditLogs).values({ actorId: null, action: "ACCOUNT_DELETED", targetType: "USER", targetId: userId, note: "Dianonimkan setelah masa tenggang 14 hari.", createdAt: now });

        return { status: "purged" as const, filePaths: files.map((row) => row.path!).filter(Boolean) };
    });
}

export function listDueDeletions(now = new Date()) {
    return db.select({ id: userProfiles.id }).from(userProfiles)
        .where(and(isNotNull(userProfiles.deletionScheduledFor), lte(userProfiles.deletionScheduledFor, now), isNull(userProfiles.deletedAt)))
        .limit(100);
}

/** Anonymised accounts whose Supabase Auth user still exists (removal failed earlier). */
export function listAuthDeletionsToRetry() {
    return db.select({ id: userProfiles.id }).from(userProfiles).where(and(isNotNull(userProfiles.deletedAt), isNull(userProfiles.authDeletedAt))).limit(100);
}

export async function markAuthDeleted(userId: string) {
    await db.update(userProfiles).set({ authDeletedAt: new Date() }).where(eq(userProfiles.id, userId));
}

/** Time-based retention (DEC-11). Returns counts and evidence files to remove from storage. */
export async function applyRetention(now = new Date()) {
    return db.transaction(async (tx) => {
        const reportCutoff = monthsBefore(now, REPORT_DETAILS_RETENTION_MONTHS);
        const auditCutoff = monthsBefore(now, AUDIT_RETENTION_MONTHS);
        const loanCutoff = monthsBefore(now, LOAN_HISTORY_RETENTION_MONTHS);

        const purgedReports = await tx.update(reports)
            .set({ details: null, detailsPurgedAt: now })
            .where(and(inArray(reports.status, ["RESOLVED", "REJECTED"]), lt(reports.reviewedAt, reportCutoff), isNotNull(reports.details)))
            .returning({ id: reports.id });

        const deletedAudit = await tx.delete(adminAuditLogs).where(lt(adminAuditLogs.createdAt, auditCutoff)).returning({ id: adminAuditLogs.id });

        // Finished loans only: rejected or cancelled requests, and returned or lost borrowings.
        const finished = await tx.select({ id: borrowRequests.id })
            .from(borrowRequests)
            .leftJoin(borrowings, eq(borrowings.requestId, borrowRequests.id))
            .where(and(
                lt(borrowRequests.updatedAt, loanCutoff),
                or(
                    inArray(borrowRequests.status, ["REJECTED", "CANCELLED"]),
                    and(eq(borrowRequests.status, "COMPLETED"), inArray(borrowings.status, ["RETURNED", "LOST"]), lt(borrowings.updatedAt, loanCutoff)),
                ),
            ));
        const finishedIds = finished.map((row) => row.id);
        if (finishedIds.length > 0) {
            await tx.delete(borrowEvents).where(inArray(borrowEvents.requestId, finishedIds));
            await tx.delete(borrowings).where(inArray(borrowings.requestId, finishedIds));
            await tx.delete(borrowRequests).where(inArray(borrowRequests.id, finishedIds));
        }

        // Finished library requests (TB-023): answered, cancelled, collected, or never picked up.
        const finishedAccess = await tx.delete(bookAccesses)
            .where(and(lt(bookAccesses.updatedAt, loanCutoff), or(
                inArray(bookAccesses.status, ["REJECTED", "CANCELLED", "COLLECTED"]),
                and(eq(bookAccesses.status, "APPROVED"), lt(bookAccesses.expiresAt, loanCutoff)),
            )))
            .returning({ id: bookAccesses.id });

        const oldEvidence = await tx.delete(communitySubmissions)
            .where(and(ne(communitySubmissions.status, "PENDING"), lt(communitySubmissions.reviewedAt, auditCutoff)))
            .returning({ path: communitySubmissions.filePath });

        return {
            reportDetails: purgedReports.length,
            auditEntries: deletedAudit.length,
            loans: finishedIds.length + finishedAccess.length,
            evidence: oldEvidence.length,
            filePaths: oldEvidence.map((row) => row.path).filter((path): path is string => Boolean(path)),
        };
    });
}

export type RetentionSummary = {
    ranAt: string;
    accountsDeleted: number;
    accountsBlocked: number;
    reportDetails: number;
    auditEntries: number;
    loans: number;
    evidence: number;
};

export async function saveRetentionRun(summary: RetentionSummary, actorId: string | null) {
    await db.insert(appSettings)
        .values({ key: RETENTION_KEY, value: summary, updatedById: actorId, updatedAt: new Date(summary.ranAt) })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: summary, updatedById: actorId, updatedAt: new Date(summary.ranAt) } });
    await db.insert(adminAuditLogs).values({ actorId, action: "RETENTION_RUN", targetType: "OTHER", targetId: SYSTEM_TARGET_ID, note: actorId ? "Dijalankan admin." : "Dijalankan terjadwal.", metadata: summary });
}

export async function getLastRetentionRun() {
    const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, RETENTION_KEY));
    return (row?.value as RetentionSummary | undefined) ?? null;
}

export async function countPendingDeletions() {
    const [row] = await db.select({ total: count() }).from(userProfiles).where(and(isNotNull(userProfiles.deletionRequestedAt), isNull(userProfiles.deletedAt)));
    return row?.total ?? 0;
}

/** "Unduh salinan data saya": the account's own data, with other people reduced to display names. */
export async function exportUserData(userId: string) {
    const counterpart = alias(userProfiles, "counterpart");
    const listingOwner = alias(userProfiles, "listing_owner");
    const [profile, interests, saved, listings, loans, memberships, sentReports, libraryRequests, reviews] = await Promise.all([
        db.query.userProfiles.findFirst({ where: eq(userProfiles.id, userId), columns: { displayName: true, role: true, regionCode: true, createdAt: true, deletionScheduledFor: true } }),
        db.select({ subject: userInterests.subject }).from(userInterests).where(eq(userInterests.userId, userId)),
        db.select({ title: books.title, savedAt: bookmarks.createdAt }).from(bookmarks).innerJoin(books, eq(books.id, bookmarks.bookId)).where(eq(bookmarks.userId, userId)),
        db.select({ title: books.title, condition: bookListings.condition, availability: bookListings.availability, publicLocation: bookListings.publicLocation, borrowingRules: bookListings.borrowingRules, createdAt: bookListings.createdAt })
            .from(bookListings).innerJoin(books, eq(books.id, bookListings.bookId)).where(eq(bookListings.ownerId, userId)),
        db.select({
            title: books.title,
            asOwner: sql<boolean>`${bookListings.ownerId} = ${userId}`,
            ownerName: listingOwner.displayName,
            requesterName: counterpart.displayName,
            requestStatus: borrowRequests.status,
            borrowingStatus: borrowings.status,
            loanDays: borrowRequests.loanDays,
            meetingPoint: borrowRequests.meetingPoint,
            note: borrowRequests.note,
            guarantee: borrowRequests.guarantee,
            requestedAt: borrowRequests.requestedAt,
            handedOverAt: borrowings.handedOverAt,
            dueAt: borrowings.dueAt,
            returnedAt: borrowings.returnedAt,
            disputeConsequence: sql<string | null>`case when ${borrowings.consequenceUserId} = ${userId} then ${borrowings.consequence} end`,
        })
            .from(borrowRequests)
            .innerJoin(bookListings, eq(bookListings.id, borrowRequests.listingId))
            .innerJoin(books, eq(books.id, bookListings.bookId))
            .innerJoin(counterpart, eq(counterpart.id, borrowRequests.requesterId))
            .innerJoin(listingOwner, eq(listingOwner.id, bookListings.ownerId))
            .leftJoin(borrowings, eq(borrowings.requestId, borrowRequests.id))
            .where(or(eq(borrowRequests.requesterId, userId), eq(bookListings.ownerId, userId)))
            .orderBy(desc(borrowRequests.requestedAt)),
        db.select({ community: communities.name, role: communityMemberships.role, status: communityMemberships.status, since: communityMemberships.createdAt })
            .from(communityMemberships).innerJoin(communities, eq(communities.id, communityMemberships.communityId)).where(eq(communityMemberships.userId, userId)),
        db.select({ targetType: reports.targetType, reason: reports.reason, details: reports.details, status: reports.status, createdAt: reports.createdAt })
            .from(reports).where(eq(reports.reporterId, userId)).orderBy(desc(reports.createdAt)),
        db.select({ library: libraries.name, title: books.title, status: bookAccesses.status, message: bookAccesses.message, responseNote: bookAccesses.responseNote, expiresAt: bookAccesses.expiresAt, createdAt: bookAccesses.createdAt })
            .from(bookAccesses).innerJoin(libraries, eq(libraries.id, bookAccesses.libraryId)).innerJoin(books, eq(books.id, bookAccesses.bookId))
            .where(eq(bookAccesses.requesterId, userId)).orderBy(desc(bookAccesses.createdAt)),
        db.select({
            title: books.title,
            // Qualified: borrow_requests has a "requesterId" too.
            about: sql<string>`case when "borrower_reviews"."requesterId" = ${userId} then 'saya' else 'peminjam' end`,
            rating: borrowerReviews.rating,
            comment: borrowerReviews.comment,
            createdAt: borrowerReviews.createdAt,
        })
            .from(borrowerReviews)
            .innerJoin(borrowings, eq(borrowings.id, borrowerReviews.borrowingId))
            .innerJoin(borrowRequests, eq(borrowRequests.id, borrowings.requestId))
            .innerJoin(bookListings, eq(bookListings.id, borrowRequests.listingId))
            .innerJoin(books, eq(books.id, bookListings.bookId))
            .where(or(eq(borrowerReviews.requesterId, userId), eq(borrowerReviews.reviewerId, userId)))
            .orderBy(desc(borrowerReviews.createdAt)),
    ]);
    return {
        exportedAt: new Date().toISOString(),
        note: "Salinan data akun TemuBaca Anda. Data orang lain hanya ditampilkan sebagai nama tampilan.",
        profile,
        interests: interests.map((row) => row.subject),
        bookmarks: saved,
        listings,
        loans: loans.map(({ asOwner, ownerName, requesterName, ...loan }) => ({ role: asOwner ? "pemilik" : "peminjam", counterpart: asOwner ? requesterName : ownerName, ...loan })),
        communities: memberships,
        reports: sentReports,
        libraryRequests,
        reviews,
    };
}
