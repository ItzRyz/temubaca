import { describe, expect, test } from "bun:test";

import { genreForInterest, matchInterests } from "../../src/features/recommendations/matching";

describe("interest matching", () => {
    test("a genre label is recognised case-insensitively", () => {
        expect(genreForInterest("Sastra Indonesia")?.slug).toBe("sastra-indonesia");
        expect(genreForInterest("  fiksi sejarah ")?.slug).toBe("fiksi-sejarah");
        expect(genreForInterest("Fiction")).toBeUndefined();
    });

    test("genre interests match provider subjects through the genre pattern", () => {
        // Rumah Kaca (Open Library subjects)
        const subjects = ["Historical", "Fiction", "History", "Historical fiction", "Indonesia, fiction"];
        expect(matchInterests(subjects, ["Sastra Indonesia", "Fiksi Sejarah", "Puisi"])).toEqual(["Sastra Indonesia", "Fiksi Sejarah"]);
    });

    test("manual-entry books match the genre they were filed under", () => {
        expect(matchInterests(["Agama & Spiritualitas"], ["Agama & Spiritualitas"])).toEqual(["Agama & Spiritualitas"]);
    });

    test("raw subjects saved before genres still match exactly, not by substring", () => {
        expect(matchInterests(["Earth (planet)", "Fiction"], ["fiction"])).toEqual(["fiction"]);
        expect(matchInterests(["Historical fiction"], ["Fiction"])).toEqual([]);
    });

    test("no interests or no subjects match nothing", () => {
        expect(matchInterests([], ["Sejarah"])).toEqual([]);
        expect(matchInterests(["History"], [])).toEqual([]);
    });
});
