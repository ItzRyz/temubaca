import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import { applyRows, countSeedRows, deleteSeedRows, findCleanupBlockers, readReference, readSeedMeta, referenceFingerprint } from "../../scripts/seed/apply";
import { SEED_PROFILES } from "../../scripts/seed/config";
import { countRows, generateSeed } from "../../scripts/seed/generate";
import { seedId } from "../../scripts/seed/ids";
import { runSqlChecks, type AnyDb } from "../../scripts/seed/validate";
import * as schema from "../../src/lib/db/schema";

// The seeder on an in-memory Postgres with every migration: write, rerun, check, clean up.
const pg = new PGlite();
const db = drizzle({ client: pg, schema }) as unknown as AnyDb;
setDefaultTimeout(120_000);

const REAL_USER = "00000000-0000-4000-8000-000000000100";
const REAL_BOOK = "00000000-0000-4000-8000-000000000200";
const anchor = new Date("2026-10-27T00:00:00Z");
const profile = SEED_PROFILES.small;

async function generate() {
    const reference = await readReference(db);
    return generateSeed({ profile, anchor, ...reference, reference: referenceFingerprint(reference) });
}

beforeAll(async () => {
    const files = (await readdir("drizzle/migrations")).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
        const text = await readFile(`drizzle/migrations/${file}`, "utf8");
        for (const statement of text.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await pg.exec(statement);
    }
    // App data that must survive: a real account, a real book, and curated places.
    await db.insert(schema.userProfiles).values({ id: REAL_USER, displayName: "Akun Asli" });
    await db.insert(schema.books).values({ id: REAL_BOOK, provider: "OPEN_LIBRARY", providerId: "OL1W", title: "Buku Asli", authors: ["Penulis"] });
    await db.insert(schema.places).values([
        { id: "00000000-0000-4000-8000-000000000301", type: "MEETING_POINT", name: "RPTRA Uji", addressPublic: "Jalan Uji", regionCode: "31.74", latitude: -6.25, longitude: 106.8 },
        { id: "00000000-0000-4000-8000-000000000302", type: "LIBRARY", name: "Perpustakaan Uji", addressPublic: null, regionCode: "36.71", latitude: -6.18, longitude: 106.63 },
    ]);
});

describe("seeder on Postgres", () => {
    test("applies every row, then a rerun inserts nothing", async () => {
        const { rows } = await generate();
        const first = await applyRows(db, rows, { batchSize: profile.batchSize, maxRetries: 0 });
        expect(first.every((result) => result.skipped === 0)).toBe(true);
        expect(await countSeedRows(db)).toEqual(countRows(rows));

        const again = await generate();
        const second = await applyRows(db, again.rows, { batchSize: 50, maxRetries: 0 });
        expect(second.reduce((sum, result) => sum + result.inserted, 0)).toBe(0);
        expect(await readSeedMeta(db)).toMatchObject({ profile: "small", anchor: anchor.toISOString() });
    });

    test("every SQL integrity and business rule check passes", async () => {
        const failed = (await runSqlChecks(db)).filter((result) => result.violations > 0).map((result) => `${result.check.name}: ${result.violations}`);
        expect(failed).toEqual([]);
    });

    test("resumes a partial run: a missing table is filled in", async () => {
        await pg.exec(`delete from admin_audit_logs where id::text like '5eed0001-%'`);
        const { rows } = await generate();
        const results = await applyRows(db, rows, { batchSize: profile.batchSize, maxRetries: 0 });
        expect(results.find((result) => result.table === "admin_audit_logs")!.inserted).toBe(rows.admin_audit_logs.length);
        expect(results.filter((result) => result.table !== "admin_audit_logs").every((result) => result.inserted === 0)).toBe(true);
    });

    test("cleanup refuses while app data points at seed rows", async () => {
        await db.insert(schema.bookmarks).values({ userId: REAL_USER, bookId: seedId("books", 0) });
        expect(await findCleanupBlockers(db)).toEqual([{ where: "bookmarks.bookId", rows: 1 }]);
        await pg.exec(`delete from bookmarks where "userId" = '${REAL_USER}'`);
        expect(await findCleanupBlockers(db)).toEqual([]);
    });

    test("cleanup removes seed rows only", async () => {
        await deleteSeedRows(db);
        expect(Object.values(await countSeedRows(db)).every((n) => n === 0)).toBe(true);
        const kept = await pg.query<{ users: number; books: number; places: number }>(`select (select count(*)::int from user_profiles) users, (select count(*)::int from books) books, (select count(*)::int from places) places`);
        expect(kept.rows[0]).toEqual({ users: 1, books: 1, places: 2 });
    });
});
