import type { ExternalBook } from "@/lib/validation/schemas/book.schema";

import { fetchProviderJson } from "./http";
import { languageLabel } from "./language";
import { tryNormalizeExternalBook } from "./normalize";
import type { BookCatalogProvider, BookCatalogSearchResult, SearchBookCatalogInput } from "./provider";

const SEARCH_FIELDS = "key,title,author_name,first_publish_year,publish_year,publisher,isbn,language,subject,cover_i";

export type OpenLibraryDoc = {
    key?: string;
    title?: string;
    author_name?: string[];
    first_publish_year?: number;
    publish_year?: number[];
    publisher?: string[];
    isbn?: string[];
    language?: string[];
    subject?: string[];
    cover_i?: number;
};

function pickIsbn(values: string[] | undefined) {
    const cleaned = (values ?? []).map((value) => value.replace(/[-\s]/g, "")).filter((value) => /^(?:\d{9}[\dX]|\d{13})$/.test(value));
    return cleaned.find((value) => value.length === 13) ?? cleaned[0];
}

function descriptionText(value: unknown) {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && typeof (value as { value?: unknown }).value === "string") return (value as { value: string }).value;
    return undefined;
}

/** Map one `search.json` document (plus the optional work description) to the canonical shape. */
export function mapOpenLibraryDoc(doc: OpenLibraryDoc, description?: string): ExternalBook | null {
    const workId = doc.key?.replace(/^\/works\//, "");
    if (!workId || !doc.title?.trim()) return null;

    return tryNormalizeExternalBook({
        provider: "OPEN_LIBRARY",
        providerId: workId,
        isbn: pickIsbn(doc.isbn),
        title: doc.title.trim().slice(0, 255),
        authors: (doc.author_name ?? []).slice(0, 10),
        description: description?.trim().slice(0, 10_000) || undefined,
        publisher: doc.publisher?.[0]?.trim().slice(0, 255) || undefined,
        publishedAt: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
        language: languageLabel(doc.language?.[0]),
        categories: (doc.subject ?? []).slice(0, 5).map((subject) => subject.slice(0, 100)),
        coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined,
    });
}

/**
 * Open Library adapter. Requests identify the app via User-Agent as Open Library asks, and
 * stay human-triggered (search and admin re-sync), never bulk crawling.
 */
export function createOpenLibraryProvider(options: { baseUrl: string; userAgent: string; fetchImpl?: typeof fetch }): BookCatalogProvider {
    const headers = { "user-agent": options.userAgent };

    async function searchDocs(params: Record<string, string>) {
        const url = new URL("/search.json", options.baseUrl);
        for (const [key, value] of Object.entries({ ...params, fields: SEARCH_FIELDS })) url.searchParams.set(key, value);
        const body = await fetchProviderJson("OPEN_LIBRARY", url, { headers, fetchImpl: options.fetchImpl }) as { docs?: OpenLibraryDoc[]; numFound?: number } | null;
        return { docs: Array.isArray(body?.docs) ? body.docs : [], total: typeof body?.numFound === "number" ? body.numFound : 0 };
    }

    async function workDescription(workId: string) {
        const body = await fetchProviderJson("OPEN_LIBRARY", new URL(`/works/${encodeURIComponent(workId)}.json`, options.baseUrl), { headers, fetchImpl: options.fetchImpl }) as { description?: unknown } | null;
        return descriptionText(body?.description);
    }

    async function withDescription(doc: OpenLibraryDoc | undefined) {
        if (!doc?.key) return null;
        const description = await workDescription(doc.key.replace(/^\/works\//, ""));
        return mapOpenLibraryDoc(doc, description);
    }

    return {
        id: "OPEN_LIBRARY",
        async search({ query, limit, offset }: SearchBookCatalogInput): Promise<BookCatalogSearchResult> {
            const { docs, total } = await searchDocs({ q: query, limit: String(limit), offset: String(offset) });
            return { items: docs.map((doc) => mapOpenLibraryDoc(doc)).filter((item): item is ExternalBook => item !== null), total };
        },
        async getById(providerId: string) {
            if (!/^OL\d+W$/.test(providerId)) return null;
            const { docs } = await searchDocs({ q: `key:/works/${providerId}`, limit: "1" });
            return withDescription(docs[0]);
        },
        async findByIsbn(isbn: string) {
            const { docs } = await searchDocs({ isbn, limit: "1" });
            return withDescription(docs[0]);
        },
    };
}
