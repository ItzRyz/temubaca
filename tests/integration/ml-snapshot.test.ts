import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../../src/lib/db/schema";

// TB-055 snapshot for the ML Service against an in-memory Postgres.
const pg = new PGlite();
const testDb = drizzle({ client: pg, schema });
mock.module("server-only", () => ({}));
mock.module(resolve(import.meta.dir, "../../src/lib/db/client.ts"), () => ({ db: testDb }));

setDefaultTimeout(60_000);

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OWNER = id(1), READER = id(2);
let snapshot: typeof import("../../src/features/recommendations/snapshot");

beforeAll(async () => {
    const files = (await readdir("drizzle/migrations")).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
        const sql = await readFile(`drizzle/migrations/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await pg.exec(statement);
    }

    await testDb.insert(schema.userProfiles).values([
        { id: OWNER, displayName: "Pengurus" },
        { id: READER, displayName: "Pembaca" },
    ]);
    await testDb.insert(schema.books).values([
        {
            id: id(101), provider: "OPEN_LIBRARY", providerId: "OL1W", title: "Rumah Kaca", authors: ["Pramoedya Ananta Toer"],
            categories: ["Historical fiction", "Indonesian fiction"], metadata: { raw: "provider payload" }, coverUrl: "https://example.test/c.jpg",
        },
        { id: id(102), provider: "MANUAL", providerId: "m-2", title: "Aku Ingin", authors: ["Sapardi Djoko Damono"], categories: ["Puisi"] },
        { id: id(103), provider: "MANUAL", providerId: "m-3", title: "Tanpa Genre", authors: ["Penulis"], categories: ["Earth (planet)"] },
    ]);
    await testDb.insert(schema.communities).values([
        { id: id(201), ownerId: OWNER, name: "Klub Terverifikasi", status: "VERIFIED", contactEmail: "klub@example.test", publicLocation: "Cikini" },
        { id: id(202), ownerId: OWNER, name: "Klub Menunggu", status: "PENDING" },
        { id: id(203), ownerId: OWNER, name: "Klub Ditolak", status: "REJECTED" },
        { id: id(204), ownerId: OWNER, name: "Klub Ditangguhkan", status: "SUSPENDED" },
    ]);
    await testDb.insert(schema.bookmarks).values([
        { userId: OWNER, bookId: id(101) },
        { userId: READER, bookId: id(101) },
        { userId: READER, bookId: id(102) },
    ]);
    await testDb.insert(schema.bookListings).values([
        { ownerId: OWNER, bookId: id(101), condition: "GOOD" },
        { ownerId: READER, bookId: id(101), condition: "FAIR", hiddenAt: new Date(), hiddenReason: "Uji moderasi" },
        { ownerId: READER, bookId: id(103), condition: "NEW" },
    ]);
    snapshot = await import("../../src/features/recommendations/snapshot");
});

afterAll(async () => {
    await pg.close();
});

describe("ML Service snapshot (TB-055)", () => {
    test("exports public book fields with genre labels and verified communities only", async () => {
        const result = await snapshot.getMlSnapshot();

        expect(result.version).toBe(1);
        expect(result.nextCursor).toBeNull();
        expect(result.books.map((book) => book.id)).toEqual([id(101), id(102), id(103)]);
        expect(Object.keys(result.books[0]).sort()).toEqual([
            "authors", "bookmarkCount", "categories", "description", "genres", "id", "isbn", "language", "listingCount", "provider", "publishedAt", "publisher", "title", "updatedAt",
        ]);
        expect(result.books[0].genres).toEqual(expect.arrayContaining(["Sastra Indonesia", "Fiksi Sejarah"]));
        expect(result.books[1].genres).toContain("Puisi");
        expect(result.books[2].genres).toEqual([]);

        // Aggregate counts only; the moderator-hidden listing is not counted.
        expect(result.books.map((book) => [book.bookmarkCount, book.listingCount])).toEqual([[2, 1], [1, 0], [0, 1]]);

        expect(result.communities.map((community) => community.name)).toEqual(["Klub Terverifikasi"]);
        expect(Object.keys(result.communities[0]).sort()).toEqual(["description", "id", "name", "updatedAt"]);
        expect(result.genres.length).toBeGreaterThan(0);
        expect(Object.keys(result.genres[0]).sort()).toEqual(["label", "slug"]);
    });

    test("pages books by id and sends communities with the first page only", async () => {
        const first = await snapshot.getMlSnapshot({ limit: 2 });
        expect(first.books.map((book) => book.id)).toEqual([id(101), id(102)]);
        expect(first.nextCursor).toBe(id(102));
        expect(first.communities).toHaveLength(1);

        const second = await snapshot.getMlSnapshot({ cursor: first.nextCursor!, limit: 2 });
        expect(second.books.map((book) => book.id)).toEqual([id(103)]);
        expect(second.nextCursor).toBeNull();
        expect(second.communities).toEqual([]);
    });
});
