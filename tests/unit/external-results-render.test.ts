import { describe, expect, mock, test } from "bun:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// The import button is a client component that needs the Next router; the failure states never render it.
mock.module("../../src/features/catalog/components/import-book-button", () => ({ ImportBookButton: () => null }));

const { ExternalResults } = await import("../../src/features/catalog/components/external-results");

function render(outcome: Parameters<typeof ExternalResults>[0]["outcome"]) {
    return renderToStaticMarkup(createElement(ExternalResults, { query: "laskar", outcome, isAuthenticated: false, returnTo: "/books?q=laskar" }));
}

describe("Dari katalog terbuka failure states (TB-021)", () => {
    const cases = [
        ["empty", "Tidak ditemukan juga di katalog terbuka"],
        ["timeout", "tidak merespons tepat waktu"],
        ["rate_limit", "sedang membatasi permintaan"],
        ["unavailable", "sedang tidak dapat dihubungi"],
        ["invalid_response", "data yang tidak dapat dibaca"],
    ] as const;

    for (const [notice, text] of cases) {
        test(`${notice} shows a polite status message and no result list`, () => {
            const html = render({ items: [], providers: ["OPEN_LIBRARY"], notice } as never);
            expect(html).toContain('role="status"');
            expect(html).toContain(text);
            expect(html).not.toContain("<ul");
        });
    }

    test("our own rate limit reads like the provider one and names both providers", () => {
        const html = render({ limited: true });
        expect(html).toContain("sedang membatasi permintaan");
        expect(html).toContain("Open Library dan Google Books");
    });
});
