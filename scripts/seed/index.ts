/**
 * Synthetic seed data for the LOCAL Supabase stack (docs/data-engineering/seed-operations.md).
 *
 *   bun run db:seed                                  # dry run, profile normal: plan + checks, no writes
 *   bun run db:seed -- --profile small --apply       # insert (idempotent; a rerun resumes or skips)
 *   bun run db:seed -- --verify [--report <file>]    # SQL integrity checks + distributions
 *   bun run db:seed -- --cleanup                     # what cleanup would delete
 *   bun run db:seed -- --cleanup --apply             # delete seed rows only (id prefix 5eed0001-)
 *
 * Options: --profile small|normal|large|stress (stress also needs --confirm-stress),
 * --anchor YYYY-MM-DD (default: today, UTC; a seeded database keeps its stored anchor).
 *
 * Local by default. The only cloud project is production (DEC-01): it is reached only with
 * `--cloud --production` (owner's decision, 27 Okt 2026; take a backup first, see
 * docs/data-engineering/seed-operations.md), never with the stress profile.
 * Creates no Supabase Auth accounts and sends nothing anywhere.
 */
import { writeFileSync } from "node:fs";

import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "../../src/lib/db/schema";
import { scriptDatabaseUrl, scriptPool, useCloud } from "../load-env";

import { applyRows, countSeedRows, deleteSeedRows, findCleanupBlockers, readReference, readSeedMeta, referenceFingerprint } from "./apply";
import { SEED_VERSION, seedProfile } from "./config";
import { countRows, generateSeed } from "./generate";
import { SEED_TABLES } from "./ids";
import { queryRows, runSqlChecks, runStats, validateRows, type AnyDb } from "./validate";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
};

/** The target host; anything but localhost needs `--cloud --production`. */
function checkTarget(url: string) {
    const host = new URL(url).hostname;
    if (process.env.NODE_ENV === "production") throw new Error("Menolak berjalan dengan NODE_ENV=production.");
    const local = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
    if (local) return { host, production: false };
    if (!useCloud || !flag("--production")) {
        throw new Error(`Host ${host} bukan lokal. Project cloud adalah production: tambahkan --cloud --production bila memang disengaja (backup dulu).`);
    }
    return { host, production: true };
}

function todayUtc() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function main() {
    const url = scriptDatabaseUrl();
    const { host, production } = checkTarget(url);
    const profile = seedProfile(option("--profile"));
    const apply = flag("--apply");
    const mode = flag("--cleanup") ? "cleanup" : flag("--verify") ? "verify" : apply ? "apply" : "dry-run";
    if (production && profile.needsConfirmation) throw new Error(`Profil ${profile.name} tidak diizinkan di production.`);
    if (mode === "apply" && profile.needsConfirmation && !flag("--confirm-stress")) {
        throw new Error(`Profil ${profile.name} butuh --confirm-stress (volume besar; periksa ruang disk dan memori dulu).`);
    }

    const pool = scriptPool(url, { statement_timeout: profile.statementTimeoutMs, ...(mode === "dry-run" ? { options: "-c default_transaction_read_only=on" } : {}) });
    const db = drizzle({ client: pool, schema }) as unknown as AnyDb;
    const started = Date.now();
    try {
        const [server] = await queryRows<{ db: string; role: string }>(db, "select current_database() as db, current_user as role");
        console.log(`Target: ${host}${production ? " (PRODUCTION)" : ""} db=${server.db} role=${server.role}; mode ${mode}; profil ${profile.name}`);

        if (mode === "verify") return await verify(db, option("--report"));
        if (mode === "cleanup") return await cleanup(db, apply);

        const stored = await readSeedMeta(db);
        const reference = await readReference(db);
        const fingerprint = referenceFingerprint(reference);
        if (stored && (stored.profile !== profile.name || stored.seed !== profile.seed || stored.version !== SEED_VERSION)) {
            throw new Error(`DB sudah berisi seed lain (profil ${stored.profile}, seed ${stored.seed}, versi ${stored.version}). Jalankan --cleanup --apply dulu.`);
        }
        if (stored && stored.reference !== fingerprint) {
            throw new Error("Data referensi (tempat peta / katalog buku asli) berubah sejak seed dibuat, jadi baris yang sama tidak bisa dibangun ulang. Jalankan --cleanup --apply, lalu seed lagi.");
        }
        const anchorOption = option("--anchor");
        const anchor = stored ? new Date(stored.anchor) : anchorOption ? new Date(`${anchorOption}T00:00:00Z`) : todayUtc();
        if (Number.isNaN(anchor.getTime())) throw new Error("--anchor harus YYYY-MM-DD.");
        console.log(`Jangkar waktu: ${anchor.toISOString().slice(0, 10)}${stored ? " (dari seed yang sudah ada)" : ""}; referensi: ${reference.places.length} tempat, ${reference.books.length} buku asli`);

        const generated = Date.now();
        const { rows, meta } = generateSeed({ profile, anchor, places: reference.places, books: reference.books, reference: fingerprint });
        if (stored && stored.dataset !== meta.dataset) {
            throw new Error(`Generator menghasilkan baris yang berbeda dari seed yang tersimpan (${stored.dataset} ≠ ${meta.dataset}); menulis di atasnya akan mencampur dua dataset. Jalankan --cleanup --apply dulu, atau naikkan SEED_VERSION saat mengubah generator.`);
        }
        const counts = countRows(rows);
        const refIds = { places: new Set(reference.places.map((place) => place.id)), books: new Set(reference.books.map((book) => book.id)) };
        const issues = validateRows(rows, { anchor, refIds });
        const existing = await countSeedRows(db);
        console.log(`Dibangkitkan dalam ${Date.now() - generated} ms. Pemeriksaan in-memory: ${issues.length === 0 ? "lulus" : `${issues.length} masalah`}`);
        for (const issue of issues.slice(0, 20)) console.log(`  ✗ ${issue.check}: ${issue.detail}`);

        const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
        const bytes = JSON.stringify(rows).length;
        console.log("\nTabel                  rencana  sudah ada  batch");
        for (const table of SEED_TABLES) console.log(`${table.padEnd(22)} ${String(counts[table]).padStart(7)} ${String(existing[table]).padStart(10)} ${String(Math.ceil(counts[table] / profile.batchSize)).padStart(6)}`);
        console.log(`Total ${total} baris, ±${(bytes / 1024 / 1024).toFixed(1)} MB JSON (data di disk biasanya 2–3× dengan indeks). Akun Supabase Auth: tidak dibuat.`);
        if (issues.length) throw new Error("Pemeriksaan in-memory gagal; tidak ada yang ditulis.");

        if (mode === "dry-run") {
            console.log("\nContoh baris:");
            for (const table of ["user_profiles", "books", "communities", "book_listings", "borrow_requests", "borrowings", "events", "merchandise_listings", "reports"] as const) {
                const sample = rows[table][Math.min(5, rows[table].length - 1)];
                if (sample) console.log(`  ${table}: ${JSON.stringify(sample).slice(0, 300)}`);
            }
            console.log(`\nDry run: tidak ada yang ditulis. Tambahkan --apply untuk menulis ke ${production ? "PRODUCTION" : "DB lokal"}.`);
            return;
        }

        const results = await applyRows(db, rows, { batchSize: profile.batchSize, maxRetries: profile.maxRetries, log: (line) => console.log(line) });
        const inserted = results.reduce((sum, result) => sum + result.inserted, 0);
        console.log(`\nSelesai dalam ${((Date.now() - started) / 1000).toFixed(1)} s: ${inserted} baris baru, ${total - inserted} dilewati (sudah ada), 0 diubah, ${results.reduce((sum, result) => sum + result.retries, 0)} ulangan.`);
        await verify(db);
    } finally {
        await pool.end();
    }
}

async function verify(db: AnyDb, reportPath?: string) {
    const checks = await runSqlChecks(db);
    const failed = checks.filter((result) => result.violations > 0);
    console.log(`\nPemeriksaan SQL: ${checks.length - failed.length}/${checks.length} lulus`);
    for (const result of checks) console.log(`  ${result.violations === 0 ? "✓" : "✗"} ${result.check.name}: ${result.violations} pelanggaran`);
    if (reportPath) {
        const stats = await runStats(db);
        const meta = await readSeedMeta(db);
        writeFileSync(reportPath, renderReport(checks, stats, meta));
        console.log(`Laporan ditulis ke ${reportPath}`);
    }
    if (failed.length) process.exitCode = 1;
}

async function cleanup(db: AnyDb, apply: boolean) {
    const counts = await countSeedRows(db);
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    console.log("Baris seed (id 5eed0001-…) yang akan dihapus:");
    for (const table of SEED_TABLES) if (counts[table]) console.log(`  ${table.padEnd(22)} ${counts[table]}`);
    console.log(`  total ${total}`);
    const blockers = await findCleanupBlockers(db);
    if (blockers.length) {
        console.log("\nDitolak: ada data bukan seed yang menunjuk baris seed (tidak akan dihapus atau diubah):");
        for (const blocker of blockers) console.log(`  ${blocker.where}: ${blocker.rows} baris`);
        process.exitCode = 1;
        return;
    }
    if (!apply) return console.log("\nTidak ada data lain yang bergantung. Tambahkan --apply untuk menghapus.");
    const deleted = await deleteSeedRows(db);
    console.log(`Dihapus ${Object.values(deleted).reduce((sum, n) => sum + n, 0)} baris dalam satu transaksi.`);
}

function renderReport(checks: Awaited<ReturnType<typeof runSqlChecks>>, stats: Awaited<ReturnType<typeof runStats>>, meta: Awaited<ReturnType<typeof readSeedMeta>>) {
    const lines = [
        "# Data quality report (seed sintetis)",
        "",
        `Dibuat oleh \`bun run db:seed -- --verify --report\` pada ${new Date().toISOString()}. Seed: ${meta ? `profil ${meta.profile}, seed ${meta.seed}, versi ${meta.version}, jangkar ${meta.anchor.slice(0, 10)}` : "tidak ada"}.`,
        "",
        "Interpretasi distribusi dan anomali: [seed-strategy.md](seed-strategy.md#temuan-kualitas-data).",
        "",
        "## Pemeriksaan integritas dan aturan bisnis",
        "",
        "Setiap query membaca seluruh baris (seed dan bukan seed) dan menghitung pelanggaran.",
        "",
        "| Pemeriksaan | Aturan | Pelanggaran |",
        "|---|---|---:|",
        ...checks.map((result) => `| \`${result.check.name}\` | ${result.check.description} | ${result.violations} |`),
        "",
        "## Distribusi",
    ];
    for (const stat of stats) {
        lines.push("", `### ${stat.name}`, "");
        const columns = Object.keys(stat.rows[0] ?? { label: "", n: "" });
        lines.push(`| ${columns.join(" | ")} |`, `|${columns.map(() => "---").join("|")}|`);
        for (const row of stat.rows) lines.push(`| ${columns.map((column) => String(row[column] ?? "")).join(" | ")} |`);
    }
    return `${lines.join("\n")}\n`;
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
