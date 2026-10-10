import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";

const database = new PGlite();
setDefaultTimeout(30_000);

afterAll(async () => {
    await database.close();
});

describe("database migrations", () => {
    test("apply in order to an empty PostgreSQL-compatible database", async () => {
        const migrationFiles = (await readdir("drizzle/migrations"))
            .filter((file) => /^\d+_.*\.sql$/.test(file))
            .sort();

        expect(migrationFiles.length).toBeGreaterThan(0);

        for (const file of migrationFiles) {
            const migration = await readFile(`drizzle/migrations/${file}`, "utf8");
            const statements = migration
                .split("--> statement-breakpoint")
                .map((statement) => statement.trim())
                .filter(Boolean);

            for (const statement of statements) {
                await database.exec(statement);
            }
        }

        const tables = await database.query<{ count: number }>(
            "select count(*)::int as count from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'",
        );
        const rlsTables = await database.query<{ count: number }>(
            "select count(*)::int as count from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity",
        );

        expect(tables.rows[0]?.count).toBe(18);
        expect(rlsTables.rows[0]?.count).toBe(18);
    });
});
