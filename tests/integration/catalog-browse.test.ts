import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../../src/lib/db/schema";

// /books filter bar (29 Okt 2026): availability and order, against every migration.
const pg = new PGlite();
const testDb = drizzle({ client: pg, schema });
mock.module("server-only", () => ({}));
mock.module(resolve(import.meta.dir, "../../src/lib/db/client.ts"), () => ({ db: testDb }));

setDefaultTimeout(60_000);

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OWNER = id(1), SUSPENDED = id(2);
// Created oldest first: Cantik (2 copies), Amba (1 copy), Bumi (copy of a suspended owner, held by a library), Dilan (held by a hidden library).
const CANTIK = id(101), AMBA = id(102), BUMI = id(103), DILAN = id(104);
const LIBRARY = id(301), HIDDEN_LIBRARY = id(302);

let books: typeof import("../../src/lib/db/queries/books");
const titles = async (filters: Parameters<typeof books.browseBooks>[0]) => (await books.browseBooks(filters, 10, 0)).items.map((item) => item.title);

beforeAll(async () => {
    const files = (await readdir("drizzle/migrations")).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
        const sql = await readFile(`drizzle/migrations/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await pg.exec(statement);
    }
    await testDb.insert(schema.userProfiles).values([
        { id: OWNER, displayName: "Pemilik" },
        { id: SUSPENDED, displayName: "Ditangguhkan", suspendedAt: new Date(), suspendedReason: "Spam" },
    ]);
    const day = (n: number) => new Date(Date.UTC(2026, 9, n));
    await testDb.insert(schema.books).values([
        { id: CANTIK, provider: "MANUAL", providerId: "c", title: "Cantik Itu Luka", createdAt: day(1) },
        { id: AMBA, provider: "MANUAL", providerId: "a", title: "Amba", createdAt: day(2) },
        { id: BUMI, provider: "MANUAL", providerId: "b", title: "Bumi Manusia", createdAt: day(3) },
        { id: DILAN, provider: "MANUAL", providerId: "d", title: "Dilan", createdAt: day(4) },
    ]);
    await testDb.insert(schema.bookListings).values([
        { ownerId: OWNER, bookId: CANTIK, condition: "GOOD" },
        { ownerId: OWNER, bookId: CANTIK, condition: "FAIR" },
        { ownerId: OWNER, bookId: AMBA, condition: "GOOD" },
        { ownerId: OWNER, bookId: AMBA, condition: "GOOD", availability: "RESERVED" },
        { ownerId: SUSPENDED, bookId: BUMI, condition: "GOOD" },
    ]);
    await testDb.insert(schema.libraries).values([
        { id: LIBRARY, name: "Perpustakaan Uji" },
        { id: HIDDEN_LIBRARY, name: "Perpustakaan Tersembunyi", hiddenAt: new Date() },
    ]);
    await testDb.insert(schema.libraryHoldings).values([
        { libraryId: LIBRARY, bookId: BUMI, source: "CURATED" },
        { libraryId: HIDDEN_LIBRARY, bookId: DILAN, source: "CURATED" },
    ]);
    books = await import("../../src/lib/db/queries/books");
});

afterAll(async () => {
    await pg.close();
});

describe("browseBooks filters and order", () => {
    test("Ada salinan warga: an available copy from an owner who is not suspended", async () => {
        expect(await titles({ availability: "warga" })).toEqual(["Amba", "Cantik Itu Luka"]);
    });

    test("Tercatat di perpustakaan: held by a library readers can see", async () => {
        expect(await titles({ availability: "perpustakaan" })).toEqual(["Bumi Manusia"]);
    });

    test("orders: newest (default), title, and most copies", async () => {
        expect(await titles({})).toEqual(["Dilan", "Bumi Manusia", "Amba", "Cantik Itu Luka"]);
        expect(await titles({ sort: "judul" })).toEqual(["Amba", "Bumi Manusia", "Cantik Itu Luka", "Dilan"]);
        expect(await titles({ sort: "salinan" })).toEqual(["Cantik Itu Luka", "Amba", "Dilan", "Bumi Manusia"]);
        expect((await books.browseBooks({ availability: "warga" }, 10, 0)).total).toBe(2);
    });
});
