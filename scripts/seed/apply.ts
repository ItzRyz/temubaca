/**
 * Database side of the seeder: reference reads, idempotent batched inserts, and cleanup of seed rows
 * only. Works with any Drizzle Postgres database (node-postgres in the CLI, PGlite in tests).
 */
import { createHash } from "node:crypto";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

import * as schema from "../../src/lib/db/schema";

import type { RefBook, RefPlace, SeedMeta, SeedRows } from "./generate";
import { SEED_ID_PATTERN, SEED_TABLES, seedId, type SeedTable } from "./ids";
import { queryRows, type AnyDb } from "./validate";

const tables: Record<SeedTable, PgTable & { id: AnyPgColumn }> = {
    user_profiles: schema.userProfiles, books: schema.books, communities: schema.communities,
    community_submissions: schema.communitySubmissions, community_invites: schema.communityInvites,
    community_memberships: schema.communityMemberships, events: schema.events, places: schema.places,
    merchandise_listings: schema.merchandiseListings, book_listings: schema.bookListings, borrow_requests: schema.borrowRequests,
    borrowings: schema.borrowings, borrow_events: schema.borrowEvents, listing_appeals: schema.listingAppeals,
    reports: schema.reports, verifications: schema.verifications, user_interests: schema.userInterests,
    bookmarks: schema.bookmarks, admin_audit_logs: schema.adminAuditLogs,
    libraries: schema.libraries, book_accesses: schema.bookAccesses,
};

const notSeed = (column: { getSQL(): unknown }) => sql`${column}::text !~ ${SEED_ID_PATTERN}`;

/** Real (non-seed) rows the dataset builds on: curated map places and catalog books. */
export async function readReference(db: AnyDb): Promise<{ places: (RefPlace & { createdAt: Date })[]; books: RefBook[] }> {
    const places = await db
        .select({ id: schema.places.id, type: schema.places.type, name: schema.places.name, addressPublic: schema.places.addressPublic, regionCode: schema.places.regionCode, latitude: schema.places.latitude, longitude: schema.places.longitude, createdAt: schema.places.createdAt })
        .from(schema.places)
        .where(and(inArray(schema.places.type, ["LIBRARY", "MEETING_POINT"]), isNull(schema.places.hiddenAt), notSeed(schema.places.id)));
    const books = await db
        .select({ id: schema.books.id, title: schema.books.title, categories: schema.books.categories, createdAt: schema.books.createdAt })
        .from(schema.books)
        .where(notSeed(schema.books.id));
    return { places: places.map(({ createdAt, ...place }) => ({ ...place, latitude: Number(place.latitude), longitude: Number(place.longitude), createdAt })), books };
}

/**
 * The reference a stored seed was built from, when real rows were added after it (the catalog keeps
 * growing): the rows created up to some moment whose fingerprint is exactly the stored one. Null when
 * no such moment exists, e.g. a reference place was hidden or removed.
 */
export function referenceAsSeeded<T extends { places: (RefPlace & { createdAt: Date })[]; books: RefBook[] }>(reference: T, stored: string): T | null {
    const times = [...new Set([...reference.places, ...reference.books].map((row) => row.createdAt.getTime()))].sort((a, b) => b - a);
    for (const cutoff of times) {
        const subset = { ...reference, places: reference.places.filter((row) => row.createdAt.getTime() <= cutoff), books: reference.books.filter((row) => row.createdAt.getTime() <= cutoff) };
        if (referenceFingerprint(subset) === stored) return subset;
    }
    return null;
}

/** Fingerprint of the reference rows: a re-run must see the same ones to rebuild the same dataset. */
export function referenceFingerprint(reference: { places: RefPlace[]; books: RefBook[] }) {
    const ids = [...reference.places.map((place) => `p:${place.id}`), ...reference.books.map((book) => `b:${book.id}`)].sort();
    return createHash("sha256").update(ids.join("\n")).digest("hex").slice(0, 16);
}

/** The seed's own record, kept in the first seed profile's `preferences` (no app table changes). */
export async function readSeedMeta(db: AnyDb): Promise<SeedMeta | null> {
    const [row] = await db.select({ preferences: schema.userProfiles.preferences }).from(schema.userProfiles).where(eq(schema.userProfiles.id, seedId("user_profiles", 0)));
    const meta = (row?.preferences as { seed?: SeedMeta } | null)?.seed;
    return meta ?? null;
}

/** Rewrites the seed's own record; used only when a seed gains the extension tables. */
export async function writeSeedMeta(db: AnyDb, meta: SeedMeta) {
    await db.update(schema.userProfiles).set({ preferences: { seed: meta } }).where(eq(schema.userProfiles.id, seedId("user_profiles", 0)));
}

export async function countSeedRows(db: AnyDb) {
    const counts = {} as Record<SeedTable, number>;
    for (const table of SEED_TABLES) {
        const [row] = await queryRows<{ n: number }>(db, `select count(*)::int as n from ${table} where id::text ~ '${SEED_ID_PATTERN}'`);
        counts[table] = Number(row.n);
    }
    return counts;
}

export type TableResult = { table: SeedTable; rows: number; inserted: number; skipped: number; batches: number; retries: number; ms: number };

const TRANSIENT = new Set(["40001", "40P01", "57P01", "08000", "08003", "08006", "ECONNRESET", "ETIMEDOUT"]);
function isTransient(error: unknown) {
    const code = (error as { code?: string; cause?: { code?: string } })?.code ?? (error as { cause?: { code?: string } })?.cause?.code;
    return Boolean(code && TRANSIENT.has(code));
}

/**
 * Inserts table by table in foreign key order, one transaction per table, `on conflict (id) do
 * nothing`. A rerun with the same inputs skips what is there, so an interrupted run resumes; a
 * failed table rolls back whole and is retried on transient errors. Existing rows are never updated.
 */
export async function applyRows(db: AnyDb, rows: SeedRows, options: { batchSize: number; maxRetries: number; log?: (line: string) => void }) {
    const results: TableResult[] = [];
    for (const table of SEED_TABLES) {
        const list = rows[table] as Record<string, unknown>[];
        const started = Date.now();
        let retries = 0;
        for (;;) {
            try {
                let inserted = 0;
                let batches = 0;
                await db.transaction(async (tx) => {
                    for (let offset = 0; offset < list.length; offset += options.batchSize) {
                        const batch = list.slice(offset, offset + options.batchSize);
                        const done = await tx.insert(tables[table]).values(batch as never).onConflictDoNothing({ target: tables[table].id }).returning({ id: tables[table].id });
                        inserted += done.length;
                        batches += 1;
                    }
                });
                const result = { table, rows: list.length, inserted, skipped: list.length - inserted, batches, retries, ms: Date.now() - started };
                results.push(result);
                options.log?.(`${table.padEnd(22)} ${String(result.rows).padStart(6)} baris  +${result.inserted} baru, ${result.skipped} dilewati (${batches} batch, ${result.ms} ms)`);
                break;
            } catch (error) {
                if (!isTransient(error) || retries >= options.maxRetries) {
                    throw new Error(`${table}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
                }
                retries += 1;
                options.log?.(`${table}: gangguan sementara, ulangi (${retries}/${options.maxRetries})`);
                await new Promise((resolve) => setTimeout(resolve, 500 * retries));
            }
        }
    }
    return results;
}

/**
 * Rows outside the seed that point at seed rows (foreign keys found in the catalog, plus the
 * uuid-only targets of reports, verifications, recommendations, and audit logs). Cleanup refuses
 * while any exist, so it never deletes or nulls app data.
 */
export async function findCleanupBlockers(db: AnyDb) {
    const fks = await queryRows<{ tbl: string; col: string; has_id: boolean }>(db, `
        select c.conrelid::regclass::text as tbl, a.attname as col,
               exists (select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.conrelid::regclass::text and k.column_name = 'id') as has_id
        from pg_constraint c
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
        where c.contype = 'f' and c.connamespace = 'public'::regnamespace
          and c.confrelid::regclass::text = any (array[${SEED_TABLES.map((t) => `'${t}'`).join(", ")}])`);
    const checks = [
        ...fks.map((fk) => ({ where: `${fk.tbl}.${fk.col}`, sql: `select count(*)::int as n from "${fk.tbl}" where "${fk.col}"::text ~ '${SEED_ID_PATTERN}'${fk.has_id ? ` and id::text !~ '${SEED_ID_PATTERN}'` : ""}` })),
        ...["reports", "verifications", "recommendations", "admin_audit_logs"].map((tbl) => ({ where: `${tbl}.targetId`, sql: `select count(*)::int as n from ${tbl} where "targetId"::text ~ '${SEED_ID_PATTERN}' and id::text !~ '${SEED_ID_PATTERN}'` })),
    ];
    const blockers: { where: string; rows: number }[] = [];
    for (const check of checks) {
        const n = Number((await queryRows<{ n: number }>(db, check.sql))[0].n);
        if (n > 0) blockers.push({ where: check.where, rows: n });
    }
    return blockers;
}

/** Deletes every seed-owned row (id prefix only), children first, in one transaction. */
export async function deleteSeedRows(db: AnyDb) {
    const deleted = {} as Record<SeedTable, number>;
    await db.transaction(async (tx) => {
        for (const table of [...SEED_TABLES].reverse()) {
            const [row] = await queryRows<{ n: number }>(tx, `with gone as (delete from ${table} where id::text ~ '${SEED_ID_PATTERN}' returning 1) select count(*)::int as n from gone`);
            deleted[table] = Number(row.n);
        }
    });
    return deleted;
}
