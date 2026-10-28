/**
 * Checks for the synthetic dataset.
 *
 * - `validateRows`: in memory, before anything is written (dry run, unit tests).
 * - `SQL_CHECKS`: against the database after seeding. They read every row, seed or not, so they
 *   also catch app data that breaks the same rules. Each query returns the number of violations.
 * - `STAT_QUERIES`: distributions for the data quality report.
 */
import { sql, type SQL } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { isKnownKabkota } from "../../src/features/regions/regions";
import * as schema from "../../src/lib/db/schema";

import type { SeedRows } from "./generate";
import { isSeedId, SEED_ID_PATTERN } from "./ids";

export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Rows of a raw query; node-postgres and PGlite both return `{ rows }`. */
export async function queryRows<T = Record<string, unknown>>(db: Pick<AnyDb, "execute">, query: string | SQL) {
    return ((await db.execute(typeof query === "string" ? sql.raw(query) : query)) as { rows: T[] }).rows;
}
export type Issue = { check: string; detail: string };

const enumOf: Partial<Record<keyof SeedRows, Record<string, readonly string[]>>> = {
    user_profiles: { role: schema.userRoles },
    books: { provider: schema.bookProviderValues },
    communities: { status: schema.communityStatusValues },
    community_submissions: { status: schema.verificationStatusValues },
    community_memberships: { role: schema.membershipRoleValues, status: schema.membershipStatusValues },
    events: { publicationStatus: schema.publicationStatusValues, locationType: schema.eventLocationTypeValues },
    places: { type: schema.placeTypeValues },
    merchandise_listings: { status: schema.merchandiseStatusValues, availability: schema.listingAvailabilityValues },
    book_listings: { condition: schema.bookConditionValues, availability: schema.listingAvailabilityValues },
    borrow_requests: { status: schema.borrowRequestStatusValues },
    borrowings: { status: schema.borrowingStatusValues, extensionStatus: schema.loanExtensionStatusValues },
    borrow_events: { type: schema.borrowEventTypeValues },
    book_accesses: { status: schema.bookAccessStatusValues },
    listing_appeals: { status: schema.verificationStatusValues },
    reports: { status: schema.reportStatusValues, targetType: schema.targetTypeValues },
    verifications: { status: schema.verificationStatusValues, targetType: schema.targetTypeValues },
    admin_audit_logs: { action: schema.adminAuditActionValues, targetType: schema.targetTypeValues },
};

/** Foreign keys among seeded rows: column → table it must point at (seed rows or reference ids). */
const references: Partial<Record<keyof SeedRows, Record<string, keyof SeedRows>>> = {
    user_profiles: { suspendedById: "user_profiles" },
    communities: { ownerId: "user_profiles" },
    community_submissions: { communityId: "communities", submittedById: "user_profiles", reviewerId: "user_profiles" },
    community_invites: { communityId: "communities", createdById: "user_profiles", usedById: "user_profiles" },
    community_memberships: { userId: "user_profiles", communityId: "communities" },
    events: { communityId: "communities" },
    places: { communityId: "communities", eventId: "events", createdById: "user_profiles" },
    merchandise_listings: { communityId: "communities" },
    book_listings: { ownerId: "user_profiles", bookId: "books", hiddenById: "user_profiles" },
    borrow_requests: { listingId: "book_listings", requesterId: "user_profiles", cancelledById: "user_profiles", meetingPlaceId: "places" },
    borrowings: { requestId: "borrow_requests", disputedById: "user_profiles", resolvedById: "user_profiles" },
    borrow_events: { requestId: "borrow_requests", actorId: "user_profiles" },
    book_accesses: { requestId: "borrow_requests" },
    listing_appeals: { listingId: "book_listings", ownerId: "user_profiles", reviewerId: "user_profiles" },
    reports: { reporterId: "user_profiles", reviewerId: "user_profiles" },
    verifications: { reviewerId: "user_profiles" },
    user_interests: { userId: "user_profiles" },
    bookmarks: { userId: "user_profiles", bookId: "books" },
    admin_audit_logs: { actorId: "user_profiles" },
};

const targetTables: Record<string, keyof SeedRows> = {
    BOOK: "books", BOOK_LISTING: "book_listings", COMMUNITY: "communities", EVENT: "events",
    MERCHANDISE_LISTING: "merchandise_listings", USER: "user_profiles", BORROWING: "borrowings", PLACE: "places",
};

type AnyRow = Record<string, unknown> & { id?: string };
const time = (value: unknown) => (value instanceof Date ? value.getTime() : null);

/** `refIds`: ids of existing (non-seed) rows the dataset may point at, per table. */
export function validateRows(rows: SeedRows, context: { anchor: Date; refIds: Partial<Record<keyof SeedRows, Set<string>>> }): Issue[] {
    const issues: Issue[] = [];
    const fail = (check: string, detail: string) => { if (issues.length < 200) issues.push({ check, detail }); };
    const ids = Object.fromEntries(Object.entries(rows).map(([table, list]) => [table, new Set((list as AnyRow[]).map((row) => row.id!))])) as Record<keyof SeedRows, Set<string>>;
    const exists = (table: keyof SeedRows, id: string) => ids[table].has(id) || Boolean(context.refIds[table]?.has(id));
    const limit = context.anchor.getTime() + 60_000;

    for (const [table, list] of Object.entries(rows) as [keyof SeedRows, AnyRow[]][]) {
        const seen = new Set<string>();
        for (const row of list) {
            if (!row.id || !isSeedId(row.id)) fail("seed-id", `${table}: ${row.id} is not a seed id`);
            if (seen.has(row.id!)) fail("unique-id", `${table}: duplicate ${row.id}`);
            seen.add(row.id!);
            for (const [column, values] of Object.entries(enumOf[table] ?? {})) {
                const value = row[column];
                if (value != null && !values.includes(value as string)) fail("enum", `${table}.${column} = ${String(value)}`);
            }
            for (const [column, target] of Object.entries(references[table] ?? {})) {
                const value = row[column];
                if (value != null && !exists(target, value as string)) fail("foreign-key", `${table}.${column} → ${target} ${String(value)}`);
            }
            const created = time(row.createdAt ?? row.requestedAt);
            if (created !== null && created > limit) fail("future-created", `${table} ${row.id}`);
            const updated = time(row.updatedAt);
            if (created !== null && updated !== null && updated < created) fail("updated-before-created", `${table} ${row.id}`);
            if (typeof row.regionCode === "string" && !isKnownKabkota(row.regionCode)) fail("region-code", `${table} ${row.id}: ${row.regionCode}`);
            if ((table === "reports" || table === "verifications" || table === "admin_audit_logs") && !exists(targetTables[row.targetType as string] ?? "books", row.targetId as string)) {
                fail("polymorphic-target", `${table} ${row.id} → ${String(row.targetType)} ${String(row.targetId)}`);
            }
        }
    }

    // Uniques and limits the schema enforces, so a dry run fails before the database does.
    const uniqueBy = <T extends AnyRow>(table: keyof SeedRows, list: T[], key: (row: T) => string | null) => {
        const seen = new Set<string>();
        for (const row of list) {
            const value = key(row);
            if (value === null) continue;
            if (seen.has(value)) fail("unique", `${table}: ${value}`);
            seen.add(value);
        }
    };
    uniqueBy("bookmarks", rows.bookmarks, (row) => `${row.userId}|${row.bookId}`);
    uniqueBy("user_interests", rows.user_interests, (row) => `${row.userId}|${row.subject}`);
    uniqueBy("community_memberships", rows.community_memberships, (row) => `${row.userId}|${row.communityId}`);
    uniqueBy("books", rows.books, (row) => `${row.provider}|${row.providerId}`);
    uniqueBy("community_invites", rows.community_invites, (row) => row.tokenHash);
    uniqueBy("places", rows.places, (row) => row.communityId ?? null);
    uniqueBy("places", rows.places, (row) => row.eventId ?? null);
    uniqueBy("borrowings", rows.borrowings, (row) => row.requestId);
    uniqueBy("borrow_requests", rows.borrow_requests, (row) => (row.status === "APPROVED" ? row.listingId : null));
    uniqueBy("borrow_requests", rows.borrow_requests, (row) => (row.status === "PENDING" || row.status === "APPROVED" ? `${row.listingId}|${row.requesterId}` : null));
    uniqueBy("listing_appeals", rows.listing_appeals, (row) => (row.status === "PENDING" ? row.listingId : null));

    for (const row of rows.communities) if ((row.interests?.length ?? 0) > 5) fail("community-interests", row.id!);
    for (const row of rows.merchandise_listings) {
        if ((row.photoPaths?.length ?? 0) > 3) fail("merch-photos", row.id!);
        if ((row.variants?.length ?? 0) > 10) fail("merch-variants", row.id!);
        if (row.priceAmount != null && row.currency !== "IDR") fail("merch-currency", row.id!);
    }
    for (const row of rows.borrow_requests) if (row.loanDays! < 1 || row.loanDays! > 60) fail("loan-days", row.id!);
    for (const row of rows.borrowings) if (row.extensionDays != null && (row.extensionDays < 1 || row.extensionDays > 14)) fail("extension-days", row.id!);
    for (const row of rows.events) if (row.startsAt && row.endsAt && row.endsAt < row.startsAt) fail("event-times", row.id!);
    for (const row of rows.places) {
        if (row.latitude < -11.5 || row.latitude > 6.5 || row.longitude < 94.5 || row.longitude > 141.5) fail("coordinates", row.id!);
        if ((row.type === "COMMUNITY") !== Boolean(row.communityId) || (row.type === "EVENT") !== Boolean(row.eventId)) fail("place-owner", row.id!);
    }

    // Loan events must be in time order and start with REQUESTED.
    const requestedAt = new Map(rows.borrow_requests.map((row) => [row.id!, row.requestedAt!.getTime()]));
    const lastEvent = new Map<string, number>();
    for (const row of rows.borrow_events) {
        const at = row.createdAt!.getTime();
        const previous = lastEvent.get(row.requestId);
        if (previous === undefined && row.type !== "REQUESTED") fail("loan-events-first", row.requestId);
        if ((previous ?? requestedAt.get(row.requestId) ?? at) > at) fail("loan-events-order", row.requestId);
        lastEvent.set(row.requestId, at);
    }
    return issues;
}

export type SqlCheck = { name: string; description: string; sql: string };
const seed = `'${SEED_ID_PATTERN}'`;

export const SQL_CHECKS: SqlCheck[] = [
    { name: "one-approved-per-listing", description: "Paling banyak satu permintaan APPROVED per salinan", sql: `select count(*) from (select "listingId" from borrow_requests where status = 'APPROVED' group by 1 having count(*) > 1) x` },
    { name: "one-open-per-requester", description: "Satu permintaan terbuka per peminjam per salinan", sql: `select count(*) from (select "listingId", "requesterId" from borrow_requests where status in ('PENDING','APPROVED') group by 1, 2 having count(*) > 1) x` },
    { name: "completed-has-borrowing", description: "Permintaan COMPLETED punya pinjaman, dan sebaliknya", sql: `select (select count(*) from borrow_requests r where r.status = 'COMPLETED' and not exists (select 1 from borrowings b where b."requestId" = r.id)) + (select count(*) from borrowings b join borrow_requests r on r.id = b."requestId" where r.status <> 'COMPLETED')` },
    { name: "handover-both-sides", description: "COMPLETED butuh dua konfirmasi serah terima; APPROVED belum punya keduanya", sql: `select count(*) from borrow_requests where (status = 'COMPLETED' and ("ownerHandoverAt" is null or "requesterHandoverAt" is null)) or (status = 'APPROVED' and "ownerHandoverAt" is not null and "requesterHandoverAt" is not null)` },
    { name: "listing-availability", description: "RESERVED tepat ketika ada permintaan diterima atau pinjaman berjalan", sql: `select count(*) from book_listings l, lateral (select exists (select 1 from borrow_requests r left join borrowings b on b."requestId" = r.id where r."listingId" = l.id and (r.status = 'APPROVED' or b.status in ('ACTIVE','OVERDUE','DISPUTED'))) as busy) s where (l.availability = 'RESERVED') <> s.busy` },
    { name: "borrowing-times", description: "Urutan waktu pinjaman: diminta ≤ diserahkan ≤ tenggat, kembali setelah serah terima", sql: `select count(*) from borrowings b join borrow_requests r on r.id = b."requestId" where b."handedOverAt" < r."requestedAt" or b."dueAt" < b."handedOverAt" or b."returnedAt" < b."handedOverAt" or (b.status = 'RETURNED' and b."returnedAt" is null) or (b.status in ('ACTIVE','DISPUTED') and b."returnedAt" is not null) or (b.status = 'RETURNED' and b."resolvedAt" is null and (b."ownerReturnAt" is null or b."requesterReturnAt" is null))` },
    { name: "dispute-fields", description: "Sengketa punya alasan; yang diputuskan berstatus RETURNED/LOST", sql: `select count(*) from borrowings where (status = 'DISPUTED' and ("disputedAt" is null or "disputeReason" is null or "resolvedAt" is not null)) or ("resolvedAt" is not null and (status not in ('RETURNED','LOST') or "resolvedById" is null or "disputedAt" > "resolvedAt"))` },
    { name: "extension-fields", description: "Perpanjangan diajukan sebelum tenggat dan dijawab setelah diajukan", sql: `select count(*) from borrowings where ("extensionStatus" is not null and ("extensionRequestedAt" is null or "extensionDays" is null)) or ("extensionStatus" in ('APPROVED','REJECTED') and ("extensionRespondedAt" is null or "extensionRespondedAt" < "extensionRequestedAt")) or ("extensionRequestedAt" < "handedOverAt")` },
    { name: "loan-events-order", description: "Peristiwa pinjaman tidak mendahului permintaan dan diawali REQUESTED", sql: `select (select count(*) from borrow_events e join borrow_requests r on r.id = e."requestId" where e."createdAt" < r."requestedAt") + (select count(*) from (select distinct on ("requestId") "requestId", type from borrow_events order by "requestId", "createdAt", (type <> 'REQUESTED')) f where f.type <> 'REQUESTED')` },
    { name: "loan-events-terminal", description: "Status akhir punya peristiwanya (REJECTED, CANCELLED, RETURNED, DISPUTED)", sql: `select (select count(*) from borrow_requests r where r.status in ('REJECTED','CANCELLED') and not exists (select 1 from borrow_events e where e."requestId" = r.id and e.type = r.status)) + (select count(*) from borrowings b where b.status in ('RETURNED','LOST') and not exists (select 1 from borrow_events e where e."requestId" = b."requestId" and e.type in ('RETURNED','DISPUTE_RESOLVED'))) + (select count(*) from borrowings b where b.status = 'DISPUTED' and not exists (select 1 from borrow_events e where e."requestId" = b."requestId" and e.type = 'DISPUTE_OPENED'))` },
    { name: "event-times", description: "Acara selesai setelah mulai", sql: `select count(*) from events where "endsAt" < "startsAt"` },
    { name: "community-owner", description: "Pemilik komunitas punya keanggotaan OWNER aktif, dan OWNER hanya pemiliknya", sql: `select (select count(*) from communities c where not exists (select 1 from community_memberships m where m."communityId" = c.id and m."userId" = c."ownerId" and m.role = 'OWNER' and m.status = 'ACTIVE')) + (select count(*) from community_memberships m join communities c on c.id = m."communityId" where m.role = 'OWNER' and m."userId" <> c."ownerId")` },
    { name: "community-pin-region", description: "Pin komunitas memakai kab/kota komunitasnya", sql: `select count(*) from places p join communities c on c.id = p."communityId" where p."regionCode" is distinct from c."regionCode"` },
    { name: "polymorphic-targets", description: "Target laporan, verifikasi, dan audit ada", sql: `select count(*) from (select "targetType" t, "targetId" i from reports union all select "targetType", "targetId" from verifications union all select "targetType", "targetId" from admin_audit_logs where action <> 'ACCOUNT_DELETED' and "targetType" <> 'OTHER') x where not case t when 'BOOK' then exists (select 1 from books where id = i) when 'BOOK_LISTING' then exists (select 1 from book_listings where id = i) when 'COMMUNITY' then exists (select 1 from communities where id = i) when 'EVENT' then exists (select 1 from events where id = i) when 'MERCHANDISE_LISTING' then exists (select 1 from merchandise_listings where id = i) when 'USER' then exists (select 1 from user_profiles where id = i) when 'BORROWING' then exists (select 1 from borrowings where id = i) when 'PLACE' then exists (select 1 from places where id = i) else true end` },
    { name: "appeal-state", description: "Banding PENDING untuk listing tersembunyi; banding diterima memulihkan listing", sql: `select count(*) from listing_appeals a join book_listings l on l.id = a."listingId" where (a.status = 'PENDING' and l."hiddenAt" is null) or (a.status = 'APPROVED' and l."hiddenAt" is not null and l."hiddenAt" < a."reviewedAt") or (a.status <> 'PENDING' and (a."reviewedAt" is null or a."reviewNote" is null))` },
    { name: "invite-use", description: "Undangan terpakai sebelum kedaluwarsa oleh pengurus yang tercatat", sql: `select count(*) from community_invites i where i."usedAt" is not null and (i."usedAt" > i."expiresAt" or not exists (select 1 from community_memberships m where m."communityId" = i."communityId" and m."userId" = i."usedById" and m.role = 'MANAGER'))` },
    { name: "merch-price", description: "Harga merchandise bermata uang IDR dan positif", sql: `select count(*) from merchandise_listings where "priceAmount" is not null and ("currency" is distinct from 'IDR' or "priceAmount" <= 0)` },
    { name: "order-items", description: "Kuantitas order item ≥ 1", sql: `select count(*) from order_items where quantity < 1` },
    { name: "created-before-updated", description: "createdAt tidak setelah updatedAt", sql: `select (select count(*) from user_profiles where "createdAt" > "updatedAt") + (select count(*) from books where "createdAt" > "updatedAt") + (select count(*) from communities where "createdAt" > "updatedAt") + (select count(*) from events where "createdAt" > "updatedAt") + (select count(*) from merchandise_listings where "createdAt" > "updatedAt") + (select count(*) from book_listings where "createdAt" > "updatedAt") + (select count(*) from borrow_requests where "requestedAt" > "updatedAt") + (select count(*) from borrowings where "createdAt" > "updatedAt") + (select count(*) from reports where "createdAt" > "updatedAt")` },
    { name: "activity-after-signup", description: "Bookmark, listing, dan keanggotaan setelah akun dan objeknya dibuat", sql: `select (select count(*) from bookmarks b join user_profiles u on u.id = b."userId" join books k on k.id = b."bookId" where b."createdAt" < u."createdAt" or b."createdAt" < k."createdAt") + (select count(*) from book_listings l join user_profiles u on u.id = l."ownerId" where l."createdAt" < u."createdAt") + (select count(*) from community_memberships m join communities c on c.id = m."communityId" where m."createdAt" < c."createdAt")` },
    { name: "report-review", description: "Laporan diputus punya peninjau dan waktu; PENDING belum", sql: `select count(*) from reports where (status in ('RESOLVED','REJECTED') and ("reviewerId" is null or "reviewedAt" is null or "reviewedAt" < "createdAt")) or (status = 'PENDING' and ("reviewedAt" is not null or "reviewerId" is not null))` },
    { name: "suspension-fields", description: "Akun ditangguhkan punya alasan dan admin", sql: `select count(*) from user_profiles where "suspendedAt" is not null and ("suspendedReason" is null or "suspendedById" is null)` },
    { name: "book-access-state", description: "Akses buku mengikuti pinjamannya: ACTIVE selama berjalan, EXPIRED setelah kembali, REVOKED dengan waktu dicabut", sql: `select count(*) from book_accesses a join borrow_requests r on r.id = a."requestId" left join borrowings b on b."requestId" = r.id where (a.status = 'ACTIVE' and not (r.status = 'APPROVED' or b.status in ('ACTIVE','OVERDUE','DISPUTED'))) or (a.status = 'EXPIRED' and b.status is distinct from 'RETURNED') or (a.status = 'REVOKED' and a."revokedAt" is null) or a."grantedAt" < r."requestedAt"` },
    { name: "library-from-place", description: "Perpustakaan seed berasal dari tempat LIBRARY di Peta Literasi", sql: `select count(*) from libraries l where l.id::text ~ ${seed} and not exists (select 1 from places p where p.type = 'LIBRARY' and p.name = l.name)` },
    { name: "seed-not-in-future", description: "Baris seed tidak dibuat di masa depan", sql: `select (select count(*) from user_profiles where id::text ~ ${seed} and "createdAt" > now()) + (select count(*) from borrow_events where id::text ~ ${seed} and "createdAt" > now()) + (select count(*) from reports where id::text ~ ${seed} and "createdAt" > now()) + (select count(*) from events where id::text ~ ${seed} and "createdAt" > now())` },
];

export async function runSqlChecks(db: AnyDb) {
    const results: { check: SqlCheck; violations: number }[] = [];
    for (const check of SQL_CHECKS) {
        const [row] = await queryRows<{ n: number }>(db, `select (${check.sql})::int as n`);
        results.push({ check, violations: Number(row.n) });
    }
    return results;
}

/** Distribution queries for the report: each returns rows of `label` + `n` (+ optional columns). */
export const STAT_QUERIES: { name: string; sql: string }[] = [
    { name: "Baris per tabel (seed / total)", sql: `select t as label, s as seed, n from (values ${["user_profiles", "books", "communities", "community_submissions", "community_invites", "community_memberships", "events", "places", "merchandise_listings", "book_listings", "borrow_requests", "borrowings", "borrow_events", "listing_appeals", "reports", "verifications", "user_interests", "bookmarks", "admin_audit_logs", "orders", "order_items", "recommendations", "book_accesses", "libraries", "book_sync_logs", "app_settings"].map((t) => `('${t}', (select count(*) from ${t} where ${t === "app_settings" ? "false" : `id::text ~ ${seed}`}), (select count(*) from ${t}))`).join(", ")}) v(t, s, n)` },
    { name: "Status permintaan pinjam", sql: `select status as label, count(*) n from borrow_requests group by 1 order by 2 desc` },
    { name: "Keadaan pinjaman (OVERDUE dihitung dari dueAt)", sql: `select case when status = 'ACTIVE' and "dueAt" < now() then 'OVERDUE (terhitung)' else status end as label, count(*) n from borrowings group by 1 order by 2 desc` },
    { name: "Perpanjangan", sql: `select coalesce("extensionStatus", '(tidak ada)') as label, count(*) n from borrowings group by 1 order by 2 desc` },
    { name: "Ketersediaan listing", sql: `select availability || case when "hiddenAt" is not null then ' (tersembunyi)' else '' end as label, count(*) n from book_listings group by 1 order by 2 desc` },
    { name: "Status komunitas", sql: `select status as label, count(*) n from communities group by 1 order by 2 desc` },
    { name: "Keanggotaan (peran/status)", sql: `select role || ' / ' || status as label, count(*) n from community_memberships group by 1 order by 2 desc` },
    { name: "Status acara", sql: `select "publicationStatus" || ' / ' || "locationType" as label, count(*) n from events group by 1 order by 2 desc` },
    { name: "Status merchandise", sql: `select status as label, count(*) n from merchandise_listings group by 1 order by 2 desc` },
    { name: "Laporan (jenis target / status)", sql: `select "targetType" || ' / ' || status as label, count(*) n from reports group by 1 order by 1` },
    { name: "Verifikasi (target / status)", sql: `select "targetType" || ' / ' || status as label, count(*) n from verifications group by 1 order by 1` },
    { name: "Aksi audit admin", sql: `select action as label, count(*) n from admin_audit_logs group by 1 order by 2 desc` },
    { name: "Pendaftar per bulan", sql: `select to_char("createdAt", 'YYYY-MM') as label, count(*) n from user_profiles group by 1 order by 1` },
    { name: "Permintaan pinjam per bulan", sql: `select to_char("requestedAt", 'YYYY-MM') as label, count(*) n from borrow_requests group by 1 order by 1` },
    { name: "Bookmark per pengguna (persentil)", sql: `select p as label, percentile_disc(p) within group (order by n) as n from (select u.id, count(b.id) n from user_profiles u left join bookmarks b on b."userId" = u.id group by 1) x, unnest(array[0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 1.0]) p group by p order by p` },
    { name: "Anggota aktif per komunitas terverifikasi (persentil)", sql: `select p as label, percentile_disc(p) within group (order by n) as n from (select c.id, count(m.id) filter (where m.status = 'ACTIVE') n from communities c left join community_memberships m on m."communityId" = c.id where c.status = 'VERIFIED' group by 1) x, unnest(array[0.1, 0.25, 0.5, 0.75, 0.9, 1.0]) p group by p order by p` },
    { name: "Listing per pemilik (persentil)", sql: `select p as label, percentile_disc(p) within group (order by n) as n from (select "ownerId", count(*) n from book_listings group by 1) x, unnest(array[0.25, 0.5, 0.75, 0.9, 0.99, 1.0]) p group by p order by p` },
    { name: "Permintaan per listing (persentil)", sql: `select p as label, percentile_disc(p) within group (order by n) as n from (select l.id, count(r.id) n from book_listings l left join borrow_requests r on r."listingId" = l.id group by 1) x, unnest(array[0.25, 0.5, 0.75, 0.9, 0.99, 1.0]) p group by p order by p` },
    { name: "Acara per komunitas aktif (persentil)", sql: `select p as label, percentile_disc(p) within group (order by n) as n from (select c.id, count(e.id) n from communities c left join events e on e."communityId" = c.id where c.status in ('VERIFIED','SUSPENDED') group by 1) x, unnest(array[0.25, 0.5, 0.75, 0.9, 1.0]) p group by p order by p` },
    { name: "Harga merchandise per kategori (Rp)", sql: `select coalesce(category, '-') as label, count(*) n, min("priceAmount")::int as min, percentile_disc(0.5) within group (order by "priceAmount")::int as median, max("priceAmount")::int as max from merchandise_listings where "priceAmount" is not null group by 1 order by 1` },
    { name: "Genre buku sintetis", sql: `select c as label, count(*) n from books, unnest(categories) c where id::text ~ ${seed} group by 1 order by 2 desc` },
    { name: "Kolom opsional terisi (% baris seed)", sql: `select label, round(100.0 * filled / nullif(total, 0), 1) as n from (values ('books.description', (select count(description) from books where id::text ~ ${seed}), (select count(*) from books where id::text ~ ${seed})), ('books.publisher', (select count(publisher) from books where id::text ~ ${seed}), (select count(*) from books where id::text ~ ${seed})), ('user_profiles.regionCode', (select count("regionCode") from user_profiles where id::text ~ ${seed}), (select count(*) from user_profiles where id::text ~ ${seed})), ('borrow_requests.note', (select count(note) from borrow_requests where id::text ~ ${seed}), (select count(*) from borrow_requests where id::text ~ ${seed})), ('book_listings.publicLocation', (select count("publicLocation") from book_listings where id::text ~ ${seed}), (select count(*) from book_listings where id::text ~ ${seed})), ('merchandise_listings.priceAmount', (select count("priceAmount") from merchandise_listings where id::text ~ ${seed}), (select count(*) from merchandise_listings where id::text ~ ${seed})), ('reports.details', (select count(details) from reports where id::text ~ ${seed}), (select count(*) from reports where id::text ~ ${seed}))) v(label, filled, total)` },
    { name: "Ukuran database", sql: `select 'pg_database_size' as label, pg_size_pretty(pg_database_size(current_database())) as n` },
];

export async function runStats(db: AnyDb) {
    const out: { name: string; rows: Record<string, unknown>[] }[] = [];
    for (const query of STAT_QUERIES) {
        try {
            out.push({ name: query.name, rows: await queryRows(db, query.sql) });
        } catch (error) {
            out.push({ name: query.name, rows: [{ label: "error", n: error instanceof Error ? error.message : String(error) }] });
        }
    }
    return out;
}
