/**
 * Write the TB-055 catalog snapshot to a JSON file for training the ML Service (ML-T04), using the
 * same query as `GET /api/internal/ml/snapshot`. The session is read-only, so the script cannot
 * change data even against production.
 *
 *   bun run ml:snapshot -- --out snapshot.json            # local stack
 *   bun run ml:snapshot -- --out snapshot.json --cloud    # cloud project (production)
 *
 * With `--cloud`, export DATABASE_SSL_CA (the Supabase root CA) first; `.env` does not hold it.
 * The file holds public catalog data only; keep it out of Git.
 */
import { writeFileSync } from "node:fs";

import { drizzle } from "drizzle-orm/node-postgres";

import { buildMlSnapshot, ML_SNAPSHOT_MAX_LIMIT, type MlSnapshotPage } from "../src/features/recommendations/snapshot-query";
import * as schema from "../src/lib/db/schema";

import { scriptPool, useCloud } from "./load-env";

const outIndex = process.argv.indexOf("--out");
const out = outIndex === -1 ? undefined : process.argv[outIndex + 1];

async function main() {
    if (!out) throw new Error("Pass --out <file.json>.");
    // The runtime role (least privilege) is enough to read the public catalog.
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) throw new Error("Set DATABASE_URL first.");
    console.log(`Source: ${new URL(databaseUrl).hostname}${useCloud ? " (--cloud)" : ""}; read-only`);

    const pool = scriptPool(databaseUrl, { options: "-c default_transaction_read_only=on" });

    try {
        const database = drizzle({ client: pool, schema });
        const pages: MlSnapshotPage[] = [];
        let cursor: string | undefined;
        do {
            const page = await buildMlSnapshot(database, { cursor, limit: ML_SNAPSHOT_MAX_LIMIT });
            pages.push(page);
            cursor = page.nextCursor ?? undefined;
        } while (cursor);

        const [first] = pages;
        const snapshot = {
            version: first.version,
            generatedAt: first.generatedAt,
            books: pages.flatMap((page) => page.books),
            communities: first.communities,
            genres: first.genres,
        };
        writeFileSync(out, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
        console.log(`Wrote ${snapshot.books.length} books, ${snapshot.communities.length} verified communities, ${snapshot.genres.length} genres to ${out}`);
    } finally {
        await pool.end();
    }
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
