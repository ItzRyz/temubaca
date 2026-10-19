import "server-only";

import { asc, eq, gt } from "drizzle-orm";

import { genres } from "@/features/books/genres";
import { db } from "@/lib/db/client";
import { books, communities } from "@/lib/db/schema";

/** Bumped only for breaking changes; new fields are additive. */
export const ML_SNAPSHOT_VERSION = 1;
export const ML_SNAPSHOT_DEFAULT_LIMIT = 500;
export const ML_SNAPSHOT_MAX_LIMIT = 1000;

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
 * Only public fields: no provider metadata, owner, contacts, or any user data.
 * Books are paged by id; communities come with the first page only.
 */
export async function getMlSnapshot({ cursor, limit = ML_SNAPSHOT_DEFAULT_LIMIT }: { cursor?: string; limit?: number } = {}) {
    const rows = await db
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
        })
        .from(books)
        .where(cursor ? gt(books.id, cursor) : undefined)
        .orderBy(asc(books.id))
        .limit(limit + 1);

    const page = rows.slice(0, limit);
    const verifiedCommunities = cursor
        ? []
        : await db
            .select({
                id: communities.id,
                name: communities.name,
                description: communities.description,
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
