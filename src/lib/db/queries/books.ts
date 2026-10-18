import "server-only";

import {
    and,
    count,
    desc,
    eq,
    ilike,
    isNull,
    or,
    sql,
    type AnyColumn,
} from "drizzle-orm";

import {
    listingDeletionBlocker,
    type ListingDeletionBlocker,
} from "@/features/book-listings/listing-deletion";

import { genreBySlug, genres } from "@/features/books/genres";

import { db } from "../client";

import {
    books,
    bookListings,
    borrowRequests,
} from "../schema";

/** Public listings exclude owners an admin has suspended or who asked to delete their account (DEC-11). */
function ownerNotSuspended(ownerId: AnyColumn) {
    return sql`${ownerId} not in (select "user_profiles"."id" from "user_profiles" where "user_profiles"."suspendedAt" is not null or "user_profiles"."deletionRequestedAt" is not null)`;
}

/** Fields safe and useful for public catalog responses; omits raw provider metadata and internal timestamps. */
export const publicBookColumns = {
    id: books.id,
    provider: books.provider,
    providerId: books.providerId,
    isbn: books.isbn,
    title: books.title,
    authors: books.authors,
    description: books.description,
    publisher: books.publisher,
    publishedAt: books.publishedAt,
    language: books.language,
    categories: books.categories,
    coverUrl: books.coverUrl,
};

export async function findBookById(
    bookId: string,
) {
    return db.query.books.findFirst({
        where: eq(books.id, bookId),

        columns: {
            id: true,
            provider: true,
            providerId: true,
            isbn: true,
            title: true,
            authors: true,
            description: true,
            publisher: true,
            publishedAt: true,
            language: true,
            categories: true,
            coverUrl: true,
        },

        with: {
            listings: {
                with: {
                    ownerUser: {
                        columns: {
                            displayName: true,
                        },
                    },
                },

                where: (listing, { and, eq, isNull }) =>
                    and(eq(listing.availability, "AVAILABLE"), isNull(listing.hiddenAt), ownerNotSuspended(listing.ownerId)),

                orderBy: (table, { desc }) => [
                    desc(table.createdAt),
                ],
            },
        },
    });
}

export async function findBookByProvider(
    provider: (typeof import("@/lib/db/schema").bookProviderValues)[number],
    providerId: string,
) {
    return db.query.books.findFirst({
        where: and(
            eq(books.provider, provider),
            eq(books.providerId, providerId),
        ),
    });
}

export async function searchBooks(
    query: string,
    limit = 20,
    offset = 0,
) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
        return [];
    }

    const escapedQuery = normalizedQuery.replace(/[\\%_]/g, "\\$&");
    const search = `%${escapedQuery}%`;
    const searchCondition = or(
        ilike(books.title, search),
        ilike(books.isbn, search),
        sql`array_to_string(${books.authors}, ' ') ILIKE ${search}`,
        sql`array_to_string(${books.categories}, ' ') ILIKE ${search}`,
    );

    return db
        .select(publicBookColumns)
        .from(books)
        .where(searchCondition)
        .orderBy(desc(books.createdAt))
        .limit(Math.min(Math.max(limit, 1), 100))
        .offset(Math.max(offset, 0));
}

function textSearchCondition(query: string) {
    const escapedQuery = query.replace(/[\\%_]/g, "\\$&");
    const search = `%${escapedQuery}%`;
    return or(
        ilike(books.title, search),
        ilike(books.isbn, search),
        sql`array_to_string(${books.authors}, ' ') ILIKE ${search}`,
        sql`array_to_string(${books.categories}, ' ') ILIKE ${search}`,
    );
}

export type BookBrowseFilters = {
    q?: string;
    category?: string;
    language?: string;
};

/** A genre slug matches any of its provider subjects; anything else is an exact subject (old links). */
function categoryCondition(category: string) {
    const genre = genreBySlug(category);
    return genre
        ? sql`exists (select 1 from unnest(${books.categories}) as subject where lower(subject) ~ ${genre.pattern})`
        : sql`${category} = ANY(${books.categories})`;
}

function browseCondition(filters: BookBrowseFilters) {
    const q = filters.q?.trim();
    return and(
        q ? textSearchCondition(q) : undefined,
        filters.category ? categoryCondition(filters.category) : undefined,
        filters.language ? eq(books.language, filters.language) : undefined,
    );
}

/** Catalog browse with optional text/category/language filters and a count of AVAILABLE shared copies. */
export async function browseBooks(filters: BookBrowseFilters, limit = 10, offset = 0) {
    const where = browseCondition(filters);
    const availableCopies = sql<number>`(
        select count(*)::int from ${bookListings}
        where "book_listings"."bookId" = "books"."id" and "book_listings"."availability" = 'AVAILABLE'
        and "book_listings"."hiddenAt" is null
        and "book_listings"."ownerId" not in (select "user_profiles"."id" from "user_profiles" where "user_profiles"."suspendedAt" is not null or "user_profiles"."deletionRequestedAt" is not null)
    )`; // Qualified names: drizzle renders bare column refs unqualified inside sql``, which would bind to the subquery table.

    const [items, [countRow]] = await Promise.all([
        db
            .select({
                id: books.id,
                title: books.title,
                authors: books.authors,
                description: books.description,
                publisher: books.publisher,
                publishedAt: books.publishedAt,
                categories: books.categories,
                coverUrl: books.coverUrl,
                availableCopies,
            })
            .from(books)
            .where(where)
            .orderBy(desc(books.createdAt))
            .limit(Math.min(Math.max(limit, 1), 50))
            .offset(Math.max(offset, 0)),
        db.select({ total: sql<number>`count(*)::int` }).from(books).where(where),
    ]);

    return { items, total: countRow?.total ?? 0 };
}

/** Genre counts for the /books filter (see features/books/genres.ts), most common first; empty genres are left out. */
export async function listGenreFacets() {
    const counts = sql.join(
        genres.map((genre) => sql`count(*) filter (where exists (select 1 from unnest(${books.categories}) as subject where lower(subject) ~ ${genre.pattern}))::int`),
        sql`, `,
    );
    const result = await db.execute<{ counts: number[] }>(sql`select array[${counts}] as counts from ${books}`);
    const totals = result.rows[0]?.counts ?? [];
    return genres
        .map((genre, index) => ({ value: genre.slug, label: genre.label, total: Number(totals[index] ?? 0) }))
        .filter((facet) => facet.total > 0)
        .sort((a, b) => b.total - a.total);
}

/** Most common raw provider subjects and languages. */
export async function listBookFacets(limit = 8) {
    const [categories, languages] = await Promise.all([
        db.execute<{ value: string; total: number }>(sql`
            select category as value, count(*)::int as total
            from ${books}, unnest(${books.categories}) as category
            group by category order by total desc, category asc limit ${limit}
        `),
        db
            .select({ value: books.language, total: sql<number>`count(*)::int` })
            .from(books)
            .where(sql`${books.language} is not null and ${books.language} <> ''`)
            .groupBy(books.language)
            .orderBy(desc(sql`count(*)`))
            .limit(limit),
    ]);

    return {
        categories: categories.rows.map((row) => ({ value: row.value, total: Number(row.total) })),
        languages: languages.flatMap((row) => (row.value ? [{ value: row.value, total: row.total }] : [])),
    };
}

export async function countBooks() {
    const [result] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(books);

    return result?.total ?? 0;
}

export async function countBooksMatchingQuery(query: string) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
        return 0;
    }

    const escapedQuery = normalizedQuery.replace(/[\\%_]/g, "\\$&");
    const search = `%${escapedQuery}%`;
    const searchCondition = or(
        ilike(books.title, search),
        ilike(books.isbn, search),
        sql`array_to_string(${books.authors}, ' ') ILIKE ${search}`,
        sql`array_to_string(${books.categories}, ' ') ILIKE ${search}`,
    );

    const [result] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(books)
        .where(searchCondition);

    return result?.total ?? 0;
}

export async function listBooks(
    limit = 20,
    offset = 0,
) {
    return db
        .select()
        .from(books)
        .orderBy(desc(books.createdAt))
        .limit(Math.min(Math.max(limit, 1), 100))
        .offset(Math.max(offset, 0));
}

/** Latest catalog entries for public surfaces; uses the safe public projection. */
export async function listLatestPublicBooks(limit = 4) {
    return db
        .select(publicBookColumns)
        .from(books)
        .orderBy(desc(books.createdAt))
        .limit(Math.min(Math.max(limit, 1), 24));
}

export async function listBookListings(
    bookId: string,
) {
    return db.query.bookListings.findMany({
        where: and(
            eq(bookListings.bookId, bookId),
            eq(
                bookListings.availability,
                "AVAILABLE",
            ),
            // Listings hidden by an admin, or owned by a suspended account, never reach public pages.
            isNull(bookListings.hiddenAt),
            ownerNotSuspended(bookListings.ownerId),
        ),

        with: {
            ownerUser: {
                columns: {
                    displayName: true,
                    createdAt: true,
                },
            },
        },

        orderBy: (table, { desc }) => [
            desc(table.updatedAt),
        ],
    });
}

export async function listUserBookListings(userId: string) {
    return db.query.bookListings.findMany({
        where: eq(bookListings.ownerId, userId),
        with: {
            book: {
                columns: {
                    id: true,
                    title: true,
                    authors: true,
                    categories: true,
                    publishedAt: true,
                    publisher: true,
                    coverUrl: true,
                },
            },
        },
        orderBy: (table, { desc }) => [desc(table.createdAt)],
    });
}

export async function countUserBookListings(userId: string) {
    const [result] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(bookListings)
        .where(eq(bookListings.ownerId, userId));
    return result?.total ?? 0;
}

export async function findBookListingById(
    listingId: string,
) {
    return db.query.bookListings.findFirst({
        where: eq(bookListings.id, listingId),

        with: {
            book: {
                columns: {
                    id: true,
                    title: true,
                    authors: true,
                    categories: true,
                    publishedAt: true,
                    coverUrl: true,
                },
            },
            ownerUser: { columns: { id: true, displayName: true } },
        },
    });
}

export async function findAvailableBookListings(
    bookId: string,
) {
    return db.query.bookListings.findMany({
        where: and(
            eq(bookListings.bookId, bookId),
            eq(
                bookListings.availability,
                "AVAILABLE",
            ),
            // Listings hidden by an admin, or owned by a suspended account, never reach public pages.
            isNull(bookListings.hiddenAt),
            ownerNotSuspended(bookListings.ownerId),
        ),

        with: {
            ownerUser: {
                columns: {
                    displayName: true,
                },
            },
        },
    });
}

export async function createBookListing(input: {
    ownerId: string;
    bookId: string;
    condition:
    | "NEW"
    | "LIKE_NEW"
    | "GOOD"
    | "FAIR"
    | "POOR";
    availability?:
    | "AVAILABLE"
    | "UNAVAILABLE"
    | "RESERVED";
    publicLocation?: string;
    borrowingRules?: string;
}) {
    const [listing] = await db
        .insert(bookListings)
        .values({
            ownerId: input.ownerId,
            bookId: input.bookId,
            condition: input.condition,
            availability:
                input.availability ?? "AVAILABLE",
            publicLocation:
                input.publicLocation,
            borrowingRules:
                input.borrowingRules,
        })
        .returning();

    return listing;
}

export async function updateBookListing(
    listingId: string,
    ownerId: string,
    input: {
        condition?:
        | "NEW"
        | "LIKE_NEW"
        | "GOOD"
        | "FAIR"
        | "POOR";

        availability?:
        | "AVAILABLE"
        | "UNAVAILABLE"
        | "RESERVED";

        publicLocation?: string | null;

        borrowingRules?: string | null;
    },
) {
    const [listing] = await db
        .update(bookListings)
        .set({
            ...(input.condition !== undefined
                ? {
                    condition: input.condition,
                }
                : {}),

            ...(input.availability !== undefined
                ? {
                    availability:
                        input.availability,
                }
                : {}),

            ...(input.publicLocation !== undefined
                ? {
                    publicLocation:
                        input.publicLocation,
                }
                : {}),

            ...(input.borrowingRules !== undefined
                ? {
                    borrowingRules:
                        input.borrowingRules,
                }
                : {}),

            updatedAt: new Date(),
        })
        .where(and(
            eq(bookListings.id, listingId),
            eq(bookListings.ownerId, ownerId),
        ))
        .returning();

    return listing ?? null;
}

export type DeleteBookListingResult =
    | { status: "deleted"; id: string }
    | { status: "not_found" }
    | { status: "blocked"; reason: ListingDeletionBlocker };

export async function deleteBookListing(
    listingId: string,
    ownerId: string,
): Promise<DeleteBookListingResult> {
    return db.transaction(async (tx) => {
        const [listing] = await tx
            .select({ id: bookListings.id, availability: bookListings.availability })
            .from(bookListings)
            .where(and(
                eq(bookListings.id, listingId),
                eq(bookListings.ownerId, ownerId),
            ))
            .for("update");

        if (!listing) return { status: "not_found" };

        const [{ requestCount }] = await tx
            .select({ requestCount: count() })
            .from(borrowRequests)
            .where(eq(borrowRequests.listingId, listingId));

        const blocker = listingDeletionBlocker({
            availability: listing.availability,
            borrowRequestCount: requestCount,
        });
        if (blocker) return { status: "blocked", reason: blocker };

        await tx.delete(bookListings).where(eq(bookListings.id, listingId));
        return { status: "deleted", id: listingId };
    });
}
