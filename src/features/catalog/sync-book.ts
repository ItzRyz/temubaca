import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { books, bookSyncLogs } from "@/lib/db/schema";
import { BookProviderError, mergeBookMetadata, type ExternalBookProvider } from "@/lib/external/books";
import { getBookProviders } from "@/lib/external/books/registry";
import type { ExternalBook } from "@/lib/validation/schemas/book.schema";

const externalProviders: ExternalBookProvider[] = ["OPEN_LIBRARY", "GOOGLE_BOOKS"];

const providerNames: Record<ExternalBookProvider, string> = { OPEN_LIBRARY: "Open Library", GOOGLE_BOOKS: "Google Books" };

function failureText(provider: ExternalBookProvider, error: unknown) {
    const kind = error instanceof BookProviderError ? error.kind : "unavailable";
    const reason = {
        timeout: "tidak merespons tepat waktu",
        rate_limit: "membatasi permintaan, coba lagi nanti",
        unavailable: "sedang tidak dapat dihubungi",
        invalid_response: "mengirim data yang tidak dapat dibaca",
    }[kind];
    return `${providerNames[provider]} ${reason}.`;
}

function normalized(value: string | undefined) {
    return (value ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Accept a search hit only when the main title and the first author match after normalisation. */
function isSameBook(candidate: Pick<ExternalBook, "title" | "authors">, title: string, author: string | undefined) {
    const sameTitle = normalized(candidate.title.split(":")[0]) === normalized(title.split(":")[0]);
    const sameAuthor = !author || candidate.authors.some((name) => normalized(name) === normalized(author));
    return sameTitle && sameAuthor;
}

export type SyncBookResult =
    | { status: "not_found" }
    | { status: "SUCCESS" | "FAILED"; changedFields: string[]; message: string | null };

/**
 * Refresh one stored record. The record's own provider is authoritative; the other provider,
 * matched by ISBN, only fills gaps. Manual records are completed but never overwritten; without
 * an ISBN they are first matched by exact title and first author.
 * Every attempt is logged, success or not.
 */
export async function syncBook(bookId: string, actorId: string, trigger: "MANUAL" | "IMPORT" = "MANUAL"): Promise<SyncBookResult> {
    const book = await db.query.books.findFirst({ where: eq(books.id, bookId) });
    if (!book) return { status: "not_found" };

    const providers = getBookProviders();
    const ownProvider = externalProviders.includes(book.provider as ExternalBookProvider) ? book.provider as ExternalBookProvider : null;
    const notes: string[] = [];
    let primary: ExternalBook | null = null;
    let failed: string | null = null;

    if (ownProvider) {
        try {
            primary = await providers[ownProvider].getById(book.providerId);
            if (!primary) failed = `Rekaman tidak lagi ditemukan di ${providerNames[ownProvider]}.`;
        } catch (error) {
            failed = failureText(ownProvider, error);
        }
    }

    let isbn = book.isbn ?? primary?.isbn ?? null;
    const complements: ExternalBook[] = [];

    // Manual records often lack an ISBN: find the book by exact title + author first, then use its ISBN.
    if (!failed && !ownProvider && !isbn) {
        for (const provider of externalProviders) {
            try {
                const { items } = await providers[provider].search({ query: `${book.title} ${book.authors[0] ?? ""}`.trim(), limit: 5, offset: 0 });
                const match = items.find((item) => isSameBook(item, book.title, book.authors[0]));
                if (match) {
                    complements.push(match);
                    isbn = match.isbn ?? null;
                    break;
                }
            } catch (error) {
                notes.push(failureText(provider, error));
            }
        }
        if (complements.length === 0) failed = notes.length ? notes.join(" ") : "Tidak ada rekaman provider dengan judul dan penulis yang sama persis.";
    }

    if (!failed) {
        if (isbn) {
            for (const provider of externalProviders.filter((value) => value !== ownProvider && !complements.some((item) => item.provider === value))) {
                try {
                    const match = await providers[provider].findByIsbn(isbn);
                    if (match) complements.push(match);
                    else notes.push(`${providerNames[provider]}: tidak ada data untuk ISBN ini.`);
                } catch (error) {
                    // A complement failing should not block the primary refresh.
                    notes.push(failureText(provider, error));
                }
            }
        }
    }

    const logProvider = ownProvider ?? complements[0]?.provider ?? "OPEN_LIBRARY";
    const now = new Date();

    if (failed) {
        await db.insert(bookSyncLogs).values({ bookId, provider: logProvider, status: "FAILED", trigger, message: failed, actorId, createdAt: now });
        return { status: "FAILED", changedFields: [], message: failed };
    }

    const { patch, changedFields } = mergeBookMetadata({
        isbn: book.isbn,
        title: book.title,
        authors: book.authors,
        description: book.description,
        publisher: book.publisher,
        publishedAt: book.publishedAt,
        language: book.language,
        categories: book.categories,
        coverUrl: book.coverUrl,
    }, { primary, complements });

    const message = notes.length ? notes.join(" ") : null;
    await db.transaction(async (tx) => {
        await tx.update(books).set({ ...patch, syncedAt: now, ...(changedFields.length ? { updatedAt: now } : {}) }).where(eq(books.id, bookId));
        await tx.insert(bookSyncLogs).values({ bookId, provider: logProvider, status: "SUCCESS", trigger, changedFields, message, actorId, createdAt: now });
    });
    return { status: "SUCCESS", changedFields, message };
}
