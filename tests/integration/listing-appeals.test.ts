import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../../src/lib/db/schema";

// Appeals against hidden listings (Figma 301:2608) on an in-memory Postgres.
const pg = new PGlite();
const testDb = drizzle({ client: pg, schema });
mock.module("server-only", () => ({}));
mock.module(resolve(import.meta.dir, "../../src/lib/db/client.ts"), () => ({ db: testDb }));

setDefaultTimeout(60_000);

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OWNER = id(1), OTHER = id(2), ADMIN = id(3);
const BOOK = id(100), HIDDEN = id(200), VISIBLE = id(201);

let appeals: typeof import("../../src/lib/db/queries/listing-appeals");

beforeAll(async () => {
    const files = (await readdir("drizzle/migrations")).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
        const sql = await readFile(`drizzle/migrations/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await pg.exec(statement);
    }
    await testDb.insert(schema.userProfiles).values([
        { id: OWNER, displayName: "Pemilik" },
        { id: OTHER, displayName: "Orang Lain" },
        { id: ADMIN, displayName: "Admin", role: "ADMIN" },
    ]);
    await testDb.insert(schema.books).values({ id: BOOK, provider: "MANUAL", providerId: "test-100", title: "Negeri 5 Menara", authors: ["A. Fuadi"] });
    await testDb.insert(schema.bookListings).values([
        { id: HIDDEN, ownerId: OWNER, bookId: BOOK, condition: "GOOD", hiddenAt: new Date(), hiddenReason: "Informasi buku tidak sesuai", hiddenById: ADMIN },
        { id: VISIBLE, ownerId: OWNER, bookId: BOOK, condition: "GOOD" },
    ]);
    appeals = await import("../../src/lib/db/queries/listing-appeals");
});

afterAll(async () => {
    await pg.close();
});

const appeal = { reason: "Saya sudah memperbaiki informasi buku", details: "Judul dan kondisi sudah saya perbaiki." };

describe("listing appeals", () => {
    test("only the owner of a hidden listing may appeal, once at a time", async () => {
        await expect(appeals.createListingAppeal(OTHER, HIDDEN, appeal, null)).rejects.toThrow("tidak ditemukan");
        await expect(appeals.createListingAppeal(OWNER, VISIBLE, appeal, null)).rejects.toThrow("tidak sedang disembunyikan");
        await appeals.createListingAppeal(OWNER, HIDDEN, appeal, null);
        await expect(appeals.createListingAppeal(OWNER, HIDDEN, appeal, null)).rejects.toThrow("masih ditinjau");
        expect(await appeals.countPendingAppeals()).toBe(1);
    });

    test("rejecting keeps the listing hidden; a new appeal is then allowed", async () => {
        const [first] = await appeals.listAppealsForListing(HIDDEN);
        await appeals.reviewListingAppeal(first.id, ADMIN, { decision: "REJECT", note: "Data masih belum sesuai." });
        expect((await testDb.query.bookListings.findFirst({ where: eq(schema.bookListings.id, HIDDEN) }))?.hiddenAt).not.toBeNull();
        await expect(appeals.reviewListingAppeal(first.id, ADMIN, { decision: "APPROVE", note: "Ulang" })).rejects.toThrow("sudah diputuskan");
        const latest = (await appeals.latestAppealsForListings([HIDDEN])).get(HIDDEN);
        expect(latest).toMatchObject({ status: "REJECTED", reviewNote: "Data masih belum sesuai." });
        await appeals.createListingAppeal(OWNER, HIDDEN, appeal, null);
    });

    test("accepting shows the listing again and records it", async () => {
        const [second] = await appeals.listAppealsForListing(HIDDEN);
        await appeals.reviewListingAppeal(second.id, ADMIN, { decision: "APPROVE", note: "Sudah diperbaiki." });
        const listing = await testDb.query.bookListings.findFirst({ where: eq(schema.bookListings.id, HIDDEN) });
        expect(listing).toMatchObject({ hiddenAt: null, hiddenReason: null });
        const records = await testDb.query.verifications.findMany({ where: eq(schema.verifications.targetId, HIDDEN) });
        expect(records.map((record) => record.note)).toContain("Banding diterima: Sudah diperbaiki.");
        expect(await appeals.countPendingAppeals()).toBe(0);
    });
});
