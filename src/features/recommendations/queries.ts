import "server-only";

import { and, eq, notInArray, or, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { books, bookmarks } from "@/lib/db/schema";
import { listUserInterests } from "@/lib/db/queries/interests";

import { genreForInterest, matchInterests } from "./matching";

/** SQL twin of matchInterests: a genre interest uses its pattern, a raw subject (older interests) matches exactly. */
function interestCondition(subject: string) {
    const genre = genreForInterest(subject);
    return genre
        ? sql`exists (select 1 from unnest(${books.categories}) as subject where lower(subject) ~ ${genre.pattern})`
        : sql`exists (select 1 from unnest(${books.categories}) as subject where lower(trim(subject)) = ${subject.trim().toLocaleLowerCase("en")})`;
}

export async function getBookRecommendations(userId: string) {
    const [interests, savedBooks] = await Promise.all([
        listUserInterests(userId),
        db.select({ bookId: bookmarks.bookId })
            .from(bookmarks)
            .where(eq(bookmarks.userId, userId)),
    ]);
    const savedIds = savedBooks.map(({ bookId }) => bookId);
    const unsaved = savedIds.length ? notInArray(books.id, savedIds) : undefined;
    const selectCatalog = (where: ReturnType<typeof and>, limit: number) => db
        .select({
            id: books.id,
            title: books.title,
            authors: books.authors,
            categories: books.categories,
            coverUrl: books.coverUrl,
        })
        .from(books)
        .where(where)
        .orderBy(books.title)
        .limit(limit);

    const subjects = interests.map(({ subject }) => subject);
    const candidates = subjects.length ? await selectCatalog(and(unsaved, or(...subjects.map(interestCondition))), 250) : [];
    const matches = candidates
        .map((book) => {
            const matched = matchInterests(book.categories, subjects);
            return { ...book, matched, score: matched.length };
        })
        .filter((book) => book.score > 0)
        .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
        .slice(0, 12)
        .map((book) => ({
            ...book,
            reason: `Sesuai minat: ${book.matched.join(", ")}`,
        }));

    if (matches.length > 0) return { interests, items: matches, fallback: false };

    const catalog = await selectCatalog(and(unsaved), 12);
    return {
        interests,
        items: catalog.map((book) => ({
            ...book,
            matched: [] as string[],
            score: 0,
            reason: "Pilihan dari katalog TemuBaca; belum ada kecocokan minat yang cukup.",
        })),
        fallback: true,
    };
}
