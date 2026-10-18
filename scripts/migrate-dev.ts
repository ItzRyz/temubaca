/**
 * Apply pending Drizzle migrations to the development database.
 *
 * `drizzle-kit migrate` cannot connect with the dev pooler's certificate, so this applies the
 * same SQL files the same way Drizzle does: each file in one transaction, recorded in
 * `drizzle.__drizzle_migrations__` with the SHA-256 of its contents and the journal `when`.
 *
 *   bun scripts/migrate-dev.ts          # list pending migrations
 *   bun scripts/migrate-dev.ts --apply  # apply them
 *
 * Targets the local Supabase stack when `.env.development.local` exists; add `--cloud` for the
 * cloud project in `.env` (see scripts/load-env.ts).
 */
import { useCloud } from "./load-env";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { Pool } from "pg";

import { getDatabaseTlsConfig } from "../src/lib/db/ssl";

type Journal = { entries: { idx: number; when: number; tag: string }[] };

async function main() {
    const databaseUrl = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
    if (!databaseUrl) throw new Error("Set DIRECT_URL or DATABASE_URL first.");
    if (process.env.NODE_ENV === "production") throw new Error("Refusing to run with NODE_ENV=production.");

    const journal = JSON.parse(await readFile("drizzle/migrations/meta/_journal.json", "utf8")) as Journal;
    const migrations = await Promise.all(journal.entries.sort((a, b) => a.idx - b.idx).map(async (entry) => {
        const sql = await readFile(`drizzle/migrations/${entry.tag}.sql`, "utf8");
        return { ...entry, sql, hash: createHash("sha256").update(sql).digest("hex") };
    }));

    const pool = new Pool({ connectionString: databaseUrl, ssl: getDatabaseTlsConfig("development", process.env.DATABASE_SSL_CA), max: 1 });
    try {
        console.log(`Target: ${new URL(databaseUrl).hostname}${useCloud ? " (--cloud)" : ""}`);
        // A fresh database (the local stack) has no Drizzle bookkeeping yet.
        await pool.query(`create schema if not exists drizzle`);
        await pool.query(`create table if not exists drizzle."__drizzle_migrations__" (id serial primary key, hash text not null, created_at bigint)`);
        const applied = new Set((await pool.query<{ hash: string }>(`select hash from drizzle."__drizzle_migrations__"`)).rows.map((row) => row.hash));
        const pending = migrations.filter((migration) => !applied.has(migration.hash));

        if (pending.length === 0) {
            console.log("No pending migrations.");
            return;
        }
        console.log(`Pending: ${pending.map((migration) => migration.tag).join(", ")}`);
        if (!process.argv.includes("--apply")) {
            console.log("Dry run. Re-run with --apply to apply them.");
            return;
        }

        for (const migration of pending) {
            const client = await pool.connect();
            try {
                await client.query("begin");
                for (const statement of migration.sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) {
                    await client.query(statement);
                }
                await client.query(`insert into drizzle."__drizzle_migrations__" (hash, created_at) values ($1, $2)`, [migration.hash, migration.when]);
                await client.query("commit");
                console.log(`Applied ${migration.tag}`);
            } catch (error) {
                await client.query("rollback");
                throw error;
            } finally {
                client.release();
            }
        }
    } finally {
        await pool.end();
    }
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
