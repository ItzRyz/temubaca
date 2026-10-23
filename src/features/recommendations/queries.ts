import "server-only";

import { and, eq, inArray, notInArray, or, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { books, bookmarks } from "@/lib/db/schema";
import { listUserInterests } from "@/lib/db/queries/interests";
import { isMlServiceConfigured, ML_MAX_TOP_N, MlServiceError, recommendBooks, type MlBookRecommendation } from "@/lib/ml/client";

import { foldInterest, genreForInterest, matchInterests, savedInterestsNamed } from "./matching";

/** SQL twin of matchInterests: a genre interest uses its pattern, a raw subject (older interests) matches exactly. */
function interestCondition(subject: string) {
    const genre = genreForInterest(subject);
    return genre
        ? sql`exists (select 1 from unnest(${books.categories}) as subject where lower(subject) ~ ${genre.pattern})`
        : sql`exists (select 1 from unnest(${books.categories}) as subject where lower(trim(subject)) = ${subject.trim().toLocaleLowerCase("en")})`;
}

const RECOMMENDATION_LIMIT = 12;
const ML_REASON_PREFIX = "Sesuai dengan minat: ";

const bookColumns = {
    id: books.id,
    title: books.title,
    authors: books.authors,
    categories: books.categories,
    coverUrl: books.coverUrl,
};

/** Saved interests the ML reason names; the ML Service casefolds and trims interests before matching. */
function interestsNamedIn(reason: string, subjects: string[]) {
    if (!reason.startsWith(ML_REASON_PREFIX)) return [];
    const named = new Set(reason.slice(ML_REASON_PREFIX.length).split(", "));
    return subjects.filter((subject) => named.has(foldInterest(subject)));
}

/**
 * What the page tells the reader (TB-059): no interests saved yet, interests saved but only catalog
 * picks to show, or matches.
 */
export type BookRecommendationState = "needs_interests" | "no_match" | "ok";

/**
 * Interest matches from the ML Service, in its order, as catalog rows. Popularity items are ignored
 * for now: production has no bookmark or listing counts yet, so that order carries no signal.
 * Returns null when the service is not configured, fails, or finds no interest match.
 */
async function mlRecommendations(subjects: string[], savedIds: string[]) {
    if (!subjects.length || !isMlServiceConfigured()) return null;

    let result: { items: MlBookRecommendation[]; unmatchedInterests: string[] };
    try {
        result = await recommendBooks({ interests: subjects, topN: ML_MAX_TOP_N });
    } catch (error) {
        // Only the failure kind is logged, never the interests.
        console.error("[ML_SERVICE_ERROR]", { kind: error instanceof MlServiceError ? error.kind : "unknown" });
        return null;
    }

    const saved = new Set(savedIds);
    const picks = result.items.filter((item) => item.source === "interest" && !saved.has(item.book_id));
    if (!picks.length) return null;

    // The model can be older than the catalog: ids no longer in the database are dropped.
    const rows = await db.select(bookColumns).from(books).where(inArray(books.id, picks.map((item) => item.book_id)));
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items = picks
        .flatMap((item) => {
            const book = byId.get(item.book_id);
            if (!book) return [];
            const matched = interestsNamedIn(item.reason, subjects);
            return [{
                ...book,
                matched,
                source: "interest" as const,
                score: item.score ?? 0,
                reason: matched.length ? `Sesuai minat: ${matched.join(", ")}` : item.reason,
            }];
        })
        .slice(0, RECOMMENDATION_LIMIT);

    // The service echoes unknown interests casefolded; show them as the reader saved them.
    return items.length ? { items, unmatchedInterests: savedInterestsNamed(result.unmatchedInterests, subjects) } : null;
}

export async function getBookRecommendations(userId: string) {
    const [interests, savedBooks] = await Promise.all([
        listUserInterests(userId),
        db.select({ bookId: bookmarks.bookId })
            .from(bookmarks)
            .where(eq(bookmarks.userId, userId)),
    ]);
    const savedIds = savedBooks.map(({ bookId }) => bookId);
    const subjects = interests.map(({ subject }) => subject);

    const ml = await mlRecommendations(subjects, savedIds);
    if (ml) {
        return { interests, items: ml.items, fallback: false, state: "ok" as BookRecommendationState, engine: "ml" as const, unmatchedInterests: ml.unmatchedInterests };
    }

    const baseline = await baselineRecommendations(subjects, savedIds);
    const state: BookRecommendationState = !subjects.length ? "needs_interests" : baseline.fallback ? "no_match" : "ok";
    return { ...baseline, interests, state, engine: "baseline" as const, unmatchedInterests: [] as string[] };
}

/** TB-040 baseline: genre patterns against provider subjects, newest catalog books when nothing matches. */
async function baselineRecommendations(subjects: string[], savedIds: string[]) {
    const unsaved = savedIds.length ? notInArray(books.id, savedIds) : undefined;
    const selectCatalog = (where: ReturnType<typeof and>, limit: number) => db
        .select(bookColumns)
        .from(books)
        .where(where)
        .orderBy(books.title)
        .limit(limit);

    const candidates = subjects.length ? await selectCatalog(and(unsaved, or(...subjects.map(interestCondition))), 250) : [];
    const matches = candidates
        .map((book) => {
            const matched = matchInterests(book.categories, subjects);
            return { ...book, matched, source: "interest" as const, score: matched.length };
        })
        .filter((book) => book.score > 0)
        .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
        .slice(0, RECOMMENDATION_LIMIT)
        .map((book) => ({
            ...book,
            reason: `Sesuai minat: ${book.matched.join(", ")}`,
        }));

    if (matches.length > 0) return { items: matches, fallback: false };

    const catalog = await selectCatalog(and(unsaved), RECOMMENDATION_LIMIT);
    return {
        items: catalog.map((book) => ({
            ...book,
            matched: [] as string[],
            source: "catalog" as const,
            score: 0,
            reason: "Pilihan dari katalog TemuBaca; belum ada kecocokan minat yang cukup.",
        })),
        fallback: true,
    };
}
