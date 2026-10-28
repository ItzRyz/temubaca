import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { parseRecordPage, parseSearchPage, toIsbn10, toIsbn13 } from "../../scripts/jaklitera/parse";

// Pages saved from perpustakaan.jakarta.go.id on 28 Okt 2026; no network in tests.
const search = readFileSync("tests/fixtures/jaklitera/search-9793062797.html", "utf8");
const record = readFileSync("tests/fixtures/jaklitera/record-INLIS000000000849154.html", "utf8");

describe("JAKLITERA parsing", () => {
    test("ISBN-10 and ISBN-13 convert both ways", () => {
        expect(toIsbn13("979-3062-79-7")).toBe("9789793062792");
        expect(toIsbn10("9789793062792")).toBe("9793062797");
        expect(toIsbn10("9786020324784")).toBe("6020324788");
        expect(toIsbn10("9791234567896")).toBeNull();
        expect(toIsbn13("bukan")).toBeNull();
    });

    test("a search page lists record numbers", () => {
        expect(parseSearchPage(search)).toEqual(["INLIS000000000860135", "INLIS000000000849154"]);
    });

    test("a record page gives ISBNs, call number, and copies per location", () => {
        expect(parseRecordPage(record)).toEqual({
            isbns: ["9789793062792"],
            callNumber: "813 AND l ; KA/813 AND l",
            groups: [{ locations: ["Perpustakaan Jakarta - Cikini"], borrowable: 0, onSite: 1, onLoan: 0 }],
        });
        expect(parseRecordPage("<html></html>")).toEqual({ isbns: [], callNumber: null, groups: [] });
    });
});
