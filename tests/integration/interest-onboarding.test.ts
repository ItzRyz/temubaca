import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../../src/lib/db/schema";

// "Pilih minat": the interests and optional kab/kota saved together, against every migration.
const pg = new PGlite();
const testDb = drizzle({ client: pg, schema });
mock.module("server-only", () => ({}));
mock.module(resolve(import.meta.dir, "../../src/lib/db/client.ts"), () => ({ db: testDb }));

setDefaultTimeout(60_000);

const READER = "00000000-0000-4000-8000-000000000001";
let interests: typeof import("../../src/lib/db/queries/interests");

beforeAll(async () => {
    const files = (await readdir("drizzle/migrations")).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
        const sql = await readFile(`drizzle/migrations/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await pg.exec(statement);
    }
    await testDb.insert(schema.userProfiles).values({ id: READER, displayName: "Pembaca", regionCode: "31.74" });
    interests = await import("../../src/lib/db/queries/interests");
});

afterAll(async () => {
    await pg.close();
});

describe("saveOnboardingInterests", () => {
    const regionOf = async () => (await testDb.query.userProfiles.findFirst({ where: eq(schema.userProfiles.id, READER) }))?.regionCode;

    test("saves the interests once and keeps the kab/kota when none was chosen", async () => {
        expect(await interests.countUserInterests(READER)).toBe(0);
        await interests.saveOnboardingInterests(READER, ["Puisi", "Sejarah", "Filsafat"], undefined);
        await interests.saveOnboardingInterests(READER, ["Puisi", "Sejarah", "Filsafat"], undefined);
        expect(await interests.countUserInterests(READER)).toBe(3);
        expect(await regionOf()).toBe("31.74");
    });

    test("a chosen kab/kota replaces the old one", async () => {
        await interests.saveOnboardingInterests(READER, ["Puisi", "Biografi", "Romansa"], "36.71");
        expect(await interests.countUserInterests(READER)).toBe(5);
        expect(await regionOf()).toBe("36.71");
    });
});
