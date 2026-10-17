import "server-only";

import { and, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";

import { db } from "../client";
import { bookListings, books, bookSyncLogs, userProfiles, verifications } from "../schema";

const LIMIT = 200;

function likePattern(query: string | undefined) {
    const trimmed = query?.trim();
    return trimmed ? `%${trimmed.replace(/[\\%_]/g, "\\$&")}%` : undefined;
}

/** Every book listing with owner and report counts, for the admin "Listing Buku" tab (Figma 149:807). */
export async function listListingsForAdmin(options: { query?: string } = {}) {
    const pattern = likePattern(options.query);
    return db
        .select({
            id: bookListings.id,
            bookId: books.id,
            title: books.title,
            authors: books.authors,
            publisher: books.publisher,
            publishedAt: books.publishedAt,
            provider: books.provider,
            syncedAt: books.syncedAt,
            ownerName: userProfiles.displayName,
            condition: bookListings.condition,
            availability: bookListings.availability,
            publicLocation: bookListings.publicLocation,
            hiddenAt: bookListings.hiddenAt,
            hiddenReason: bookListings.hiddenReason,
            createdAt: bookListings.createdAt,
            reportCount: sql<number>`(
                select count(*)::int from "reports"
                where "reports"."targetType" = 'BOOK_LISTING' and "reports"."targetId" = "book_listings"."id"
            )`,
            openReportCount: sql<number>`(
                select count(*)::int from "reports"
                where "reports"."targetType" = 'BOOK_LISTING' and "reports"."targetId" = "book_listings"."id"
                and "reports"."status" in ('PENDING', 'REVIEWING')
            )`,
        })
        .from(bookListings)
        .innerJoin(books, eq(bookListings.bookId, books.id))
        .innerJoin(userProfiles, eq(bookListings.ownerId, userProfiles.id))
        .where(pattern ? or(ilike(books.title, pattern), ilike(userProfiles.displayName, pattern), sql`array_to_string(${books.authors}, ' ') ilike ${pattern}`) : undefined)
        .orderBy(desc(bookListings.createdAt))
        .limit(LIMIT);
}

/** Hide or restore a listing and record the decision in `verifications` (REVOKED = hidden). */
export async function setListingVisibility(input: { listingId: string; adminId: string; hidden: boolean; reason?: string }) {
    return db.transaction(async (tx) => {
        const [listing] = await tx
            .select({ id: bookListings.id, hiddenAt: bookListings.hiddenAt })
            .from(bookListings)
            .where(eq(bookListings.id, input.listingId))
            .for("update");
        if (!listing) return { status: "not_found" as const };
        if (Boolean(listing.hiddenAt) === input.hidden) return { status: "unchanged" as const };

        const now = new Date();
        await tx.update(bookListings).set(input.hidden
            ? { hiddenAt: now, hiddenReason: input.reason ?? null, hiddenById: input.adminId, updatedAt: now }
            : { hiddenAt: null, hiddenReason: null, hiddenById: null, updatedAt: now })
            .where(eq(bookListings.id, listing.id));
        await tx.insert(verifications).values({
            targetType: "BOOK_LISTING",
            targetId: listing.id,
            status: input.hidden ? "REVOKED" : "APPROVED",
            reviewerId: input.adminId,
            note: input.reason || null,
            reviewedAt: now,
            createdAt: now,
            updatedAt: now,
        });
        return { status: "updated" as const, hidden: input.hidden };
    });
}

/** Hide/restore history for one listing, newest first. */
export async function listListingModerationHistory(listingId: string, limit = 5) {
    return db
        .select({ id: verifications.id, status: verifications.status, note: verifications.note, at: verifications.createdAt, reviewerName: userProfiles.displayName })
        .from(verifications)
        .leftJoin(userProfiles, eq(verifications.reviewerId, userProfiles.id))
        .where(and(eq(verifications.targetType, "BOOK_LISTING"), eq(verifications.targetId, listingId)))
        .orderBy(desc(verifications.createdAt))
        .limit(limit);
}

/** Stored catalog records with sync state, usage, and likely duplicates (Figma 150:807). */
export async function listCatalogRecords(options: { query?: string } = {}) {
    const pattern = likePattern(options.query);
    return db
        .select({
            id: books.id,
            title: books.title,
            authors: books.authors,
            isbn: books.isbn,
            publisher: books.publisher,
            publishedAt: books.publishedAt,
            provider: books.provider,
            providerId: books.providerId,
            syncedAt: books.syncedAt,
            createdAt: books.createdAt,
            listingCount: sql<number>`(select count(*)::int from "book_listings" where "book_listings"."bookId" = "books"."id")`,
            lastSyncStatus: sql<"SUCCESS" | "FAILED" | null>`(
                select "book_sync_logs"."status" from "book_sync_logs"
                where "book_sync_logs"."bookId" = "books"."id"
                order by "book_sync_logs"."createdAt" desc limit 1
            )`,
            lastSyncAt: sql<Date | null>`(
                select max("book_sync_logs"."createdAt") from "book_sync_logs" where "book_sync_logs"."bookId" = "books"."id"
            )`.mapWith((value) => (value ? new Date(value as string) : null)),
            // Same ISBN, or same title and first author ignoring case, on another record.
            duplicateCount: sql<number>`(
                select count(*)::int from "books" as "other"
                where "other"."id" <> "books"."id"
                and (
                    ("books"."isbn" is not null and "other"."isbn" = "books"."isbn")
                    or (lower("other"."title") = lower("books"."title")
                        and coalesce(lower("other"."authors"[1]), '') = coalesce(lower("books"."authors"[1]), ''))
                )
            )`,
        })
        .from(books)
        .where(pattern ? or(ilike(books.title, pattern), ilike(books.isbn, pattern), sql`array_to_string(${books.authors}, ' ') ilike ${pattern}`) : undefined)
        .orderBy(desc(books.createdAt))
        .limit(LIMIT);
}

export async function listBookSyncLogs(bookId: string, limit = 5) {
    return db
        .select({ id: bookSyncLogs.id, provider: bookSyncLogs.provider, status: bookSyncLogs.status, trigger: bookSyncLogs.trigger, changedFields: bookSyncLogs.changedFields, message: bookSyncLogs.message, createdAt: bookSyncLogs.createdAt })
        .from(bookSyncLogs)
        .where(eq(bookSyncLogs.bookId, bookId))
        .orderBy(desc(bookSyncLogs.createdAt))
        .limit(limit);
}

/** Most recent request outcome per external provider, for the provider status cards. */
export async function latestProviderActivity() {
    const rows = await db
        .selectDistinctOn([bookSyncLogs.provider], { provider: bookSyncLogs.provider, status: bookSyncLogs.status, createdAt: bookSyncLogs.createdAt })
        .from(bookSyncLogs)
        .where(isNotNull(bookSyncLogs.provider))
        .orderBy(bookSyncLogs.provider, desc(bookSyncLogs.createdAt));
    return new Map(rows.map((row) => [row.provider, row]));
}

export async function countHiddenListings() {
    const [row] = await db.select({ total: sql<number>`count(*)::int` }).from(bookListings).where(isNotNull(bookListings.hiddenAt));
    return row?.total ?? 0;
}

export async function countVisibleListings(availability: "AVAILABLE" | "RESERVED") {
    const [row] = await db.select({ total: sql<number>`count(*)::int` }).from(bookListings)
        .where(and(eq(bookListings.availability, availability), isNull(bookListings.hiddenAt)));
    return row?.total ?? 0;
}
