/**
 * Builds src/features/regions/districts.json (kecamatan by kab/kota) from cahyadsn/wilayah `db/wilayah.sql`
 * @ d68e8d5 (MIT, Kepmendagri 300.2.2-2138/2025), the same source as the province and kab/kota codes.
 *
 *   curl -sL -o wilayah.sql https://raw.githubusercontent.com/cahyadsn/wilayah/d68e8d5/db/wilayah.sql
 *   bun scripts/regions/build-districts.ts wilayah.sql
 */
import { readFile, writeFile } from "node:fs/promises";

import { kabkota } from "../../src/features/regions/data";

const source = process.argv[2];
if (!source) throw new Error("Usage: bun scripts/regions/build-districts.ts <path to wilayah.sql>");

const sql = await readFile(source, "utf8");
const known = new Set(kabkota.map(([code]) => code));
const byCity = new Map<string, [string, string][]>();
let skipped = 0;
for (const match of sql.matchAll(/\('(\d{2}\.\d{2}\.\d{2})','((?:[^']|'')*)'\)/g)) {
    const [, code, rawName] = match;
    const city = code.slice(0, 5);
    if (!known.has(city)) {
        skipped += 1;
        continue;
    }
    byCity.set(city, [...(byCity.get(city) ?? []), [code, rawName.replace(/''/g, "'").trim()]]);
}
const out = Object.fromEntries([...byCity.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([city, list]) => [city, list.sort(([a], [b]) => a.localeCompare(b))]));
await writeFile("src/features/regions/districts.json", `${JSON.stringify(out)}\n`);
const total = [...byCity.values()].reduce((sum, list) => sum + list.length, 0);
console.log(`${total} kecamatan in ${byCity.size} kab/kota (${skipped} skipped: kab/kota not in data.ts)`);
