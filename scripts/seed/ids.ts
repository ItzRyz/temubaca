/**
 * Stable ids for synthetic rows: `5eed0001-<table>-4000-8000-<n in hex>`. The prefix is how the
 * seeder proves a row is its own (re-runs skip it, cleanup deletes only it); no app column is added.
 * It differs from the retired dummy seed (`5eed0000-…`, scripts/retire-seed-data.ts).
 */
export const SEED_ID_PREFIX = "5eed0001";

/** Postgres regex for a seed-owned uuid (compare against `id::text`). */
export const SEED_ID_PATTERN = `^${SEED_ID_PREFIX}-[0-9a-f]{4}-4000-8000-[0-9a-f]{12}$`;

/** Seeded tables in insert (foreign key) order; cleanup walks it backwards. */
export const SEED_TABLES = [
    "user_profiles",
    "books",
    "communities",
    "community_submissions",
    "community_invites",
    "community_memberships",
    "events",
    "places",
    "merchandise_listings",
    "book_listings",
    "borrow_requests",
    "borrowings",
    "borrow_events",
    "listing_appeals",
    "reports",
    "verifications",
    "user_interests",
    "bookmarks",
    "admin_audit_logs",
] as const;

export type SeedTable = (typeof SEED_TABLES)[number];

const TABLE_CODES = Object.fromEntries(SEED_TABLES.map((table, index) => [table, (index + 1).toString(16).padStart(4, "0")])) as Record<SeedTable, string>;

export function seedId(table: SeedTable, n: number) {
    if (!Number.isInteger(n) || n < 0) throw new Error(`seedId(${table}): bad index ${n}`);
    return `${SEED_ID_PREFIX}-${TABLE_CODES[table]}-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

const pattern = new RegExp(SEED_ID_PATTERN);
export const isSeedId = (id: string) => pattern.test(id);
