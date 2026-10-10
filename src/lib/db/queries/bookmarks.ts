import "server-only";

import {
    and,
    desc,
    eq,
    sql,
} from "drizzle-orm";

import { db } from "../client";
import { bookmarks, books } from "../schema";

export async function findBookmark(
    userId: string,
    bookId: string,
) {
    return db.query.bookmarks.findFirst({
        where: and(
            eq(bookmarks.userId, userId),
            eq(bookmarks.bookId, bookId),
        ),
    });
}

export async function hasBookmark(
    userId: string,
    bookId: string,
) {
    const bookmark = await findBookmark(
        userId,
        bookId,
    );

    return bookmark !== undefined;
}

export async function listUserBookmarks(
    userId: string,
    limit = 50,
    offset = 0,
) {
    return db.query.bookmarks.findMany({
        where: eq(bookmarks.userId, userId),

        with: {
            book: true,
        },

        orderBy: [
            desc(bookmarks.createdAt),
        ],

        limit: Math.min(
            Math.max(limit, 1),
            100,
        ),

        offset: Math.max(offset, 0),
    });
}

export async function countUserBookmarks(userId: string) {
    const [result] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(bookmarks)
        .where(eq(bookmarks.userId, userId));
    return result?.total ?? 0;
}

export async function createBookmark(
    userId: string,
    bookId: string,
) {
    const [bookmark] = await db
        .insert(bookmarks)
        .values({
            userId,
            bookId,
        })
        .onConflictDoNothing({
            target: [
                bookmarks.userId,
                bookmarks.bookId,
            ],
        })
        .returning();

    return bookmark ?? null;
}

export async function deleteBookmark(
    userId: string,
    bookId: string,
) {
    const deleted = await db
        .delete(bookmarks)
        .where(
            and(
                eq(bookmarks.userId, userId),
                eq(bookmarks.bookId, bookId),
            ),
        )
        .returning({
            id: bookmarks.id,
        });

    return deleted.length > 0;
}

export async function toggleBookmark(
    userId: string,
    bookId: string,
) {
    const existing = await findBookmark(
        userId,
        bookId,
    );

    if (existing) {
        await deleteBookmark(
            userId,
            bookId,
        );

        return {
            bookmarked: false,
        } as const;
    }

    await createBookmark(
        userId,
        bookId,
    );

    return {
        bookmarked: true,
    } as const;
}

/** Saved books with public book fields and the number of AVAILABLE shared copies. */
export async function listSavedBooks(userId: string, limit = 100) {
    return db
        .select({
            bookmarkId: bookmarks.id,
            savedAt: bookmarks.createdAt,
            id: books.id,
            title: books.title,
            authors: books.authors,
            publisher: books.publisher,
            categories: books.categories,
            coverUrl: books.coverUrl,
            // Qualified names: bare column refs inside sql`` would bind to the subquery table.
            availableCopies: sql<number>`(
                select count(*)::int from "book_listings"
                where "book_listings"."bookId" = "books"."id" and "book_listings"."availability" = 'AVAILABLE'
            )`,
        })
        .from(bookmarks)
        .innerJoin(books, eq(bookmarks.bookId, books.id))
        .where(eq(bookmarks.userId, userId))
        .orderBy(desc(bookmarks.createdAt))
        .limit(Math.min(Math.max(limit, 1), 100));
}
