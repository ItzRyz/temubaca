import { describe, expect, test } from "bun:test";

import { createGoogleBooksProvider, mapGoogleVolume } from "../../src/lib/external/books/google-books";
import { languageLabel } from "../../src/lib/external/books/language";
import { mergeBookMetadata, type StoredBookMetadata } from "../../src/lib/external/books/merge";
import { createOpenLibraryProvider, mapOpenLibraryDoc } from "../../src/lib/external/books/open-library";
import { BookProviderError } from "../../src/lib/external/books/provider";

const stored: StoredBookMetadata = {
    isbn: null,
    title: "Laut Bercerita",
    authors: ["Leila S. Chudori"],
    description: null,
    publisher: "KPG",
    publishedAt: null,
    language: "Indonesia",
    categories: [],
    coverUrl: null,
};

function jsonFetch(body: unknown, status = 200, calls: { url: string; headers: Headers }[] = []) {
    return (async (input: URL | RequestInfo, init?: RequestInit) => {
        calls.push({ url: String(input), headers: new Headers(init?.headers) });
        return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
}

describe("book provider mapping", () => {
    test("maps an Open Library search document", () => {
        const book = mapOpenLibraryDoc({
            key: "/works/OL123W",
            title: "Laut Bercerita",
            author_name: ["Leila S. Chudori"],
            first_publish_year: 2017,
            publisher: ["Kepustakaan Populer Gramedia"],
            isbn: ["602-424-694-1", "9786024246945"],
            language: ["ind"],
            subject: ["Fiction"],
            cover_i: 42,
        }, "Kisah aktivis 1998.");

        expect(book).toMatchObject({
            provider: "OPEN_LIBRARY",
            providerId: "OL123W",
            isbn: "9786024246945",
            publishedAt: "2017",
            language: "Indonesia",
            description: "Kisah aktivis 1998.",
            coverUrl: "https://covers.openlibrary.org/b/id/42-M.jpg",
        });
        expect(mapOpenLibraryDoc({ title: "Tanpa kunci" })).toBeNull();
    });

    test("maps a Google Books volume and strips description HTML", () => {
        const book = mapGoogleVolume({
            id: "abcDEF123",
            volumeInfo: {
                title: "Laut Bercerita",
                authors: ["Leila S. Chudori"],
                publishedDate: "2017-10-01",
                description: "<p>Kisah <b>aktivis</b> &amp; keluarga.</p>",
                industryIdentifiers: [{ type: "ISBN_10", identifier: "6024246941" }, { type: "ISBN_13", identifier: "9786024246945" }],
                language: "id",
                imageLinks: { thumbnail: "http://books.google.com/cover.jpg" },
            },
        });

        expect(book).toMatchObject({
            provider: "GOOGLE_BOOKS",
            providerId: "abcDEF123",
            isbn: "9786024246945",
            publishedAt: "2017",
            description: "Kisah aktivis & keluarga.",
            language: "Indonesia",
            coverUrl: "https://books.google.com/cover.jpg",
        });
    });

    test("labels provider language codes in Indonesian", () => {
        expect(languageLabel("eng")).toBe("Inggris");
        expect(languageLabel("/languages/ind")).toBe("Indonesia");
        expect(languageLabel("tlh")).toBe("TLH");
        expect(languageLabel(undefined)).toBeUndefined();
    });
});

describe("merging provider metadata", () => {
    test("the record's own provider overwrites, complements only fill blanks", () => {
        const primary = mapOpenLibraryDoc({ key: "/works/OL1W", title: "Laut Bercerita", publisher: ["Gramedia"], first_publish_year: 2017 });
        const complement = mapGoogleVolume({ id: "abcDEF123", volumeInfo: { title: "Judul lain", publisher: "Lain", description: "Sinopsis.", industryIdentifiers: [{ type: "ISBN_13", identifier: "9786024246945" }] } });

        const { patch, changedFields } = mergeBookMetadata(stored, { primary, complements: [complement] });

        expect(patch.publisher).toBe("Gramedia");
        expect(patch.publishedAt).toBe("2017");
        expect(patch.description).toBe("Sinopsis.");
        expect(patch.isbn).toBe("9786024246945");
        expect(patch.title).toBeUndefined();
        expect(changedFields).toEqual(["isbn", "description", "publisher", "publishedAt"]);
    });

    test("manual records keep curated values", () => {
        const complement = mapGoogleVolume({ id: "abcDEF123", volumeInfo: { title: "X", publisher: "Lain", language: "en" } });
        const { patch, changedFields } = mergeBookMetadata(stored, { complements: [complement] });

        expect(patch).toEqual({});
        expect(changedFields).toEqual([]);
    });
});

describe("provider HTTP behaviour", () => {
    test("Open Library identifies the app and looks works up by key", async () => {
        const calls: { url: string; headers: Headers }[] = [];
        const provider = createOpenLibraryProvider({
            baseUrl: "https://openlibrary.org",
            userAgent: "TemuBaca/test",
            fetchImpl: jsonFetch({ docs: [{ key: "/works/OL9W", title: "Bumi Manusia" }], description: "Novel." }, 200, calls),
        });

        const book = await provider.getById("OL9W");

        expect(book?.title).toBe("Bumi Manusia");
        expect(calls[0]?.url).toContain("q=key%3A%2Fworks%2FOL9W");
        expect(calls[0]?.headers.get("user-agent")).toBe("TemuBaca/test");
        expect(await provider.getById("../etc")).toBeNull();
    });

    test("rate limits surface as a typed provider error", async () => {
        const provider = createGoogleBooksProvider({ fetchImpl: jsonFetch({}, 429) });
        const error = await provider.findByIsbn("9786024246945").catch((reason: unknown) => reason);

        expect(error).toBeInstanceOf(BookProviderError);
        expect((error as BookProviderError).kind).toBe("rate_limit");
    });
});
