import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../../src/lib/db/schema";

// sitemap.xml lists only what public pages show (SEO, 29 Okt 2026).
const pg = new PGlite();
const testDb = drizzle({ client: pg, schema });
mock.module("server-only", () => ({}));
mock.module(resolve(import.meta.dir, "../../src/lib/db/client.ts"), () => ({ db: testDb }));

setDefaultTimeout(60_000);

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OWNER = id(1), VERIFIED = id(10), PENDING = id(11);

beforeAll(async () => {
    const files = (await readdir("drizzle/migrations")).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
        const sql = await readFile(`drizzle/migrations/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await pg.exec(statement);
    }
    await testDb.insert(schema.userProfiles).values({ id: OWNER, displayName: "Pemilik" });
    await testDb.insert(schema.books).values({ id: id(100), provider: "MANUAL", providerId: "a", title: "Amba" });
    await testDb.insert(schema.communities).values([
        { id: VERIFIED, ownerId: OWNER, name: "Klub Terverifikasi", status: "VERIFIED" },
        { id: PENDING, ownerId: OWNER, name: "Klub Menunggu", status: "PENDING" },
    ]);
    await testDb.insert(schema.events).values([
        { id: id(200), communityId: VERIFIED, title: "Terbit", publicationStatus: "PUBLISHED" },
        { id: id(201), communityId: VERIFIED, title: "Draf" },
        { id: id(202), communityId: PENDING, title: "Komunitas belum terverifikasi", publicationStatus: "PUBLISHED" },
    ]);
    await testDb.insert(schema.merchandiseListings).values([
        { id: id(300), communityId: VERIFIED, title: "Totebag", status: "PUBLISHED" },
        { id: id(301), communityId: VERIFIED, title: "Draf", status: "DRAFT" },
        { id: id(302), communityId: PENDING, title: "Pin", status: "PUBLISHED" },
    ]);
    await testDb.insert(schema.libraries).values([
        { id: id(400), name: "Perpustakaan Tampil" },
        { id: id(401), name: "Perpustakaan Tersembunyi", hiddenAt: new Date() },
    ]);
});

afterAll(async () => {
    await pg.close();
});

describe("sitemap entries", () => {
    test("only public pages, each with a last-modified time", async () => {
        const { listSitemapEntries } = await import("../../src/lib/db/queries/sitemap");
        const entries = await listSitemapEntries();
        const ids = (rows: { id: string }[]) => rows.map((row) => row.id);
        expect(ids(entries.books)).toEqual([id(100)]);
        expect(ids(entries.communities)).toEqual([VERIFIED]);
        expect(ids(entries.events)).toEqual([id(200)]);
        expect(ids(entries.merchandise)).toEqual([id(300)]);
        expect(ids(entries.libraries)).toEqual([id(400)]);
        expect(entries.books[0]?.updatedAt).toBeInstanceOf(Date);
    });
});
