import { afterEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";

import { institutionKey, parseRecordLocation, parseSearchRss, repositoryOf, toIsbn13 } from "../../src/features/libraries/onesearch";

mock.module("server-only", () => ({}));
const { findOneSearchHoldings, OneSearchError } = await import("../../src/lib/external/libraries/onesearch");

// Pages saved from onesearch.id on 28 Okt 2026 (ISBN 9789793062792, Laskar Pelangi); no network in tests.
const rss = readFileSync("tests/fixtures/onesearch/search-9789793062792.rss", "utf8");
const record = readFileSync("tests/fixtures/onesearch/record-IOS19238.176648-4.html", "utf8");

describe("OneSearch parsing", () => {
    test("ISBN-10 becomes ISBN-13; anything else is refused", () => {
        expect(toIsbn13("979-3062-79-7")).toBe("9789793062792");
        expect(toIsbn13("0-306-40615-2")).toBe("9780306406157");
        expect(toIsbn13("978-979-3062-79-2")).toBe("9789793062792");
        expect(toIsbn13("bukan isbn")).toBeNull();
        expect(toIsbn13(null)).toBeNull();
    });

    test("the search RSS gives record ids, grouped by repository", () => {
        const { total, recordIds } = parseSearchRss(rss);
        expect(total).toBe(67);
        expect(recordIds).toHaveLength(50);
        expect(recordIds[0]).toBe("IOS19238.176648-4");
        expect(repositoryOf("IOS19238.176648-4")).toBe("IOS19238");
        expect(new Set(recordIds.map(repositoryOf)).size).toBeGreaterThan(5);
    });

    test("a record page names the building and the institution", () => {
        expect(parseRecordLocation(record)).toEqual({
            building: "Perpustakaan Dinas Perpustakaan dan Kearsipan Kota Surabaya",
            institution: "DINAS PERPUSTAKAAN DAN KEARSIPAN KOTA SURABAYA",
            city: "Kota Surabaya",
            province: "Jawa Timur",
        });
        expect(parseRecordLocation("<html></html>")).toEqual({ building: null, institution: null, city: null, province: null });
    });
});

describe("OneSearch lookup", () => {
    const original = process.env.ONESEARCH_ENABLED;
    afterEach(() => {
        process.env.ONESEARCH_ENABLED = original;
    });
    const institutions = new Map([[institutionKey("Dinas Perpustakaan dan Kearsipan Kota Surabaya"), "library-surabaya"]]);

    test("stays off until ONESEARCH_ENABLED is true", async () => {
        process.env.ONESEARCH_ENABLED = "";
        const fetchImpl = mock(async () => new Response(rss));
        await expect(findOneSearchHoldings("9789793062792", institutions, { userAgent: "TemuBaca/test", fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toBeInstanceOf(OneSearchError);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    test("one search page, at most eight record pages, matched on institution; requests identify TemuBaca", async () => {
        process.env.ONESEARCH_ENABLED = "true";
        const urls: string[] = [];
        const agents = new Set<string>();
        const fetchImpl = mock(async (url: string, init?: RequestInit) => {
            urls.push(url);
            agents.add(new Headers(init?.headers).get("user-agent") ?? "");
            return new Response(url.includes("/Search/") ? rss : url.includes("IOS19238") ? record : "<html></html>");
        });
        const found = await findOneSearchHoldings("978-979-3062-79-2", institutions, { userAgent: "TemuBaca/test", fetchImpl: fetchImpl as unknown as typeof fetch, pauseMs: 0 });
        expect(found).toEqual([{ libraryId: "library-surabaya", sourceRecordId: "IOS19238.176648-4", sourceUrl: "https://onesearch.id/Record/IOS19238.176648-4" }]);
        expect(urls[0]).toBe("https://onesearch.id/Search/Results?lookfor=9789793062792&type=ISN&view=rss");
        expect(urls.length).toBeLessThanOrEqual(9);
        expect([...agents]).toEqual(["TemuBaca/test"]);
    });

    test("a refusal is reported, not swallowed", async () => {
        process.env.ONESEARCH_ENABLED = "true";
        const fetchImpl = mock(async () => new Response("", { status: 403 }));
        await expect(findOneSearchHoldings("9789793062792", institutions, { userAgent: "TemuBaca/test", fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toThrow("menolak");
    });
});
