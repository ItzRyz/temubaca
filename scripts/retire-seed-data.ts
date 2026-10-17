/**
 * One-off: replace the dummy seed (UUIDs `5eed0000-…`) with real data on the dev database.
 *
 * - Seed books become real Open Library records in place (same row id), so real listings,
 *   bookmarks, and reports that point at them stay intact. A book with no exact Open Library match
 *   is deleted when nothing real refers to it, otherwise kept and reported.
 * - Dummy profiles, communities, events, merchandise, memberships, and listings are deleted, with
 *   their audit rows. Listings named with `--also-listing <id>` are deleted too.
 *
 *   bun scripts/retire-seed-data.ts                 # dry run: prints the plan
 *   bun scripts/retire-seed-data.ts --apply         # performs it in one transaction
 */
import "dotenv/config";

import { Pool } from "pg";

import { createOpenLibraryProvider } from "../src/lib/external/books/open-library";
import { getDatabaseTlsConfig } from "../src/lib/db/ssl";

const SEED = "5eed0000-%";
const apply = process.argv.includes("--apply");
const extraListings = process.argv.flatMap((arg, index, all) => (arg === "--also-listing" && all[index + 1] ? [all[index + 1]] : []));

function normalized(value: string | undefined) {
    return (value ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

async function main() {
    if (process.env.NODE_ENV === "production") throw new Error("Refusing to run with NODE_ENV=production.");
    const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL, ssl: getDatabaseTlsConfig("development", process.env.DATABASE_SSL_CA), max: 1 });
    const openLibrary = createOpenLibraryProvider({
        baseUrl: process.env.OPEN_LIBRARY_BASE_URL || "https://openlibrary.org",
        userAgent: `TemuBaca/0.1 (+${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"})`,
    });

    try {
        const { rows: seedBooks } = await pool.query<{ id: string; title: string; authors: string[] }>(
            `select id, title, authors from books where id::text like $1 order by id`, [SEED]);

        type Plan = { id: string; title: string; action: "convert" | "delete" | "keep"; match?: Awaited<ReturnType<typeof openLibrary.getById>>; reason?: string };
        const plans: Plan[] = [];
        for (const book of seedBooks) {
            const lastName = book.authors[0]?.trim().split(/\s+/).at(-1) ?? "";
            const { items } = await openLibrary.search({ query: `${book.title} ${lastName}`.trim(), limit: 5, offset: 0 });
            const hit = items.find((item) => normalized(item.title.split(":")[0]) === normalized(book.title)
                && (!book.authors[0] || item.authors.some((name) => normalized(name) === normalized(book.authors[0]))));
            const match = hit ? await openLibrary.getById(hit.providerId) : null;
            await new Promise((resolve) => setTimeout(resolve, 1100)); // Open Library: about one request per second.

            const taken = match ? (await pool.query(`select id from books where provider = 'OPEN_LIBRARY' and "providerId" = $1 and id <> $2`, [match.providerId, book.id])).rowCount : 0;
            const realRefs = (await pool.query(
                `select (select count(*) from book_listings where "bookId" = $1 and id::text not like $2 and not (id = any($3::uuid[])))::int
                      + (select count(*) from reports where "targetType" = 'BOOK' and "targetId" = $1)::int
                      + (select count(*) from bookmarks where "bookId" = $1 and "userId"::text not like $2)::int as n`,
                [book.id, SEED, extraListings])).rows[0].n as number;

            if (match && !taken) plans.push({ id: book.id, title: book.title, action: "convert", match });
            else if (realRefs === 0) plans.push({ id: book.id, title: book.title, action: "delete", reason: taken ? "rekaman Open Library sudah ada terpisah" : "tidak ada padanan persis di Open Library" });
            else plans.push({ id: book.id, title: book.title, action: "keep", reason: "tidak ada padanan persis, tetapi dirujuk data nyata" });
        }

        const counts = (await pool.query(`select
            (select count(*) from user_profiles where id::text like $1)::int as users,
            (select count(*) from book_listings where id::text like $1)::int as listings,
            (select count(*) from communities where id::text like $1)::int as communities,
            (select count(*) from events where id::text like $1)::int as events,
            (select count(*) from merchandise_listings where id::text like $1)::int as merchandise,
            (select count(*) from community_memberships where id::text like $1)::int as memberships`, [SEED])).rows[0];

        console.log("Buku seed:");
        for (const plan of plans) {
            console.log(`  ${plan.action.toUpperCase().padEnd(7)} ${plan.title}${plan.match ? ` → Open Library ${plan.match.providerId} (${plan.match.title}${plan.match.publishedAt ? `, ${plan.match.publishedAt}` : ""})` : ""}${plan.reason ? ` — ${plan.reason}` : ""}`);
        }
        console.log("Dihapus:", JSON.stringify({ ...counts, extraListings: extraListings.length }));
        if (!apply) {
            console.log("Dry run. Jalankan ulang dengan --apply untuk menerapkan.");
            return;
        }

        const client = await pool.connect();
        try {
            await client.query("begin");
            const listingIds = (await client.query(`select id from book_listings where id::text like $1 or id = any($2::uuid[])`, [SEED, extraListings])).rows.map((row) => row.id);
            await client.query(`delete from verifications where "targetType" = 'BOOK_LISTING' and "targetId" = any($1::uuid[])`, [listingIds]);
            await client.query(`delete from book_listings where id = any($1::uuid[])`, [listingIds]);
            await client.query(`delete from merchandise_listings where id::text like $1`, [SEED]);
            await client.query(`delete from events where id::text like $1`, [SEED]);
            await client.query(`delete from community_memberships where id::text like $1`, [SEED]);
            await client.query(`delete from verifications where "targetType" = 'COMMUNITY' and "targetId"::text like $1`, [SEED]);
            await client.query(`delete from communities where id::text like $1`, [SEED]);
            await client.query(`delete from admin_audit_logs where "targetType" = 'USER' and "targetId"::text like $1`, [SEED]);
            await client.query(`delete from user_profiles where id::text like $1`, [SEED]);

            const now = new Date();
            for (const plan of plans) {
                if (plan.action === "delete") {
                    await client.query(`delete from books where id = $1`, [plan.id]);
                } else if (plan.action === "convert" && plan.match) {
                    const book = plan.match;
                    await client.query(
                        `update books set provider = 'OPEN_LIBRARY', "providerId" = $2, isbn = $3, title = $4, authors = $5, description = $6,
                            publisher = $7, "publishedAt" = $8, language = $9, categories = $10, "coverUrl" = $11, metadata = null,
                            "syncedAt" = $12, "updatedAt" = $12 where id = $1`,
                        [plan.id, book.providerId, book.isbn ?? null, book.title, book.authors, book.description ?? null, book.publisher ?? null,
                            book.publishedAt ?? null, book.language ?? null, book.categories, book.coverUrl ?? null, now]);
                    await client.query(
                        `insert into book_sync_logs ("bookId", provider, status, trigger, "changedFields", message, "createdAt")
                         values ($1, 'OPEN_LIBRARY', 'SUCCESS', 'IMPORT', $2, 'Data dummy diganti rekaman Open Library.', $3)`,
                        [plan.id, ["isbn", "title", "authors", "description", "publisher", "publishedAt", "language", "categories", "coverUrl"], now]);
                }
            }
            await client.query("commit");
            console.log("Selesai.");
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

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
