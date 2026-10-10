import "server-only";

import {
    and,
    desc,
    eq,
    ilike,
    or,
    sql,
} from "drizzle-orm";

import { db } from "../client";

import {
    books,
    bookListings,
} from "../schema";

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

                where: (listing, { eq }) =>
                    eq(listing.availability, "AVAILABLE"),

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

function browseCondition(filters: BookBrowseFilters) {
    const q = filters.q?.trim();
    return and(
        q ? textSearchCondition(q) : undefined,
        filters.category ? sql`${filters.category} = ANY(${books.categories})` : undefined,
        filters.language ? eq(books.language, filters.language) : undefined,
    );
}

/** Catalog browse with optional text/category/language filters and a count of AVAILABLE shared copies. */
export async function browseBooks(filters: BookBrowseFilters, limit = 10, offset = 0) {
    const where = browseCondition(filters);
    const availableCopies = sql<number>`(
        select count(*)::int from ${bookListings}
        where "book_listings"."bookId" = "books"."id" and "book_listings"."availability" = 'AVAILABLE'
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

/** Most common categories and languages for the catalog filter sidebar. */
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
        ),

        with: {
            ownerUser: {
                columns: {
                    displayName: true,
                },
            },
        },

        orderBy: (table, { desc }) => [
            desc(table.createdAt),
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
