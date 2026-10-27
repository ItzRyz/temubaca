/**
 * Volume profiles for the synthetic dataset (`--profile small|normal|large|stress`, default
 * normal). Counts are the generator's inputs; dependent tables (requests, events, verifications…)
 * follow from the business rules, so their final numbers are reported, not forced.
 */
export type SeedProfileName = "small" | "normal" | "large" | "stress";

export type SeedProfile = {
    name: SeedProfileName;
    /** RNG seed: the same seed and anchor date give the same rows. */
    seed: number;
    /** How far back activity starts, counted from the anchor date. */
    months: number;
    users: number;
    admins: number;
    books: number;
    listings: number;
    communities: number;
    reports: number;
    /** Median bookmarks of a "normal" reader; segments scale it. */
    bookmarkMedian: number;
    /** Median ACTIVE+other MEMBER rows per verified community. */
    memberMedian: number;
    eventMedian: number;
    /** Rows per INSERT statement (Postgres allows 65 535 parameters; the widest table has ~30 columns). */
    batchSize: number;
    /** Attempts per table transaction on transient errors (connection drop, serialization, deadlock). */
    maxRetries: number;
    /** Per-statement limit on the seeding connection. */
    statementTimeoutMs: number;
    /** Profiles that need `--confirm-stress`. */
    needsConfirmation: boolean;
};

const base = { seed: 20261027, months: 9, batchSize: 500, maxRetries: 3, statementTimeoutMs: 60_000, needsConfirmation: false };

export const SEED_PROFILES: Record<SeedProfileName, SeedProfile> = {
    small: { ...base, name: "small", months: 6, users: 120, admins: 2, books: 200, listings: 90, communities: 10, reports: 20, bookmarkMedian: 3, memberMedian: 6, eventMedian: 3 },
    normal: { ...base, name: "normal", users: 1500, admins: 4, books: 2700, listings: 1200, communities: 100, reports: 200, bookmarkMedian: 3, memberMedian: 12, eventMedian: 4 },
    large: { ...base, name: "large", months: 12, users: 6000, admins: 6, books: 8000, listings: 4800, communities: 300, reports: 800, bookmarkMedian: 3, memberMedian: 18, eventMedian: 5 },
    stress: { ...base, name: "stress", months: 18, users: 30000, admins: 10, books: 30000, listings: 24000, communities: 1200, reports: 4000, bookmarkMedian: 3, memberMedian: 25, eventMedian: 6, batchSize: 1000, statementTimeoutMs: 300_000, needsConfirmation: true },
};

export function seedProfile(name: string | undefined): SeedProfile {
    const key = (name ?? "normal") as SeedProfileName;
    const profile = SEED_PROFILES[key];
    if (!profile) throw new Error(`Unknown profile "${name}". Use one of: ${Object.keys(SEED_PROFILES).join(", ")}.`);
    return profile;
}

/** Bump when the generator changes in a way that would give different rows for the same seed. */
export const SEED_VERSION = 1;
