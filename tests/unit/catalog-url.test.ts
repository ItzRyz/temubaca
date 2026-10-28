import { describe, expect, test } from "bun:test";

import { catalogHref } from "@/features/books/catalog-url";
import { bookBrowseQuerySchema } from "@/lib/validation/schemas/book.schema";

describe("catalog filter bar URLs (29 Okt 2026)", () => {
    const state = { q: "laut", category: "romansa", language: "Indonesia", availability: "warga" as const, sort: "judul" as const, page: 3 };

    test("changing a filter keeps the others and goes back to page 1", () => {
        expect(catalogHref(state, { category: "puisi" })).toBe("/books?q=laut&category=puisi&language=Indonesia&availability=warga&sort=judul");
        expect(catalogHref(state, { availability: undefined })).toBe("/books?q=laut&category=romansa&language=Indonesia&sort=judul");
    });

    test("pagination keeps every filter; the default order and page 1 stay out of the URL", () => {
        expect(catalogHref(state, { page: 4 })).toBe("/books?q=laut&category=romansa&language=Indonesia&availability=warga&sort=judul&page=4");
        expect(catalogHref({ sort: "terbaru", page: 1 }, { page: 1 })).toBe("/books");
    });

    test("reset keeps only the search text", () => {
        expect(catalogHref({ q: state.q })).toBe("/books?q=laut");
        expect(catalogHref({})).toBe("/books");
    });

    test("the schema takes the new availability and sort values only", () => {
        expect(bookBrowseQuerySchema.parse({ availability: "perpustakaan", sort: "salinan" })).toMatchObject({ availability: "perpustakaan", sort: "salinan" });
        expect(bookBrowseQuerySchema.safeParse({ availability: "x" }).success).toBe(false);
        expect(bookBrowseQuerySchema.safeParse({ sort: "acak" }).success).toBe(false);
    });
});
