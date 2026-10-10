import { describe, expect, test } from "bun:test";

import { pageWindow } from "@/features/books/components/catalog-pagination";
import { bookBrowseQuerySchema } from "@/lib/validation/schemas/book.schema";

describe("pageWindow", () => {
    test("shows every page when there are few", () => {
        expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    });

    test("marks gaps around the current page", () => {
        expect(pageWindow(1, 4)).toEqual([1, 2, null, 4]);
        expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    });
});

describe("bookBrowseQuerySchema", () => {
    test("treats empty filters as absent", () => {
        const result = bookBrowseQuerySchema.parse({ q: " ", category: "", page: "2" });
        expect(result).toMatchObject({ q: undefined, category: undefined, page: 2 });
    });

    test("rejects unknown parameters and oversized values", () => {
        expect(bookBrowseQuerySchema.safeParse({ sort: "x" }).success).toBe(false);
        expect(bookBrowseQuerySchema.safeParse({ category: "a".repeat(101) }).success).toBe(false);
    });
});
