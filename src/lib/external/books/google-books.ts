import type { ExternalBook } from "@/lib/validation/schemas/book.schema";

import { fetchProviderJson } from "./http";
import { languageLabel } from "./language";
import { tryNormalizeExternalBook } from "./normalize";
import type { BookCatalogProvider, BookCatalogSearchResult, SearchBookCatalogInput } from "./provider";

export type GoogleVolume = {
    id?: string;
    volumeInfo?: {
        title?: string;
        subtitle?: string;
        authors?: string[];
        publisher?: string;
        publishedDate?: string;
        description?: string;
        industryIdentifiers?: { type?: string; identifier?: string }[];
        categories?: string[];
        language?: string;
        imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    };
};

/** Google returns limited HTML in descriptions; keep plain text only. */
function plainText(value: string | undefined) {
    if (!value) return undefined;
    return value
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

export function mapGoogleVolume(volume: GoogleVolume): ExternalBook | null {
    const info = volume.volumeInfo;
    if (!volume.id || !info?.title?.trim()) return null;

    const identifiers = info.industryIdentifiers ?? [];
    const isbn = identifiers.find((item) => item.type === "ISBN_13")?.identifier ?? identifiers.find((item) => item.type === "ISBN_10")?.identifier;
    const cover = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail;

    return tryNormalizeExternalBook({
        provider: "GOOGLE_BOOKS",
        providerId: volume.id,
        isbn,
        title: (info.subtitle ? `${info.title}: ${info.subtitle}` : info.title).trim().slice(0, 255),
        authors: (info.authors ?? []).slice(0, 10),
        description: plainText(info.description)?.slice(0, 10_000) || undefined,
        publisher: info.publisher?.trim().slice(0, 255) || undefined,
        publishedAt: info.publishedDate?.slice(0, 4) || undefined,
        language: languageLabel(info.language),
        categories: (info.categories ?? []).slice(0, 5).map((category) => category.slice(0, 100)),
        coverUrl: cover ? cover.replace(/^http:\/\//, "https://") : undefined,
    });
}

/** Google Books adapter; works without a key at a low shared quota, `GOOGLE_BOOKS_API_KEY` raises it. */
export function createGoogleBooksProvider(options: { apiKey?: string; fetchImpl?: typeof fetch }): BookCatalogProvider {
    function url(path: string, params: Record<string, string> = {}) {
        const target = new URL(path, "https://www.googleapis.com");
        for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
        if (options.apiKey) target.searchParams.set("key", options.apiKey);
        return target;
    }

    async function firstVolume(query: string) {
        const body = await fetchProviderJson("GOOGLE_BOOKS", url("/books/v1/volumes", { q: query, maxResults: "1" }), { fetchImpl: options.fetchImpl }) as { items?: GoogleVolume[] } | null;
        return body?.items?.[0] ? mapGoogleVolume(body.items[0]) : null;
    }

    return {
        id: "GOOGLE_BOOKS",
        async search({ query, limit, offset }: SearchBookCatalogInput): Promise<BookCatalogSearchResult> {
            const body = await fetchProviderJson("GOOGLE_BOOKS", url("/books/v1/volumes", {
                q: query,
                maxResults: String(Math.min(limit, 40)),
                startIndex: String(offset),
            }), { fetchImpl: options.fetchImpl }) as { items?: GoogleVolume[]; totalItems?: number } | null;
            const items = (body?.items ?? []).map(mapGoogleVolume).filter((item): item is ExternalBook => item !== null);
            return { items, total: body?.totalItems ?? items.length };
        },
        async getById(providerId: string) {
            if (!/^[\w-]{6,40}$/.test(providerId)) return null;
            const body = await fetchProviderJson("GOOGLE_BOOKS", url(`/books/v1/volumes/${encodeURIComponent(providerId)}`), { fetchImpl: options.fetchImpl }) as GoogleVolume | null;
            return body ? mapGoogleVolume(body) : null;
        },
        async findByIsbn(isbn: string) {
            return firstVolume(`isbn:${isbn}`);
        },
    };
}
