/**
 * Seed the Peta Literasi with public libraries and public meeting points from OpenStreetMap
 * (`scripts/data/places-osm.json`, DEC-07). The rows come from the Geofabrik Java extract of
 * 24 Oct 2026, inside the routing coverage (Jakarta and Tangerang):
 *
 * - Libraries run by the state (Perpusnas, Dispusip DKI and its sudin, the Tangerang kab/kota
 *   agencies, kecamatan and kelurahan) or named "Perpustakaan Umum". Campus, ministry, embassy,
 *   and private libraries are left out.
 * - Meeting points: every RPTRA (Pemprov DKI's public child-friendly spaces) named "RPTRA …",
 *   city parks with a Wikidata entry, and Taman Literasi Martha Tiahahu. Tangerang has no RPTRA, so
 *   there it is places named "Alun-Alun", "Taman Kota", "Hutan Kota", or "Taman Balai Kota" (added
 *   26 Oct 2026); RT/RW, housing-estate, privately run, and campus parks are left out.
 *
 * The kab/kota comes from the area's administrative boundary. An address is the OSM `addr:*`
 * tags when present, otherwise "Dekat <street>" from the nearest named street in the walking
 * graph. Admins correct or hide rows in /admin/places like any curated place.
 *
 * A row is skipped when a place with the same `source` (the OSM element) already exists.
 *
 *   bun run places:import                    # dry run on the local stack
 *   bun run places:import -- --apply         # insert locally
 *   bun run places:import -- --apply --cloud # insert into the cloud project (production)
 *
 * With `--cloud`, export DATABASE_SSL_CA (the Supabase root CA) first; `.env` does not hold it.
 */
import { readFileSync } from "node:fs";

import { z } from "zod";

import { curatedPlaceSchema } from "../src/lib/validation/schemas/place.schema";

import { scriptDatabaseUrl, scriptPool, useCloud } from "./load-env";

const apply = process.argv.includes("--apply");
const rows = z.array(curatedPlaceSchema).parse(JSON.parse(readFileSync("scripts/data/places-osm.json", "utf8")));

async function main() {
    const databaseUrl = scriptDatabaseUrl();
    console.log(`Target: ${new URL(databaseUrl).hostname}${useCloud ? " (--cloud)" : ""}; ${apply ? "apply" : "dry run"}; ${rows.length} places in the file`);

    const pool = scriptPool(databaseUrl);
    try {
        const { rows: existing } = await pool.query<{ source: string }>(`select source from places where source is not null`);
        const known = new Set(existing.map((row) => row.source));
        const fresh = rows.filter((row) => !row.source || !known.has(row.source));

        if (apply) {
            const client = await pool.connect();
            try {
                await client.query("begin");
                const now = new Date();
                for (const row of fresh) {
                    const inserted = await client.query<{ id: string }>(
                        `insert into places (type, name, "addressPublic", "regionCode", latitude, longitude, source, "checkedAt", "createdAt", "updatedAt")
                         values ($1, $2, $3, $4, $5, $6, $7, $8, $8, $8) returning id`,
                        [row.type, row.name, row.addressPublic, row.regionCode, row.latitude, row.longitude, row.source, now]);
                    await client.query(
                        `insert into admin_audit_logs (action, "targetType", "targetId", note, metadata, "createdAt") values ('PLACE_CREATED', 'PLACE', $1, $2, $3, $4)`,
                        [inserted.rows[0].id, row.name, { importedBy: "scripts/import-places.ts" }, now]);
                }
                await client.query("commit");
            } catch (error) {
                await client.query("rollback");
                throw error;
            } finally {
                client.release();
            }
        }
        console.log(`${apply ? "added" : "would add"} ${fresh.length}; already present ${rows.length - fresh.length}`);
    } finally {
        await pool.end();
    }
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
