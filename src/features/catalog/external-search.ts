import "server-only";

import { and, eq, inArray, or } from "drizzle-orm";

import { providerOrder } from "@/features/settings/catalog-settings";
import { db } from "@/lib/db";
import { getCatalogSettings } from "@/lib/db/queries/settings";
import { books, bookSyncLogs } from "@/lib/db/schema";
import { BookProviderError, type ExternalBookProvider } from "@/lib/external/books";
import { getBookProviders } from "@/lib/external/books/registry";
import type { ExternalBook } from "@/lib/validation/schemas/book.schema";

import { externalSearchNotice, mergeExternalResults, type ExternalSearchFailure } from "./external-results";

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const RESULT_LIMIT = 8;

type SearchOutcome = {
    items: (ExternalBook & { localBookId: string | null })[];
    providers: ExternalBookProvider[];
    notice: ReturnType<typeof externalSearchNotice>;
};

// Open Library asks clients to cache responses; identical searches within 10 minutes reuse the result.
const cache = new Map<string, { at: number; value: Omit<SearchOutcome, "items"> & { items: ExternalBook[] } }>();

function failureKind(error: unknown): ExternalSearchFailure {
    return error instanceof BookProviderError ? error.kind : "unavailable";
}

async function searchProviders(query: string) {
    const { settings } = await getCatalogSettings();
    const order = providerOrder(settings);
    const key = `${order.join(">")}:${query.toLocaleLowerCase("id-ID")}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

    const providers = getBookProviders();
    const results: ExternalBook[][] = [];
    const failures: ExternalSearchFailure[] = [];
    const used: ExternalBookProvider[] = [];

    for (const provider of order) {
        // The fallback only runs when the primary failed or returned too little.
        if (results.flat().length >= RESULT_LIMIT) break;
        try {
            const { items } = await providers[provider].search({ query, limit: RESULT_LIMIT, offset: 0 });
            results.push(items);
            used.push(provider);
        } catch (error) {
            failures.push(failureKind(error));
        }
    }

    const items = mergeExternalResults(results[0] ?? [], results.slice(1).flat(), RESULT_LIMIT);
    const value = { items, providers: used, notice: externalSearchNotice({ itemCount: items.length, failures, providerCount: order.length }) };
    // Failures are not cached so a transient outage does not stick for ten minutes.
    if (failures.length === 0) {
        if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value!);
        cache.set(key, { at: Date.now(), value });
    }
    return value;
}

/** External catalog search for the public catalog page, marking books already in TemuBaca. */
export async function searchExternalCatalog(query: string): Promise<SearchOutcome> {
    const outcome = await searchProviders(query.trim());
    if (outcome.items.length === 0) return { ...outcome, items: [] };

    const isbns = outcome.items.map((item) => item.isbn).filter((isbn): isbn is string => Boolean(isbn));
    const local = await db
        .select({ id: books.id, provider: books.provider, providerId: books.providerId, isbn: books.isbn })
        .from(books)
        .where(or(
            ...outcome.items.map((item) => and(eq(books.provider, item.provider), eq(books.providerId, item.providerId))),
            isbns.length ? inArray(books.isbn, isbns) : undefined,
        ));

    return {
        ...outcome,
        items: outcome.items.map((item) => ({
            ...item,
            localBookId: local.find((row) => (row.provider === item.provider && row.providerId === item.providerId) || (item.isbn && row.isbn === item.isbn))?.id ?? null,
        })),
    };
}

export type ImportBookResult =
    | { status: "imported" | "existing"; bookId: string }
    | { status: "not_found" }
    | { status: "failed"; reason: ExternalSearchFailure };

/**
 * Add one provider record to the local catalog so readers can list a copy. The provider is re-queried
 * (never trusting client-sent metadata); an existing record with the same provider id or ISBN is reused.
 */
export async function importExternalBook(provider: ExternalBookProvider, providerId: string, actorId: string): Promise<ImportBookResult> {
    const existing = await db.query.books.findFirst({ where: and(eq(books.provider, provider), eq(books.providerId, providerId)), columns: { id: true } });
    if (existing) return { status: "existing", bookId: existing.id };

    let book: ExternalBook | null;
    try {
        book = await getBookProviders()[provider].getById(providerId);
    } catch (error) {
        return { status: "failed", reason: failureKind(error) };
    }
    if (!book) return { status: "not_found" };

    if (book.isbn) {
        const sameIsbn = await db.query.books.findFirst({ where: eq(books.isbn, book.isbn), columns: { id: true } });
        if (sameIsbn) return { status: "existing", bookId: sameIsbn.id };
    }

    const now = new Date();
    return db.transaction(async (tx) => {
        const [inserted] = await tx.insert(books).values({
            provider: book.provider,
            providerId: book.providerId,
            isbn: book.isbn ?? null,
            title: book.title,
            authors: book.authors,
            description: book.description ?? null,
            publisher: book.publisher ?? null,
            publishedAt: book.publishedAt ?? null,
            language: book.language ?? null,
            categories: book.categories,
            coverUrl: book.coverUrl ?? null,
            syncedAt: now,
            createdAt: now,
            updatedAt: now,
        }).onConflictDoNothing({ target: [books.provider, books.providerId] }).returning({ id: books.id });

        if (!inserted) {
            // Another request imported it a moment ago.
            const raced = await tx.query.books.findFirst({ where: and(eq(books.provider, provider), eq(books.providerId, providerId)), columns: { id: true } });
            return raced ? { status: "existing" as const, bookId: raced.id } : { status: "not_found" as const };
        }
        await tx.insert(bookSyncLogs).values({
            bookId: inserted.id, provider: book.provider, status: "SUCCESS", trigger: "IMPORT",
            changedFields: ["isbn", "title", "authors", "description", "publisher", "publishedAt", "language", "categories", "coverUrl"].filter((field) => {
                const value = book[field as keyof ExternalBook];
                return Array.isArray(value) ? value.length > 0 : Boolean(value);
            }),
            actorId, createdAt: now,
        });
        return { status: "imported" as const, bookId: inserted.id };
    });
}
