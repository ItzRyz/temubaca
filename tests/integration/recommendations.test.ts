import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../../src/lib/db/schema";

// Run the real recommendation queries against an in-memory Postgres with every migration applied.
const pg = new PGlite();
const testDb = drizzle({ client: pg, schema });
mock.module("server-only", () => ({}));
mock.module(resolve(import.meta.dir, "../../src/lib/db/client.ts"), () => ({ db: testDb }));

setDefaultTimeout(60_000);

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const GENRE_READER = id(1), LEGACY_READER = id(2), NEW_READER = id(3);
const RUMAH_KACA = id(101), SAMAN = id(102), PUISI = id(103), BUMI = id(104);

let recommendations: typeof import("../../src/features/recommendations/queries");
let books: typeof import("../../src/lib/db/queries/books");

beforeAll(async () => {
    const files = (await readdir("drizzle/migrations")).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
        const sql = await readFile(`drizzle/migrations/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) {
            await pg.exec(statement);
        }
    }

    await testDb.insert(schema.userProfiles).values([
        { id: GENRE_READER, displayName: "Pembaca Genre" },
        { id: LEGACY_READER, displayName: "Pembaca Lama" },
        { id: NEW_READER, displayName: "Pembaca Baru" },
    ]);
    await testDb.insert(schema.books).values([
        { id: RUMAH_KACA, provider: "MANUAL", providerId: "test-101", title: "Rumah Kaca", authors: ["Pramoedya Ananta Toer"], categories: ["Historical", "Fiction", "Historical fiction", "Indonesia, fiction"] },
        { id: SAMAN, provider: "MANUAL", providerId: "test-102", title: "Saman", authors: ["Ayu Utami"], categories: ["Man-woman relationships, fiction", "Indonesian fiction"] },
        { id: PUISI, provider: "MANUAL", providerId: "test-103", title: "Aku Ingin", authors: ["Sapardi Djoko Damono"], categories: ["Puisi"] },
        { id: BUMI, provider: "MANUAL", providerId: "test-104", title: "Bumi Manusia", authors: ["Pramoedya Ananta Toer"], categories: ["Earth (planet)", "Fiction"] },
    ]);
    await testDb.insert(schema.userInterests).values([
        { userId: GENRE_READER, subject: "Sastra Indonesia" },
        { userId: GENRE_READER, subject: "Fiksi Sejarah" },
        { userId: LEGACY_READER, subject: "Earth (planet)" },
    ]);
    // A saved book is never recommended again.
    await testDb.insert(schema.bookmarks).values({ userId: GENRE_READER, bookId: BUMI });

    recommendations = await import("../../src/features/recommendations/queries");
    books = await import("../../src/lib/db/queries/books");
});

afterAll(async () => {
    await pg.close();
});

describe("book recommendations", () => {
    test("genre interests match through the genre pattern, best match first, with the genre label as reason", async () => {
        const result = await recommendations.getBookRecommendations(GENRE_READER);
        expect(result.fallback).toBe(false);
        expect(result.items.map((book) => [book.title, book.matched])).toEqual([
            ["Rumah Kaca", ["Fiksi Sejarah", "Sastra Indonesia"]],
            ["Saman", ["Sastra Indonesia"]],
        ]);
    });

    test("an interest saved as a raw provider subject still matches exactly", async () => {
        const result = await recommendations.getBookRecommendations(LEGACY_READER);
        expect(result.fallback).toBe(false);
        expect(result.items.map((book) => [book.title, book.matched])).toEqual([["Bumi Manusia", ["Earth (planet)"]]]);
    });

    test("without interests the catalog is the fallback", async () => {
        const result = await recommendations.getBookRecommendations(NEW_READER);
        expect(result.fallback).toBe(true);
        expect(result.items.map((book) => book.title)).toEqual(["Aku Ingin", "Bumi Manusia", "Rumah Kaca", "Saman"]);
        expect(result.items.every((book) => book.matched.length === 0)).toBe(true);
    });

    test("genre suggestions are the catalog's genres, most common first", async () => {
        const facets = await books.listGenreFacets();
        expect(facets[0]).toEqual({ value: "fiksi-sastra", label: "Fiksi Sastra", total: 3 });
        expect(facets.map((facet) => facet.value)).toContain("puisi");
    });
});
