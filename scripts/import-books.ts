/**
 * Grow the public catalog with real records from Open Library and Google Books, through the same
 * adapters the app uses. Each query takes a few results per provider, so the catalog stays varied.
 * A record is skipped when it has no author or cover, or when the catalog already holds the same
 * provider id, ISBN, or title + first author (the same book from the other provider). Google gets plain
 * queries: its `inauthor:`/`subject:` operators returned nothing during the October 2026 import.
 *
 *   bun run books:import                                 # dry run on the local stack
 *   bun run books:import -- --apply                      # insert locally
 *   bun run books:import -- --apply --cloud              # insert into the cloud project (production)
 *   bun run books:import -- --apply --target 400         # stop once the catalog holds 400 books
 *
 * With `--cloud`, export DATABASE_SSL_CA (the Supabase root CA) first; `.env` does not hold it.
 */

import { createGoogleBooksProvider } from "../src/lib/external/books/google-books";
import { createOpenLibraryProvider } from "../src/lib/external/books/open-library";
import type { BookCatalogProvider } from "../src/lib/external/books/provider";
import type { ExternalBook } from "../src/lib/validation/schemas/book.schema";

import { scriptDatabaseUrl, scriptPool, useCloud } from "./load-env";

const apply = process.argv.includes("--apply");
const targetArg = process.argv[process.argv.indexOf("--target") + 1];
const TARGET = process.argv.includes("--target") ? Number(targetArg) : 330;
const PER_QUERY = 4;
/** School workbooks, bulletins, and exam guides are not books readers lend each other. */
const NOT_A_READING_BOOK = /\b(buletin|bulletin|kelas \d|semester|sd|smp|sma|smk|mi|mts|lks|modul|soal|ujian|kurikulum|skripsi|tesis|jurnal|prosiding|laporan)\b/i;

/** Indonesian authors and topics first, then widely read titles in Indonesian or English. */
type Query = { openLibrary: string; google: string; author?: string };

const QUERIES: Query[] = [
    ...[
        "Pramoedya Ananta Toer", "Tere Liye", "Andrea Hirata", "Ahmad Tohari", "Eka Kurniawan", "Leila S. Chudori",
        "Dee Lestari", "Ayu Utami", "Seno Gumira Ajidarma", "Laksmi Pamuntjak", "Okky Madasari", "Habiburrahman El Shirazy",
        "Chairil Anwar", "Sapardi Djoko Damono", "Joko Pinurbo", "Goenawan Mohamad", "Mochtar Lubis", "Y.B. Mangunwijaya",
        "Umar Kayam", "N.H. Dini", "Ahmad Fuadi", "Raditya Dika", "Ika Natassa", "Boy Candra", "Fiersa Besari",
        "Henry Manampiring", "Najwa Shihab", "Buya Hamka", "Abdurrahman Wahid", "Tan Malaka", "Marah Rusli", "Abdul Muis",
        "Budi Darma", "Iwan Simatupang", "Putu Wijaya", "Remy Sylado", "Intan Paramaditha", "Norman Erikson Pasaribu",
        "Ajip Rosidi", "Taufiq Ismail", "W.S. Rendra", "Emha Ainun Nadjib", "Asma Nadia", "Pidi Baiq", "Sitor Situmorang",
        "Armijn Pane", "Sutan Takdir Alisjahbana", "Kuntowijoyo", "Wiji Thukul", "Oka Rusmini", "Linda Christanty",
    ].map((author) => ({ openLibrary: `author:"${author}"`, google: author, author })),
    ...[
        "sastra indonesia", "sejarah indonesia", "novel indonesia", "puisi indonesia", "budaya jawa", "filsafat",
        "psikologi", "pengembangan diri", "ekonomi", "bisnis", "kewirausahaan", "pendidikan", "agama islam", "sains populer",
        "teknologi", "pemrograman", "sejarah dunia", "politik", "biografi", "cerita anak", "komik", "kuliner", "kesehatan",
        "lingkungan hidup", "astronomi", "matematika", "fotografi", "desain", "musik", "perjalanan",
    ].map((topic) => ({ openLibrary: `subject:"${topic}"`, google: `buku ${topic}` })),
    ...[
        "Yuval Noah Harari", "Haruki Murakami", "George Orwell", "J.K. Rowling", "Paulo Coelho", "Agatha Christie",
        "Gabriel Garcia Marquez", "Albert Camus", "Fyodor Dostoevsky", "Leo Tolstoy", "Jane Austen", "Ernest Hemingway",
        "Antoine de Saint-Exupery", "Malcolm Gladwell", "James Clear", "Carl Sagan", "Stephen Hawking", "Mark Manson",
        "Brian Khrisna", "Morgan Housel", "Cal Newport", "Daniel Kahneman", "Chimamanda Ngozi Adichie", "Toni Morrison",
        "Neil Gaiman", "Kazuo Ishiguro", "Dan Brown", "Stephen King", "Isaac Asimov", "Ursula K. Le Guin", "J.R.R. Tolkien",
        "Khaled Hosseini", "Mitch Albom", "Rick Riordan", "Arthur Conan Doyle", "Franz Kafka", "Hermann Hesse", "Orhan Pamuk",
    ].map((author) => ({ openLibrary: `author:"${author}"`, google: author, author })),
];

function normalized(value: string | undefined) {
    return (value ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function titleKey(book: Pick<ExternalBook, "title" | "authors">) {
    return `${normalized(book.title)}|${normalized(book.authors[0])}`;
}

/** For an author query, Google also returns books about or edited from that author; keep their own. */
function usable(book: ExternalBook, query: Query) {
    if (book.authors.length === 0 || !book.coverUrl || book.title.length > 200 || NOT_A_READING_BOOK.test(book.title)) return false;
    if (!query.author) return true;
    const surname = normalized(query.author).split(" ").at(-1)!;
    return book.authors.some((author) => normalized(author).split(" ").includes(surname));
}

async function main() {
    if (!Number.isInteger(TARGET) || TARGET < 1) throw new Error("--target needs a positive whole number.");
    const databaseUrl = scriptDatabaseUrl();
    console.log(`Target: ${new URL(databaseUrl).hostname}${useCloud ? " (--cloud)" : ""}; ${apply ? "apply" : "dry run"}; stop at ${TARGET} books`);

    const pool = scriptPool(databaseUrl);
    const providers: BookCatalogProvider[] = [
        createOpenLibraryProvider({
            baseUrl: process.env.OPEN_LIBRARY_BASE_URL || "https://openlibrary.org",
            userAgent: `TemuBaca/0.1 (+${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"})`,
        }),
        createGoogleBooksProvider({ apiKey: process.env.GOOGLE_BOOKS_API_KEY }),
    ];

    try {
        const { rows } = await pool.query<{ provider: string; providerId: string; isbn: string | null; title: string; authors: string[] }>(
            `select provider, "providerId", isbn, title, authors from books`);
        const seenIds = new Set(rows.map((row) => `${row.provider}:${row.providerId}`));
        const seenIsbns = new Set(rows.flatMap((row) => (row.isbn ? [row.isbn] : [])));
        const seenTitles = new Set(rows.map(titleKey));
        let total = rows.length;
        const added: Record<string, number> = { OPEN_LIBRARY: 0, GOOGLE_BOOKS: 0 };
        const failures: string[] = [];
        console.log(`books now: ${total}`);

        for (const query of QUERIES) {
            if (total >= TARGET) break;
            for (const provider of providers) {
                if (total >= TARGET) break;
                const q = provider.id === "OPEN_LIBRARY" ? query.openLibrary : query.google;
                let items: ExternalBook[];
                try {
                    ({ items } = await provider.search({ query: q, limit: 20, offset: 0 }));
                } catch (error) {
                    failures.push(`${provider.id} ${q}: ${error instanceof Error ? error.message : error}`);
                    continue;
                }
                // Open Library asks for about one request per second.
                await new Promise((resolve) => setTimeout(resolve, provider.id === "OPEN_LIBRARY" ? 1_000 : 200));

                let taken = 0;
                for (const book of items) {
                    if (taken >= PER_QUERY || total >= TARGET) break;
                    if (!usable(book, query)) continue;
                    const key = titleKey(book);
                    if (seenIds.has(`${book.provider}:${book.providerId}`) || (book.isbn && seenIsbns.has(book.isbn)) || seenTitles.has(key)) continue;
                    seenIds.add(`${book.provider}:${book.providerId}`);
                    if (book.isbn) seenIsbns.add(book.isbn);
                    seenTitles.add(key);

                    if (apply) {
                        const now = new Date();
                        const client = await pool.connect();
                        try {
                            await client.query("begin");
                            const inserted = await client.query<{ id: string }>(
                                `insert into books (provider, "providerId", isbn, title, authors, description, publisher, "publishedAt", language, categories, "coverUrl", "syncedAt", "createdAt", "updatedAt")
                                 values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, $12)
                                 on conflict (provider, "providerId") do nothing returning id`,
                                [book.provider, book.providerId, book.isbn ?? null, book.title, book.authors, book.description ?? null, book.publisher ?? null,
                                    book.publishedAt ?? null, book.language ?? null, book.categories, book.coverUrl ?? null, now]);
                            if (inserted.rows[0]) {
                                const changed = ["isbn", "title", "authors", "description", "publisher", "publishedAt", "language", "categories", "coverUrl"].filter((field) => {
                                    const value = book[field as keyof ExternalBook];
                                    return Array.isArray(value) ? value.length > 0 : Boolean(value);
                                });
                                await client.query(
                                    `insert into book_sync_logs ("bookId", provider, status, trigger, "changedFields", message, "createdAt") values ($1, $2, 'SUCCESS', 'IMPORT', $3, $4, $5)`,
                                    [inserted.rows[0].id, book.provider, changed, "Impor massal katalog (scripts/import-books.ts)", now]);
                            }
                            await client.query("commit");
                            if (!inserted.rows[0]) continue;
                        } catch (error) {
                            await client.query("rollback");
                            throw error;
                        } finally {
                            client.release();
                        }
                    }
                    taken += 1;
                    total += 1;
                    added[book.provider] += 1;
                }
                console.log(`${provider.id.padEnd(12)} ${q}: +${taken} (total ${total})`);
            }
        }

        console.log(`${apply ? "added" : "would add"}: Open Library ${added.OPEN_LIBRARY}, Google Books ${added.GOOGLE_BOOKS}; books ${apply ? "now" : "after"}: ${total}`);
        if (failures.length) console.log(`provider failures (${failures.length}):\n  ${failures.join("\n  ")}`);
        if (total < TARGET) console.log(`Ran out of queries before ${TARGET}; add more to QUERIES.`);
    } finally {
        await pool.end();
    }
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
