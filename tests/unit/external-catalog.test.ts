import { describe, expect, test } from "bun:test";

import { safeNextPath } from "../../src/features/auth/safe-next-path";
import { externalSearchNotice, mergeExternalResults } from "../../src/features/catalog/external-results";
import { externalBookImportSchema } from "../../src/lib/validation/schemas/book.schema";
import type { ExternalBook } from "../../src/lib/validation/schemas/book.schema";

const book = (overrides: Partial<ExternalBook>): ExternalBook => ({
    provider: "OPEN_LIBRARY",
    providerId: "OL1W",
    title: "Laut Bercerita",
    authors: ["Leila S. Chudori"],
    categories: [],
    ...overrides,
} as ExternalBook);

describe("external catalog search", () => {
    test("keeps primary results and adds only new books from the fallback", () => {
        const merged = mergeExternalResults(
            [book({ providerId: "OL1W", isbn: "9786024246945" }), book({ providerId: "OL2W", title: "Pulang", isbn: undefined })],
            [
                book({ provider: "GOOGLE_BOOKS", providerId: "g1", isbn: "9786024246945" }),
                book({ provider: "GOOGLE_BOOKS", providerId: "g2", title: "Pulang: Sebuah Novel", isbn: undefined }),
                book({ provider: "GOOGLE_BOOKS", providerId: "g3", title: "Amba", authors: ["Laksmi Pamuntjak"] }),
            ],
            8,
        );
        expect(merged.map((item) => item.providerId)).toEqual(["OL1W", "OL2W", "g3"]);
        expect(mergeExternalResults([book({}), book({ providerId: "OL9W", title: "Lain" })], [], 1)).toHaveLength(1);
    });

    test("explains empty and failed searches without blaming a partial outage", () => {
        expect(externalSearchNotice({ itemCount: 3, failures: ["timeout"], providerCount: 2 })).toBeNull();
        expect(externalSearchNotice({ itemCount: 0, failures: [], providerCount: 2 })).toBe("empty");
        expect(externalSearchNotice({ itemCount: 0, failures: ["timeout"], providerCount: 2 })).toBe("empty");
        expect(externalSearchNotice({ itemCount: 0, failures: ["timeout", "timeout"], providerCount: 2 })).toBe("timeout");
        expect(externalSearchNotice({ itemCount: 0, failures: ["rate_limit"], providerCount: 1 })).toBe("rate_limit");
        expect(externalSearchNotice({ itemCount: 0, failures: ["timeout", "unavailable"], providerCount: 2 })).toBe("unavailable");
    });

    test("imports accept only known providers and plain ids", () => {
        expect(externalBookImportSchema.safeParse({ provider: "OPEN_LIBRARY", providerId: "OL123W" }).success).toBe(true);
        expect(externalBookImportSchema.safeParse({ provider: "MANUAL", providerId: "x" }).success).toBe(false);
        expect(externalBookImportSchema.safeParse({ provider: "GOOGLE_BOOKS", providerId: "../admin" }).success).toBe(false);
    });

    test("post-login redirects stay on this site", () => {
        expect(safeNextPath("/books?q=laut")).toBe("/books?q=laut");
        expect(safeNextPath("//evil.example")).toBeUndefined();
        expect(safeNextPath("https://evil.example")).toBeUndefined();
        expect(safeNextPath("/\\evil.example")).toBeUndefined();
        expect(safeNextPath("/a\nb")).toBeUndefined();
        expect(safeNextPath(undefined)).toBeUndefined();
    });
});
