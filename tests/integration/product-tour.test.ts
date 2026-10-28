import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../../src/lib/db/schema";

// "Panduan TemuBaca": the seen flag lives in user_profiles.preferences next to other keys.
const pg = new PGlite();
const testDb = drizzle({ client: pg, schema });
mock.module("server-only", () => ({}));
mock.module(resolve(import.meta.dir, "../../src/lib/db/client.ts"), () => ({ db: testDb }));

setDefaultTimeout(60_000);

const READER = "00000000-0000-4000-8000-000000000001";
let users: typeof import("../../src/lib/db/queries/users");

beforeAll(async () => {
    const files = (await readdir("drizzle/migrations")).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
        const sql = await readFile(`drizzle/migrations/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await pg.exec(statement);
    }
    await testDb.insert(schema.userProfiles).values({ id: READER, displayName: "Pembaca", preferences: { theme: "terang" } });
    users = await import("../../src/lib/db/queries/users");
});

afterAll(async () => {
    await pg.close();
});

describe("markTourSeen", () => {
    const preferences = async () => (await testDb.query.userProfiles.findFirst({ where: eq(schema.userProfiles.id, READER) }))?.preferences as Record<string, unknown>;

    test("records the first time only and keeps other preferences", async () => {
        expect(users.hasSeenTour(await preferences())).toBe(false);
        await users.markTourSeen(READER);
        const first = await preferences();
        expect(first.theme).toBe("terang");
        expect(typeof first.tourSeenAt).toBe("string");
        expect(users.hasSeenTour(first)).toBe(true);
        await users.markTourSeen(READER);
        expect((await preferences()).tourSeenAt).toBe(first.tourSeenAt);
    });

    test("a profile without preferences gets the flag too", async () => {
        await testDb.update(schema.userProfiles).set({ preferences: null }).where(eq(schema.userProfiles.id, READER));
        await users.markTourSeen(READER);
        expect(users.hasSeenTour(await preferences())).toBe(true);
    });
});
