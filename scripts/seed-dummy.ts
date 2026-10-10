/**
 * Dummy data for local/dev UI review. Every row uses a fixed UUID starting with `5eed0000-`,
 * so `--reset` removes exactly these rows and nothing else.
 *
 *   bun run db:seed          # (re)insert dummy data
 *   bun run db:seed --reset  # remove dummy data only
 *
 * Never run against production. Dummy profiles have no Supabase Auth account and cannot sign in.
 */
import "dotenv/config";

import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getDatabaseTlsConfig } from "../src/lib/db/ssl";
import * as schema from "../src/lib/db/schema";

const {
    bookListings,
    books,
    communities,
    communityMemberships,
    events,
    merchandiseListings,
    userProfiles,
} = schema;

const seedId = (n: number) => `5eed0000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const daysFromNow = (days: number, hour: number, minute = 0) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    date.setUTCHours(hour - 7, minute, 0, 0); // WIB → UTC
    return date;
};

const users = [
    { id: seedId(1), displayName: "Pembaca Dummy Sari" },
    { id: seedId(2), displayName: "Pembaca Dummy Bima" },
    { id: seedId(3), displayName: "Pembaca Dummy Laras" },
    { id: seedId(4), displayName: "Pembaca Dummy Raka" },
];

const bookRows = [
    { n: 101, title: "Bumi Manusia", authors: ["Pramoedya Ananta Toer"], publisher: "Hasta Mitra", publishedAt: "1980", categories: ["Sastra Klasik", "Fiksi Sejarah"], isbn: "9789799731234", description: "Kisah Minke, pemuda pribumi terpelajar di masa kolonial Hindia Belanda, dan cintanya kepada Annelies Mellema." },
    { n: 102, title: "Anak Semua Bangsa", authors: ["Pramoedya Ananta Toer"], publisher: "Hasta Mitra", publishedAt: "1981", categories: ["Sastra Klasik", "Fiksi Sejarah"], description: "Lanjutan perjalanan Minke yang mulai melihat penderitaan bangsanya lebih dekat." },
    { n: 103, title: "Laut Bercerita", authors: ["Leila S. Chudori"], publisher: "Kepustakaan Populer Gramedia", publishedAt: "2017", categories: ["Fiksi Sejarah"], description: "Kisah aktivis mahasiswa yang hilang pada akhir 1990-an dan keluarga yang menunggu kabar mereka." },
    { n: 104, title: "Laskar Pelangi", authors: ["Andrea Hirata"], publisher: "Bentang Pustaka", publishedAt: "2005", categories: ["Fiksi", "Pendidikan"], description: "Sepuluh anak di Belitung dan perjuangan mereka bersekolah di sebuah sekolah sederhana." },
    { n: 105, title: "Filosofi Teras", authors: ["Henry Manampiring"], publisher: "Kompas", publishedAt: "2018", categories: ["Filsafat Populer", "Pengembangan Diri"], description: "Pengantar filsafat Stoa untuk menghadapi kecemasan dan kehidupan sehari-hari." },
    { n: 106, title: "Cantik Itu Luka", authors: ["Eka Kurniawan"], publisher: "Gramedia Pustaka Utama", publishedAt: "2002", categories: ["Sastra Klasik", "Fiksi"], description: "Saga keluarga di kota fiktif Halimunda yang merentang dari masa kolonial hingga pascakemerdekaan." },
    { n: 107, title: "Ronggeng Dukuh Paruk", authors: ["Ahmad Tohari"], publisher: "Gramedia Pustaka Utama", publishedAt: "1982", categories: ["Sastra Klasik"], description: "Srintil, penari ronggeng dari dukuh kecil, di tengah gejolak sosial tahun 1960-an." },
    { n: 108, title: "Pulang", authors: ["Leila S. Chudori"], publisher: "Kepustakaan Populer Gramedia", publishedAt: "2012", categories: ["Fiksi Sejarah"], description: "Para eksil politik di Paris dan kerinduan mereka untuk pulang ke tanah air." },
].map(({ n, ...book }) => ({
    id: seedId(n),
    provider: "MANUAL" as const,
    providerId: `seed-dummy-${n}`,
    language: "Indonesia",
    ...book,
}));

const listingRows = [
    { n: 201, ownerId: seedId(1), bookId: seedId(101), condition: "GOOD" as const, publicLocation: "Taman Suropati, Menteng", borrowingRules: "Pinjam maksimal 14 hari. Serah terima di ruang publik." },
    { n: 202, ownerId: seedId(2), bookId: seedId(101), condition: "LIKE_NEW" as const, publicLocation: "Tebet, Jakarta Selatan", borrowingRules: "Mohon dijaga dari hujan dan dikembalikan tepat waktu." },
    { n: 203, ownerId: seedId(3), bookId: seedId(103), condition: "GOOD" as const, publicLocation: "Cikini, Jakarta Pusat", borrowingRules: null },
    { n: 204, ownerId: seedId(4), bookId: seedId(104), condition: "FAIR" as const, publicLocation: "Depok", borrowingRules: "Ada catatan pensil di beberapa halaman." },
    { n: 205, ownerId: seedId(1), bookId: seedId(105), condition: "NEW" as const, publicLocation: "Blok M, Jakarta Selatan", borrowingRules: null },
    { n: 206, ownerId: seedId(2), bookId: seedId(106), condition: "GOOD" as const, publicLocation: null, borrowingRules: null },
].map(({ n, ...listing }) => ({ id: seedId(n), ...listing }));

const communityRows = [
    { n: 301, ownerId: seedId(1), name: "Lingkar Baca Dummy Suropati", publicLocation: "Menteng, Jakarta Pusat", status: "VERIFIED" as const, description: "Komunitas contoh untuk uji tampilan. Berkumpul dua pekan sekali untuk membaca senyap lalu berbagi resensi singkat." },
    { n: 302, ownerId: seedId(2), name: "Klub Buku Dummy Tebet", publicLocation: "Tebet, Jakarta Selatan", status: "VERIFIED" as const, description: "Komunitas contoh yang membahas sastra Indonesia dan terjemahan dunia setiap bulan." },
    { n: 303, ownerId: seedId(3), name: "Temu Sastra Dummy Kota Tua", publicLocation: "Kota Tua, Jakarta Barat", status: "VERIFIED" as const, description: "Komunitas contoh yang menggabungkan jalan kaki sejarah kota dengan diskusi novel berlatar sejarah." },
    { n: 304, ownerId: seedId(4), name: "Komunitas Dummy Menunggu Verifikasi", publicLocation: "Depok", status: "PENDING" as const, description: "Contoh komunitas berstatus PENDING; tidak boleh tampil di halaman publik." },
].map(({ n, ...community }) => ({ id: seedId(n), ...community }));

const membershipRows = [
    [401, 1, 301, "OWNER"], [402, 2, 301, "MEMBER"], [403, 3, 301, "MEMBER"], [404, 4, 301, "MEMBER"],
    [405, 2, 302, "OWNER"], [406, 1, 302, "MEMBER"],
    [407, 3, 303, "OWNER"], [408, 4, 303, "MEMBER"],
    [409, 4, 304, "OWNER"],
].map(([n, user, community, role]) => ({
    id: seedId(n as number),
    userId: seedId(user as number),
    communityId: seedId(community as number),
    role: role as "OWNER" | "MEMBER",
    status: "ACTIVE" as const,
}));

const eventRows = [
    { n: 501, communityId: seedId(301), title: "Baca Senyap Pagi", startsAt: daysFromNow(3, 9), endsAt: daysFromNow(3, 11, 30), publicLocation: "Gazebo Taman Suropati, Menteng", description: "Acara contoh: membaca senyap 45 menit lalu berbagi kesan." },
    { n: 502, communityId: seedId(302), title: "Diskusi Laut Bercerita", startsAt: daysFromNow(5, 15), endsAt: daysFromNow(5, 17), publicLocation: "Perpustakaan Umum, Tebet", description: "Acara contoh: membahas tema ingatan dan kehilangan dalam novel." },
    { n: 503, communityId: seedId(303), title: "Jalan Sejarah & Bedah Novel", startsAt: daysFromNow(9, 8, 30), endsAt: daysFromNow(9, 12), publicLocation: "Taman Fatahillah, Kota Tua", description: "Acara contoh: menyusuri Kota Tua lalu diskusi novel berlatar kolonial." },
    { n: 504, communityId: seedId(301), title: "Tukar Buku Akhir Bulan", startsAt: daysFromNow(14, 16), endsAt: daysFromNow(14, 18), publicLocation: "Taman Suropati, Menteng", description: "Acara contoh: bawa satu buku, pulang dengan buku lain." },
    { n: 505, communityId: seedId(302), title: "Draf Acara Dummy", startsAt: daysFromNow(7, 10), endsAt: null, publicLocation: null, description: "Contoh DRAFT; tidak boleh tampil di halaman publik.", publicationStatus: "DRAFT" as const },
].map(({ n, ...event }) => ({ id: seedId(n), publicationStatus: "PUBLISHED" as const, ...event }));

const merchandiseRows = [
    { n: 601, communityId: seedId(301), title: "Tote Bag Kanvas Dummy", description: "Contoh merchandise: tas kanvas untuk membawa buku.", priceAmount: "85000", availability: "AVAILABLE" as const },
    { n: 602, communityId: seedId(302), title: "Pembatas Buku Kuningan Dummy", description: "Contoh merchandise: pembatas buku logam.", priceAmount: "35000", availability: "AVAILABLE" as const },
    { n: 603, communityId: seedId(303), title: "Pin Enamel Dummy", description: "Contoh merchandise edisi terbatas.", priceAmount: "45000", availability: "RESERVED" as const },
    { n: 604, communityId: seedId(301), title: "Zine Komunitas Dummy", description: "Contoh tanpa harga tetap.", priceAmount: null, priceNote: "Donasi sukarela", availability: "AVAILABLE" as const },
].map(({ n, ...item }) => ({ id: seedId(n), currency: "IDR", status: "PUBLISHED" as const, ...item }));

// Explicit timestamps keep the seed working even on a database that has not applied migration 0004 yet.
const stamped = <T extends object>(rows: T[]) => {
    const now = new Date();
    return rows.map((row) => ({ ...row, createdAt: now, updatedAt: now }));
};

async function main() {
    const databaseUrl = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
    if (!databaseUrl) throw new Error("Set DIRECT_URL or DATABASE_URL before seeding.");
    if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed dummy data with NODE_ENV=production.");

    // Same TLS behaviour as the app's development runtime (src/lib/db/config.ts).
    const pool = new Pool({
        connectionString: databaseUrl,
        ssl: getDatabaseTlsConfig("development", process.env.DATABASE_SSL_CA),
        max: 1,
    });
    const db = drizzle(pool, { schema });
    const reset = process.argv.includes("--reset");

    try {
        await db.transaction(async (tx) => {
            // Children first so foreign keys never block the cleanup.
            await tx.delete(merchandiseListings).where(inArray(merchandiseListings.id, merchandiseRows.map((row) => row.id)));
            await tx.delete(events).where(inArray(events.id, eventRows.map((row) => row.id)));
            await tx.delete(communityMemberships).where(inArray(communityMemberships.id, membershipRows.map((row) => row.id)));
            await tx.delete(communities).where(inArray(communities.id, communityRows.map((row) => row.id)));
            await tx.delete(bookListings).where(inArray(bookListings.id, listingRows.map((row) => row.id)));
            await tx.delete(books).where(inArray(books.id, bookRows.map((row) => row.id)));
            await tx.delete(userProfiles).where(inArray(userProfiles.id, users.map((row) => row.id)));
            if (reset) return;

            await tx.insert(userProfiles).values(stamped(users));
            await tx.insert(books).values(stamped(bookRows));
            await tx.insert(bookListings).values(stamped(listingRows));
            await tx.insert(communities).values(stamped(communityRows));
            await tx.insert(communityMemberships).values(stamped(membershipRows));
            await tx.insert(events).values(stamped(eventRows));
            await tx.insert(merchandiseListings).values(stamped(merchandiseRows));
        });

        console.log(reset
            ? "Dummy data removed."
            : `Dummy data seeded: ${users.length} profiles, ${bookRows.length} books, ${listingRows.length} listings, ${communityRows.length} communities, ${eventRows.length} events, ${merchandiseRows.length} merchandise.`);
    } finally {
        await pool.end();
    }
}

main().catch((error: unknown) => {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined;
    console.error("Seed failed:", cause ?? (error instanceof Error ? error.message.split(String.fromCharCode(10))[0] : "unknown error"));
    process.exit(1);
});
