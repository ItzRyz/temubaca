import { asc, count, eq, gt, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { genres } from "@/features/books/genres";
import * as schema from "@/lib/db/schema";

const { bookListings, bookmarks, books, communities } = schema;

/** Bumped only for breaking changes; new fields are additive. */
export const ML_SNAPSHOT_VERSION = 1;
export const ML_SNAPSHOT_DEFAULT_LIMIT = 500;
export const ML_SNAPSHOT_MAX_LIMIT = 1000;

/** Any Drizzle Postgres database with the app schema (the app pool, a script pool, or PGlite in tests). */
type SnapshotDatabase = Pick<NodePgDatabase<typeof schema>, "select">;

const genreMatchers = genres.map((genre) => ({ label: genre.label, regex: new RegExp(genre.pattern) }));

/** Genre labels (the interest vocabulary users pick on the site) covered by a book's provider subjects. */
export function genresForCategories(categories: string[]) {
    const subjects = categories.map((category) => category.trim().toLocaleLowerCase("en"));
    return genreMatchers
        .filter(({ regex }) => subjects.some((subject) => regex.test(subject)))
        .map(({ label }) => label);
}

/**
 * Public catalog and verified communities for training the ML Service (DEC-08, ML-02).
 * Only public fields and aggregate counts: no provider metadata, owner, contacts, or per-user data.
 * Books are paged by id; communities come with the first page only. This module has no
 * `server-only` guard so the export script can run it against its own pool.
 */
export async function buildMlSnapshot(
    database: SnapshotDatabase,
    { cursor, limit = ML_SNAPSHOT_DEFAULT_LIMIT }: { cursor?: string; limit?: number } = {},
) {
    const bookmarkCounts = database
        .select({ bookId: bookmarks.bookId, total: count().as("bookmark_total") })
        .from(bookmarks)
        .groupBy(bookmarks.bookId)
        .as("bookmark_counts");
    // Listings hidden by moderators do not count towards popularity.
    const listingCounts = database
        .select({ bookId: bookListings.bookId, total: count().as("listing_total") })
        .from(bookListings)
        .where(isNull(bookListings.hiddenAt))
        .groupBy(bookListings.bookId)
        .as("listing_counts");

    const rows = await database
        .select({
            id: books.id,
            title: books.title,
            authors: books.authors,
            description: books.description,
            categories: books.categories,
            language: books.language,
            publisher: books.publisher,
            publishedAt: books.publishedAt,
            isbn: books.isbn,
            provider: books.provider,
            updatedAt: books.updatedAt,
            bookmarkCount: sql<number>`coalesce(${bookmarkCounts.total}, 0)::int`,
            listingCount: sql<number>`coalesce(${listingCounts.total}, 0)::int`,
        })
        .from(books)
        .leftJoin(bookmarkCounts, eq(bookmarkCounts.bookId, books.id))
        .leftJoin(listingCounts, eq(listingCounts.bookId, books.id))
        .where(cursor ? gt(books.id, cursor) : undefined)
        .orderBy(asc(books.id))
        .limit(limit + 1);

    const page = rows.slice(0, limit);
    const verifiedCommunities = cursor
        ? []
        : await database
            .select({
                id: communities.id,
                name: communities.name,
                description: communities.description,
                interests: communities.interests,
                regionCode: communities.regionCode,
                updatedAt: communities.updatedAt,
            })
            .from(communities)
            .where(eq(communities.status, "VERIFIED"))
            .orderBy(asc(communities.id));

    return {
        version: ML_SNAPSHOT_VERSION,
        generatedAt: new Date().toISOString(),
        books: page.map((book) => ({ ...book, genres: genresForCategories(book.categories) })),
        communities: verifiedCommunities,
        genres: genres.map(({ slug, label }) => ({ slug, label })),
        nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    };
}

export type MlSnapshotPage = Awaited<ReturnType<typeof buildMlSnapshot>>;
