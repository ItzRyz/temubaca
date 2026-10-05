import "server-only";

import {
    and,
    desc,
    eq,
    ilike,
    or,
} from "drizzle-orm";

import { db } from "../client";

import {
    books,
    bookListings,
} from "../schema";

export async function findBookById(
    bookId: string,
) {
    return db.query.books.findFirst({
        where: eq(books.id, bookId),

        with: {
            bookmarks: true,

            listings: {
                with: {
                    ownerUser: true,
                },

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
) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
        return [];
    }

    const search = `%${normalizedQuery}%`;

    return db
        .select()
        .from(books)
        .where(
            or(
                ilike(books.title, search),
                ilike(books.isbn, search),
            ),
        )
        .orderBy(desc(books.createdAt))
        .limit(Math.min(Math.max(limit, 1), 100));
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
            ownerUser: true,
            book: true,
        },

        orderBy: (table, { desc }) => [
            desc(table.createdAt),
        ],
    });
}

export async function findBookListingById(
    listingId: string,
) {
    return db.query.bookListings.findFirst({
        where: eq(bookListings.id, listingId),

        with: {
            book: true,
            ownerUser: true,
            requests: {
                with: {
                    requester: true,
                },

                orderBy: (table, { desc }) => [
                    desc(table.requestedAt),
                ],
            },
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
            ownerUser: true,
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
        .where(eq(bookListings.id, listingId))
        .returning();

    return listing ?? null;
}