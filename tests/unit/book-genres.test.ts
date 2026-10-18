import { describe, expect, test } from "bun:test";

import { genreBySlug, genres, genresForSubjects, primaryGenreLabel } from "../../src/features/books/genres";

const labels = (subjects: string[]) => genresForSubjects(subjects).map((genre) => genre.label);

describe("catalog genres", () => {
    test("provider subjects from the real catalog map to Indonesian genres", () => {
        // Bumi Manusia (Open Library): noise subjects are ignored.
        expect(labels(["Young men", "Fiction", "History", "New York Times reviewed", "Earth (planet)"])).toEqual(["Fiksi Sastra", "Sejarah"]);
        // Rumah Kaca
        expect(labels(["Historical", "Fiction", "History", "Historical fiction", "Indonesia, fiction"])).toEqual(["Sastra Indonesia", "Fiksi Sastra", "Fiksi Sejarah", "Sejarah"]);
        // Saman
        expect(labels(["Fiction, romance, erotic", "Man-woman relationships, fiction", "Literature", "Indonesian fiction", "Translations into English"]))
            .toEqual(["Sastra Indonesia", "Fiksi Sastra", "Romansa"]);
        // Laskar Pelangi
        expect(labels(["Roman", "Indonesia", "Education", "Poverty", "Friendship"])).toEqual(["Sastra Indonesia", "Fiksi Sastra", "Persahabatan", "Pendidikan", "Isu Sosial"]);
        // Cantik Itu Luka
        expect(labels(["General Fiction", "Fiction and Literature", "Fiction, family life", "Indonesia, fiction", "Mothers and daughters, fiction"]))
            .toEqual(["Sastra Indonesia", "Fiksi Sastra", "Keluarga"]);
    });

    test("manual-entry genres from Tambah Buku match themselves", () => {
        for (const label of ["Fiksi Sastra", "Fiksi Sejarah", "Puisi", "Nonfiksi", "Filsafat", "Biografi", "Anak & Remaja", "Agama & Spiritualitas", "Komik & Novel Grafis"]) {
            expect(labels([label])).toContain(label);
        }
        expect(labels(["Lainnya"])).toEqual([]);
    });

    test("subjects that are not genres give no chip", () => {
        expect(primaryGenreLabel(["Earth (planet)", "New York Times reviewed", "Translations into English"])).toBeNull();
        expect(primaryGenreLabel([])).toBeNull();
    });

    test("slugs are unique and every pattern is a valid regular expression", () => {
        expect(new Set(genres.map((genre) => genre.slug)).size).toBe(genres.length);
        for (const genre of genres) expect(() => new RegExp(genre.pattern)).not.toThrow();
        expect(genreBySlug("sejarah")?.label).toBe("Sejarah");
        expect(genreBySlug("History")).toBeUndefined();
    });
});
