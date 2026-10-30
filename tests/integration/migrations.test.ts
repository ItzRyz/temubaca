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

        // 29 since borrower_reviews (migration 0026, 30 Okt 2026).
        expect(tables.rows[0]?.count).toBe(29);
        expect(rlsTables.rows[0]?.count).toBe(29);

        // TB-049: every table is reachable by the runtime role through its policy and grants.
        // A new table without `temubaca_app_all` would be invisible to the app in production.
        const withoutAppAccess = await database.query<{ tablename: string }>(
            `select t.tablename from pg_tables t where t.schemaname = 'public' and (
                not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename and p.policyname = 'temubaca_app_all')
                or not has_table_privilege('temubaca_app', format('public.%I', t.tablename), 'select, insert, update, delete'))`,
        );
        expect(withoutAppAccess.rows.map((row) => row.tablename)).toEqual([]);
    });

    test("the runtime role cannot change the schema", async () => {
        await database.exec("set role temubaca_app");
        try {
            await expect(database.exec("create table public.should_fail (id int)")).rejects.toThrow();
            await expect(database.exec("drop table public.books")).rejects.toThrow();
            const rows = await database.query<{ count: number }>("select count(*)::int as count from public.books");
            expect(rows.rows[0]?.count).toBe(0);
        } finally {
            await database.exec("reset role");
        }
    });
});
