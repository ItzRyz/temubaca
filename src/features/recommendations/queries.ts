import "server-only";

import { eq, notInArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { books, bookmarks } from "@/lib/db/schema";
import { listUserInterests } from "@/lib/db/queries/interests";

export async function getBookRecommendations(userId: string) {
    const [interests, savedBooks] = await Promise.all([
        listUserInterests(userId),
        db.select({ bookId: bookmarks.bookId })
            .from(bookmarks)
            .where(eq(bookmarks.userId, userId)),
    ]);
    const savedIds = savedBooks.map(({ bookId }) => bookId);
    const catalog = await db
        .select({
            id: books.id,
            title: books.title,
            authors: books.authors,
            categories: books.categories,
            coverUrl: books.coverUrl,
        })
        .from(books)
        .where(savedIds.length ? notInArray(books.id, savedIds) : undefined)
        .orderBy(books.title)
        .limit(250);

    const normalizedInterests = interests.map(({ subject }) => subject.trim().toLocaleLowerCase());
    const ranked = catalog.map((book) => {
        const matched = book.categories.filter((category) =>
            normalizedInterests.includes(category.trim().toLocaleLowerCase()),
        );
        return { ...book, matched, score: matched.length };
    });
    const matches = ranked
        .filter((book) => book.score > 0)
        .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
        .slice(0, 12)
        .map((book) => ({
            ...book,
            reason: `Sesuai minat: ${book.matched.join(", ")}`,
        }));

    if (matches.length > 0) return { interests, items: matches, fallback: false };

    return {
        interests,
        items: ranked.slice(0, 12).map((book) => ({
            ...book,
            reason: "Pilihan dari katalog TemuBaca; belum ada kecocokan minat yang cukup.",
        })),
        fallback: true,
    };
}
