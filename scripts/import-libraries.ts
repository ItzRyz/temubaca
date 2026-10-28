/**
 * Create a TemuBaca library for every library on the Peta Literasi that is not one yet (TB-023).
 * Name, public address, and kab/kota come from the place; the source is "Peta Literasi". Opening hours,
 * website, and catalog stay empty until an admin fills them in /admin/libraries,
 * where managers are appointed too. Hidden places are skipped, and a place is never imported twice
 * (`libraries.placeId` is unique).
 *
 *   bun run libraries:import                                  # dry run on the local stack
 *   bun run libraries:import -- --apply                       # insert locally
 *   bun run libraries:import -- --apply --cloud --production  # insert into production
 *
 * With `--cloud`, export DATABASE_SSL_CA (the Supabase root CA) first; `.env` does not hold it.
 */
import { scriptDatabaseUrl, scriptPool, useCloud } from "./load-env";

const apply = process.argv.includes("--apply");

async function main() {
    const databaseUrl = scriptDatabaseUrl();
    if (useCloud && !process.argv.includes("--production")) throw new Error("Project cloud adalah production: tambahkan --production bila memang disengaja.");
    console.log(`Target: ${new URL(databaseUrl).hostname}${useCloud ? " (PRODUCTION)" : ""}; ${apply ? "apply" : "dry run"}`);
    const pool = scriptPool(databaseUrl);
    try {
        const { rows: places } = await pool.query<{ id: string; name: string; addressPublic: string | null; regionCode: string | null }>(
            `select p.id, p.name, p."addressPublic", p."regionCode" from places p
             where p.type = 'LIBRARY' and p."hiddenAt" is null and not exists (select 1 from libraries l where l."placeId" = p.id)
             order by p.name`);
        for (const place of places) console.log(`  ${apply ? "+" : "·"} ${place.name}`);

        if (apply && places.length) {
            const client = await pool.connect();
            try {
                await client.query("begin");
                const now = new Date();
                for (const place of places) {
                    const inserted = await client.query<{ id: string }>(
                        `insert into libraries (name, "publicLocation", "regionCode", "placeId", source, "createdAt", "updatedAt")
                         values ($1, $2, $3, $4, 'Peta Literasi', $5, $5) returning id`,
                        [place.name, place.addressPublic, place.regionCode, place.id, now]);
                    await client.query(
                        `insert into admin_audit_logs (action, "targetType", "targetId", note, metadata, "createdAt") values ('LIBRARY_CREATED', 'LIBRARY', $1, $2, $3, $4)`,
                        [inserted.rows[0].id, place.name, { placeId: place.id, importedBy: "scripts/import-libraries.ts" }, now]);
                }
                await client.query("commit");
            } catch (error) {
                await client.query("rollback");
                throw error;
            } finally {
                client.release();
            }
        }
        console.log(`${apply ? "added" : "would add"} ${places.length} libraries`);
    } finally {
        await pool.end();
    }
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
