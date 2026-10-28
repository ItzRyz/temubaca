/**
 * Library holdings from JAKLITERA, the official catalog of Dispusip DKI Jakarta (TB-023, DEC-13,
 * owner's decision 28 Okt 2026). Only books the catalog lists under the same ISBN are recorded, as
 * admin-curated holdings ("tercatat di koleksi") linked to the catalog record, with the copy counts the
 * record shows (borrowable + read on site + on loan) when the record names one location.
 *
 *   bun scripts/import-jaklitera.ts --collect --out <file> [--cloud --production]   # read books, ask the catalog
 *   bun scripts/import-jaklitera.ts --apply-file <file> [--apply] [--cloud --production]
 *
 * `--collect` only reads the database. It asks the catalog slowly (10 s apart, identified as TemuBaca),
 * waits 15 minutes after a 429 and stops after three in a row, and saves after every book so a rerun
 * continues where it stopped. `--apply-file` without `--apply` is a dry run.
 * With `--cloud`, export DATABASE_SSL_CA (the Supabase root CA) first.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { JAKLITERA_BASE, parseRecordPage, parseSearchPage, toIsbn10, toIsbn13, type RecordCopies } from "./jaklitera/parse";
import { scriptDatabaseUrl, scriptPool, useCloud } from "./load-env";

const args = process.argv.slice(2);
const option = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
};
const USER_AGENT = "TemuBaca/1.0 (verifikasi koleksi perpustakaan; https://temubaca.vercel.app)";
const PAUSE_MS = 10_000;
const BACKOFF_MS = 15 * 60_000;
const MAX_RECORDS = 4;

/** JAKLITERA locations and how to recognise the same library on the Peta Literasi; unmatched ones are skipped. */
const LOCATIONS: Record<string, (library: { name: string; publicLocation: string | null }) => boolean> = {
    "Perpustakaan Jakarta - Cikini": (library) => /Cikini Raya No\.? ?73/i.test(library.publicLocation ?? ""),
    "Perpustakaan Jakarta - Nyi Ageng Serang": (library) => /Nyi Ageng Serang/i.test(library.publicLocation ?? ""),
    "Perpustakaan Jakarta - PDS HB Jassin": (library) => /HB Jassin/i.test(library.name),
    "Perpustakaan Jakarta Timur - Jatinegara": (library) => /Jatinegara Timur IV/i.test(library.publicLocation ?? ""),
    "Perpustakaan Jakarta Selatan - Gandaria Tengah": (library) => /Gandaria Tengah V/i.test(library.publicLocation ?? ""),
};

type Found = { cn: string; callNumber: string | null; groups: RecordCopies[] };
type State = { books: Record<string, { isbn13: string; records: Found[] }> };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let consecutive429 = 0;
async function fetchPage(path: string): Promise<string | null> {
    for (;;) {
        await sleep(PAUSE_MS);
        const response = await fetch(`${JAKLITERA_BASE}${path}`, { headers: { "user-agent": USER_AGENT } });
        if (response.status === 429) {
            consecutive429 += 1;
            if (consecutive429 >= 3) throw new Error("JAKLITERA menjawab 429 tiga kali berturut-turut; berhenti. Jalankan lagi nanti untuk melanjutkan.");
            console.log(`  429, menunggu ${BACKOFF_MS / 60_000} menit`);
            await sleep(BACKOFF_MS);
            continue;
        }
        consecutive429 = 0;
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`JAKLITERA menjawab ${response.status} untuk ${path}`);
        return response.text();
    }
}

async function collect(out: string) {
    const state: State = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : { books: {} };
    const pool = scriptPool(scriptDatabaseUrl(), { options: "-c default_transaction_read_only=on" });
    const { rows } = await pool.query<{ id: string; title: string; isbn: string }>(
        `select id, title, isbn from books where isbn is not null and id::text !~ '^5eed0001-' order by title`);
    await pool.end();
    const todo = rows.filter((book) => toIsbn13(book.isbn) && !state.books[book.id]);
    console.log(`${rows.length} buku ber-ISBN, ${todo.length} belum dicek`);
    for (const book of todo) {
        const isbn13 = toIsbn13(book.isbn)!;
        let cns = parseSearchPage((await fetchPage(`/book?keyword=${isbn13}`)) ?? "");
        const isbn10 = toIsbn10(isbn13);
        if (!cns.length && isbn10) cns = parseSearchPage((await fetchPage(`/book?keyword=${isbn10}`)) ?? "");
        const records: Found[] = [];
        for (const cn of cns.slice(0, MAX_RECORDS)) {
            const html = await fetchPage(`/book/detail?cn=${cn}`);
            if (!html) continue;
            const record = parseRecordPage(html);
            if (record.isbns.includes(isbn13)) records.push({ cn, callNumber: record.callNumber, groups: record.groups });
        }
        state.books[book.id] = { isbn13, records };
        writeFileSync(out, JSON.stringify(state, null, 1));
        console.log(`${records.length ? "✓" : "·"} ${book.title} (${records.length} rekaman)`);
    }
}

async function applyFile(file: string, write: boolean) {
    const state: State = JSON.parse(readFileSync(file, "utf8"));
    const pool = scriptPool(scriptDatabaseUrl());
    try {
        const { rows: libraries } = await pool.query<{ id: string; name: string; publicLocation: string | null }>(`select id, name, "publicLocation" from libraries`);
        const libraryOf = new Map<string, string>();
        for (const [location, matches] of Object.entries(LOCATIONS)) {
            const found = libraries.filter(matches);
            if (found.length === 1) libraryOf.set(location, found[0].id);
            else console.log(`  lokasi dilewati (${found.length} perpustakaan cocok): ${location}`);
        }

        type Holding = { libraryId: string; bookId: string; url: string; callNumber: string | null; total: number | null; available: number | null };
        const holdings = new Map<string, Holding>();
        for (const [bookId, { records }] of Object.entries(state.books)) {
            for (const record of records) {
                for (const group of record.groups) {
                    // Counts belong to a location only when the group names exactly one.
                    const single = group.locations.length === 1;
                    for (const location of group.locations) {
                        const libraryId = libraryOf.get(location);
                        if (!libraryId) continue;
                        const key = `${libraryId}:${bookId}`;
                        const holding = holdings.get(key) ?? { libraryId, bookId, url: `${JAKLITERA_BASE}/book/detail?cn=${record.cn}`, callNumber: record.callNumber?.split(";")[0].trim() || null, total: 0, available: 0 };
                        if (!single || holding.total === null) Object.assign(holding, { total: null, available: null });
                        else Object.assign(holding, { total: holding.total + group.borrowable + group.onSite + group.onLoan, available: holding.available! + group.borrowable + group.onSite });
                        holdings.set(key, holding);
                    }
                }
            }
        }
        console.log(`${Object.keys(state.books).length} buku dicek, ${holdings.size} catatan koleksi di ${new Set([...holdings.values()].map((holding) => holding.libraryId)).size} perpustakaan`);
        if (!write) return console.log("Dry run: tidak ada yang ditulis. Tambahkan --apply.");

        const client = await pool.connect();
        try {
            await client.query("begin");
            const now = new Date();
            for (const holding of holdings.values()) {
                await client.query(
                    `insert into library_holdings ("libraryId", "bookId", source, "sourceRecordId", "sourceUrl", "callNumber", status, "copiesTotal", "copiesAvailable", "checkedAt", "createdAt", "updatedAt")
                     values ($1, $2, 'CURATED', '', $3, $4, 'LISTED', $5, $6, $7, $7, $7)
                     on conflict ("libraryId", "bookId", source, "sourceRecordId") do update set "sourceUrl" = excluded."sourceUrl", "callNumber" = excluded."callNumber",
                       "copiesTotal" = excluded."copiesTotal", "copiesAvailable" = excluded."copiesAvailable", "checkedAt" = excluded."checkedAt", "updatedAt" = excluded."updatedAt"`,
                    [holding.libraryId, holding.bookId, holding.url, holding.callNumber, holding.total, holding.available, now]);
                await client.query(
                    `insert into admin_audit_logs (action, "targetType", "targetId", note, metadata, "createdAt") values ('LIBRARY_HOLDING_CHANGED', 'LIBRARY', $1, $2, $3, $4)`,
                    [holding.libraryId, "Koleksi dicatat dari katalog resmi JAKLITERA (ISBN cocok)", { bookId: holding.bookId, source: "CURATED", sourceUrl: holding.url, importedBy: "scripts/import-jaklitera.ts" }, now]);
            }
            await client.query("commit");
            console.log(`Ditulis ${holdings.size} catatan koleksi.`);
        } catch (error) {
            await client.query("rollback");
            throw error;
        } finally {
            client.release();
        }
    } finally {
        await pool.end();
    }
}

async function main() {
    if (useCloud && !args.includes("--production")) throw new Error("Project cloud adalah production: tambahkan --production bila memang disengaja.");
    console.log(`Target: ${new URL(scriptDatabaseUrl()).hostname}${useCloud ? " (PRODUCTION)" : ""}`);
    const out = option("--out");
    const file = option("--apply-file");
    if (args.includes("--collect") && out) return collect(out);
    if (file) return applyFile(file, args.includes("--apply"));
    throw new Error("Pakai --collect --out <file> atau --apply-file <file> [--apply].");
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
