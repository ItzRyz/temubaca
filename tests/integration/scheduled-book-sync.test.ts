import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../../src/lib/db/schema";

// DEC-06 periodic refresh against an in-memory Postgres; providers are stubs, no network.
const pg = new PGlite();
const testDb = drizzle({ client: pg, schema });
mock.module("server-only", () => ({}));
mock.module(resolve(import.meta.dir, "../../src/lib/db/client.ts"), () => ({ db: testDb }));

const calls: string[] = [];
const record = (providerId: string) => ({
    provider: "OPEN_LIBRARY" as const, providerId, title: `Judul ${providerId}`, authors: ["Penulis"], categories: [], description: `Sinopsis ${providerId}`,
});
mock.module(resolve(import.meta.dir, "../../src/lib/external/books/registry.ts"), () => ({
    getBookProviders: () => ({
        OPEN_LIBRARY: {
            id: "OPEN_LIBRARY",
            getById: async (providerId: string) => {
                calls.push(providerId);
                if (providerId === "OL-GONE") return null;
                return record(providerId);
            },
            findByIsbn: async () => null,
            search: async () => ({ items: [], total: 0 }),
        },
        GOOGLE_BOOKS: { id: "GOOGLE_BOOKS", getById: async () => null, findByIsbn: async () => null, search: async () => ({ items: [], total: 0 }) },
    }),
    hasGoogleBooksKey: () => false,
}));

setDefaultTimeout(60_000);

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-19T19:00:00Z");
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let sync: typeof import("../../src/features/catalog/sync-book");

beforeAll(async () => {
    const files = (await readdir("drizzle/migrations")).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
        const sql = await readFile(`drizzle/migrations/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await pg.exec(statement);
    }
    const book = (n: number, providerId: string, syncedDaysAgo: number, provider: "OPEN_LIBRARY" | "MANUAL" = "OPEN_LIBRARY") => ({
        id: id(n), provider, providerId, title: `Judul ${providerId}`, authors: ["Penulis"],
        syncedAt: new Date(now.getTime() - syncedDaysAgo * DAY), createdAt: new Date(now.getTime() - 90 * DAY),
    });
    await testDb.insert(schema.books).values([
        book(1, "OL-OLDEST", 60),
        book(2, "OL-STALE", 40),
        book(3, "OL-FRESH", 5),
        book(4, "OL-GONE", 45),
        book(5, "manual-1", 80, "MANUAL"),
    ]);
    sync = await import("../../src/features/catalog/sync-book");
});

afterAll(async () => {
    await pg.close();
});

describe("scheduled catalog refresh (DEC-06)", () => {
    test("refreshes provider records older than the stale threshold, oldest first", async () => {
        const summary = await sync.resyncStaleBooks(now, { limit: 10 });
        expect(calls).toEqual(["OL-OLDEST", "OL-GONE", "OL-STALE"]);
        expect(summary).toEqual({ checked: 3, updated: 2, unchanged: 0, failed: 1 });

        const refreshed = await testDb.query.books.findFirst({ where: eq(schema.books.id, id(1)) });
        expect(refreshed?.description).toBe("Sinopsis OL-OLDEST");
        const logs = await testDb.query.bookSyncLogs.findMany({ where: eq(schema.bookSyncLogs.bookId, id(1)) });
        expect(logs.map((log) => [log.trigger, log.status, log.actorId])).toEqual([["SCHEDULED", "SUCCESS", null]]);
    });

    test("a record that just failed is not retried the next day", async () => {
        calls.length = 0;
        const summary = await sync.resyncStaleBooks(new Date(now.getTime() + DAY), { limit: 10 });
        expect(calls).toEqual([]);
        expect(summary.checked).toBe(0);
    });

    test("the batch limit is respected", async () => {
        calls.length = 0;
        await testDb.update(schema.books).set({ syncedAt: new Date(now.getTime() - 50 * DAY) }).where(eq(schema.books.id, id(3)));
        await testDb.update(schema.books).set({ syncedAt: new Date(now.getTime() - 50 * DAY) }).where(eq(schema.books.id, id(1)));
        const summary = await sync.resyncStaleBooks(new Date(now.getTime() + DAY), { limit: 1 });
        expect(summary.checked).toBe(1);
        expect(calls).toHaveLength(1);
    });
});
