/**
 * Builds the whole synthetic dataset in memory: a pure function of the profile, the anchor date, and
 * the reference rows read from the database (real Peta Literasi places and catalog books). Nothing is
 * written here; `apply.ts` inserts the result and `validate.ts` checks it.
 *
 * Rows follow the app's own write paths (src/lib/db/queries/*): a loan goes request → approve →
 * both handovers → borrowing → both returns, with the same events and listing availability the
 * route handlers would produce, and a community goes application → review → content.
 */
import { createHash } from "node:crypto";

import { AUTO_REJECTION_REASON, dueDateFrom, loanDayChoices, problemReasons, rejectionReasons } from "../../src/features/borrowing/lifecycle";
import { composeListingDetails } from "../../src/features/book-listings/listing-draft";
import { genres } from "../../src/features/books/genres";
import { merchandiseCategories } from "../../src/features/community-management/rules";
import { regionByCode } from "../../src/features/regions/regions";
import { reportReasonsFor, type ReportTargetType } from "../../src/features/reports/report-reasons";
import type * as schema from "../../src/lib/db/schema";

import { SEED_VERSION, type SeedProfile } from "./config";
import { seedId, type SeedTable } from "./ids";
import { addDays, addHours, createRng, DAY_MS, maxDate, minDate, weightedSampler, type Rng } from "./random";
import * as vocab from "./vocab";

type Insert<T extends { $inferInsert: unknown }> = T["$inferInsert"];

export type SeedRows = {
    user_profiles: Insert<typeof schema.userProfiles>[];
    books: Insert<typeof schema.books>[];
    communities: Insert<typeof schema.communities>[];
    community_submissions: Insert<typeof schema.communitySubmissions>[];
    community_invites: Insert<typeof schema.communityInvites>[];
    community_memberships: Insert<typeof schema.communityMemberships>[];
    events: Insert<typeof schema.events>[];
    places: Insert<typeof schema.places>[];
    merchandise_listings: Insert<typeof schema.merchandiseListings>[];
    book_listings: Insert<typeof schema.bookListings>[];
    borrow_requests: Insert<typeof schema.borrowRequests>[];
    borrowings: Insert<typeof schema.borrowings>[];
    borrow_events: Insert<typeof schema.borrowEvents>[];
    listing_appeals: Insert<typeof schema.listingAppeals>[];
    reports: Insert<typeof schema.reports>[];
    verifications: Insert<typeof schema.verifications>[];
    user_interests: Insert<typeof schema.userInterests>[];
    bookmarks: Insert<typeof schema.bookmarks>[];
    admin_audit_logs: Insert<typeof schema.adminAuditLogs>[];
};

/** Curated places (not hidden) used as venues, meeting points, and community pins. Coordinates are real. */
export type RefPlace = { id: string; type: string; name: string; addressPublic: string | null; regionCode: string | null; latitude: number; longitude: number };
/** Existing catalog books (not seed-owned) that synthetic readers may bookmark or list. */
export type RefBook = { id: string; title: string; categories: string[]; createdAt: Date };

/** `reference`: fingerprint of `places` + `books`, stored with the seed so a re-run can tell they changed. */
export type SeedInput = { profile: SeedProfile; anchor: Date; places: RefPlace[]; books: RefBook[]; reference: string };

/** `dataset`: hash of every generated row, so a rerun can tell the generator or its inputs changed. */
export type SeedMeta = { version: number; profile: string; seed: number; anchor: string; reference: string; dataset: string };

/** Kab/kota used when the reference places do not cover enough of them (Jabodetabek and a few big cities). */
const FALLBACK_REGIONS = ["31.71", "31.72", "31.73", "31.74", "31.75", "36.03", "36.71", "36.74", "32.01", "32.75", "32.76", "33.74", "34.71", "35.78", "73.71"];

type Segment = "power" | "high" | "normal" | "low" | "dormant" | "recent";
const SEGMENTS: readonly (readonly [Segment, number])[] = [["power", 0.03], ["high", 0.12], ["normal", 0.42], ["low", 0.25], ["dormant", 0.12], ["recent", 0.06]];
const ACTIVITY: Record<Segment, number> = { power: 6, high: 2.5, normal: 1, low: 0.35, dormant: 0.6, recent: 0.7 };

type User = {
    id: string; index: number; segment: Segment; activity: number; createdAt: Date; lastActiveAt: Date;
    regionCode: string | null; admin: boolean; interests: string[];
    /** Suspended now, or asked for deletion: kept out of lending and community ownership. */
    restricted: boolean;
};
type Book = { id: string; title: string; categories: string[]; createdAt: Date; weight: number; synthetic: boolean };
type Community = { row: SeedRows["communities"][number] & { id: string; createdAt: Date }; ownerId: string; regionCode: string; activeFrom: Date | null; activeUntil: Date; managers: string[]; activity: number };

const GENRE_LABELS = genres.map((genre) => genre.label);
/** Readers do not spread evenly over genres: fiction and Indonesian literature dominate. */
const GENRE_WEIGHTS: Record<string, number> = {
    "Fiksi Sastra": 10, "Sastra Indonesia": 8, "Romansa": 6, "Anak & Remaja": 6, "Nonfiksi": 5, "Sejarah": 4, "Fiksi Sejarah": 3,
    "Pendidikan": 3, "Agama & Spiritualitas": 3, "Komik & Novel Grafis": 3, "Biografi": 2, "Keluarga": 2, "Persahabatan": 2,
    "Filsafat": 2, "Kesehatan Mental": 2, "Isu Sosial": 1.5, "Puisi": 1.5,
};
const genreEntries = GENRE_LABELS.map((label) => [label, GENRE_WEIGHTS[label] ?? 1] as const);

const slug = (text: string) => text.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");

export function generateSeed(input: SeedInput): { rows: SeedRows; meta: SeedMeta } {
    const { profile, anchor } = input;
    const root = createRng(profile.seed);
    const launch = addDays(anchor, -Math.round(profile.months * 30.4));
    const span = anchor.getTime() - launch.getTime();
    const counters = new Map<SeedTable, number>();
    const nextId = (table: SeedTable) => {
        const n = counters.get(table) ?? 0;
        counters.set(table, n + 1);
        return seedId(table, n);
    };
    const rows: SeedRows = {
        user_profiles: [], books: [], communities: [], community_submissions: [], community_invites: [], community_memberships: [],
        events: [], places: [], merchandise_listings: [], book_listings: [], borrow_requests: [], borrowings: [], borrow_events: [],
        listing_appeals: [], reports: [], verifications: [], user_interests: [], bookmarks: [], admin_audit_logs: [],
    };
    const meta: SeedMeta = { version: SEED_VERSION, profile: profile.name, seed: profile.seed, anchor: anchor.toISOString(), reference: input.reference, dataset: "" };

    // Places whose names can be stored in a listing's " & "-joined meeting points.
    const places = [...input.places].filter((place) => !place.name.includes(" & ")).sort((a, b) => a.id.localeCompare(b.id));
    const placesByRegion = new Map<string, RefPlace[]>();
    for (const place of places) if (place.regionCode) placesByRegion.set(place.regionCode, [...(placesByRegion.get(place.regionCode) ?? []), place]);
    const regionPool = [...new Set([...placesByRegion.keys(), ...FALLBACK_REGIONS])].filter((code) => regionByCode(code)).sort();
    const regionWeight = (code: string) => (placesByRegion.get(code)?.length ?? 0) + (code.startsWith("31.") || code.startsWith("36.") ? 6 : 2);
    const regionSampler = weightedSampler(regionPool, regionWeight);
    /** A curated place in the kab/kota (sometimes a neighbouring one in the same province); none outside the covered area. */
    const placeNear = (rng: Rng, regionCode: string | null) => {
        const local = regionCode ? placesByRegion.get(regionCode) : undefined;
        if (local?.length && rng.chance(0.85)) return rng.pick(local);
        const province = regionCode ? places.filter((place) => place.regionCode?.slice(0, 2) === regionCode.slice(0, 2)) : places;
        return province.length ? rng.pick(province) : local?.length ? rng.pick(local) : undefined;
    };
    const regionName = (code: string | null) => regionByCode(code)?.name ?? null;

    // ---- Users ------------------------------------------------------------------------------
    const users: User[] = [];
    {
        const rng = root.fork("users");
        for (let index = 0; index < profile.users; index += 1) {
            const admin = index < profile.admins;
            const segment: Segment = admin ? "normal" : rng.weighted(SEGMENTS);
            // Sign-ups grow over time (density rises toward the anchor); "recent" joined in the last three weeks.
            const createdAt = admin
                ? addDays(launch, rng.int(0, 10))
                : segment === "recent"
                    ? rng.date(addDays(anchor, -21), addHours(anchor, -2))
                    : new Date(launch.getTime() + Math.sqrt(rng.next()) * span * 0.97);
            const lastActiveAt = segment === "dormant"
                ? minDate(addDays(createdAt, rng.int(5, 60)), addDays(anchor, -60))
                : anchor;
            const given = rng.pick(vocab.givenNames);
            const displayName = rng.chance(0.8) ? `${given} ${rng.pick(vocab.familyNames)}` : `${given} ${rng.pick(vocab.familyNames)[0]}.`;
            const regionCode = rng.chance(0.82) ? regionSampler.draw(rng)! : null;
            const id = nextId("user_profiles");
            const interestCount = rng.weighted([[0, 0.22], [1, 0.18], [2, 0.2], [3, 0.17], [4, 0.1], [5, 0.07], [6, 0.04], [8, 0.02]]);
            const interests: string[] = [];
            while (interests.length < interestCount) {
                const label = rng.weighted(genreEntries);
                if (!interests.includes(label)) interests.push(label);
            }
            users.push({ id, index, segment, activity: ACTIVITY[segment] * Math.exp(rng.normal(0, 0.35)), createdAt: maxDate(createdAt, launch), lastActiveAt: maxDate(lastActiveAt, createdAt), regionCode, admin, interests, restricted: false });
            rows.user_profiles.push({
                id, displayName, role: admin ? "ADMIN" : "MEMBER", regionCode,
                preferences: null,
                createdAt: users[index].createdAt, updatedAt: users[index].createdAt,
            });
        }
    }
    const admins = users.filter((user) => user.admin);
    const pickAdmin = (rng: Rng) => rng.pick(admins).id;
    const userById = new Map(users.map((user) => [user.id, user]));
    const profileRow = new Map(rows.user_profiles.map((row) => [row.id!, row]));

    const audit = (row: Omit<SeedRows["admin_audit_logs"][number], "id">) => rows.admin_audit_logs.push({ id: nextId("admin_audit_logs"), ...row });
    // Admins after the first were promoted by the first (the first is set up by the platform owner).
    for (const user of admins.slice(1)) {
        audit({ actorId: admins[0].id, action: "USER_ROLE_CHANGED", targetType: "USER", targetId: user.id, note: "Bergabung sebagai pengelola platform.", metadata: { from: "MEMBER", to: "ADMIN" }, createdAt: addDays(user.createdAt, 1) });
    }

    // Suspensions (with the report that led to them) and pending deletion requests.
    const pendingUserReports: { userId: string; at: Date; decidedAt: Date; outcome: string }[] = [];
    {
        const rng = root.fork("account-states");
        for (const user of users) {
            if (user.admin || user.segment === "recent") continue;
            const row = profileRow.get(user.id)!;
            const roll = rng.next();
            if (roll < 0.02) {
                const suspendedAt = rng.between(addDays(user.createdAt, 10), addDays(anchor, -1));
                if (!suspendedAt) continue;
                const reason = rng.pick(vocab.suspensionReasons);
                const adminId = pickAdmin(rng);
                Object.assign(row, { suspendedAt, suspendedReason: reason, suspendedById: adminId, updatedAt: suspendedAt });
                audit({ actorId: adminId, action: "USER_SUSPENDED", targetType: "USER", targetId: user.id, note: reason, createdAt: suspendedAt });
                pendingUserReports.push({ userId: user.id, at: addDays(suspendedAt, -rng.int(1, 6)), decidedAt: suspendedAt, outcome: "Akun ditangguhkan." });
                user.restricted = true;
            } else if (roll < 0.026) {
                // Suspended once, reinstated later.
                const suspendedAt = rng.between(addDays(user.createdAt, 10), addDays(anchor, -20));
                if (!suspendedAt) continue;
                const reinstatedAt = addDays(suspendedAt, rng.int(3, 15));
                const adminId = pickAdmin(rng);
                audit({ actorId: adminId, action: "USER_SUSPENDED", targetType: "USER", targetId: user.id, note: rng.pick(vocab.suspensionReasons), createdAt: suspendedAt });
                audit({ actorId: pickAdmin(rng), action: "USER_REINSTATED", targetType: "USER", targetId: user.id, note: "Banding akun diterima.", createdAt: reinstatedAt });
                row.updatedAt = reinstatedAt;
                user.restricted = true;
            } else if (roll < 0.036 && user.lastActiveAt >= anchor) {
                const requestedAt = rng.between(maxDate(user.createdAt, addDays(anchor, -13)), addHours(anchor, -1));
                if (!requestedAt) continue;
                Object.assign(row, { deletionRequestedAt: requestedAt, deletionScheduledFor: addDays(requestedAt, 14), updatedAt: requestedAt });
                user.restricted = true;
            }
        }
    }
    const lenders = users.filter((user) => !user.admin && !user.restricted);
    const activeAt = (user: User, at: Date) => user.createdAt < at && user.lastActiveAt > at;

    // ---- Books ------------------------------------------------------------------------------
    const books: Book[] = [];
    {
        const rng = root.fork("books");
        const seen = new Set<string>();
        for (let index = 0; index < profile.books; index += 1) {
            const genre = rng.weighted(genreEntries);
            const second = rng.chance(0.3) ? rng.weighted(genreEntries) : null;
            const categories = [...new Set([genre, ...(second ? [second] : [])])];
            const author = `${rng.pick(vocab.givenNames)} ${rng.pick(vocab.familyNames)}`;
            const nonfiction = ["Nonfiksi", "Pendidikan", "Sejarah", "Filsafat", "Biografi", "Kesehatan Mental", "Isu Sosial", "Agama & Spiritualitas"].includes(genre);
            let title = nonfiction
                ? rng.pick([`Panduan ${rng.pick(vocab.nonfictionTopics)}`, `Catatan tentang ${rng.pick(vocab.nonfictionTopics)}`, `${rng.pick(vocab.nonfictionTopics)} untuk Pemula`, `Menimbang ${rng.pick(vocab.nonfictionTopics)}`])
                : rng.pick([`${rng.pick(vocab.titleNouns)} di ${rng.pick(vocab.titlePlaces)}`, `${rng.pick(vocab.titleNouns)} ${rng.pick(vocab.titleAdjectives)}`, `Kisah ${rng.pick(vocab.titleNouns)} ${rng.pick(vocab.titleAdjectives)}`, `${rng.pick(vocab.titleNouns)} dan ${rng.pick(vocab.titleNouns)}`]);
            // createManualBook treats the same title and first author as one book, so keep pairs unique.
            for (let volume = 2; seen.has(`${title}|${author}`.toLowerCase()); volume += 1) title = `${title.replace(/ \(Jilid \d+\)$/, "")} (Jilid ${volume})`;
            seen.add(`${title}|${author}`.toLowerCase());
            const coAuthor = rng.chance(0.08) ? [`${rng.pick(vocab.givenNames)} ${rng.pick(vocab.familyNames)}`] : [];
            const createdAt = rng.chance(0.35) ? addDays(launch, rng.int(0, 7)) : rng.date(launch, addDays(anchor, -1));
            const id = nextId("books");
            const description = rng.chance(0.82)
                ? [`${rng.pick(vocab.bookDescriptionOpeners)} ${rng.pick(vocab.bookDescriptionSubjects)}.`, ...rng.sample(vocab.bookDescriptionClosers, rng.int(0, 3))].join(" ")
                : null;
            rows.books.push({
                id, provider: "MANUAL", providerId: `seed-v${SEED_VERSION}-${index}`, isbn: null, title, authors: [author, ...coAuthor],
                description, publisher: rng.chance(0.85) ? rng.pick(vocab.publishers) : null,
                publishedAt: rng.chance(0.9) ? String(rng.weighted([[rng.int(1965, 1999), 0.2], [rng.int(2000, 2015), 0.35], [rng.int(2016, anchor.getUTCFullYear()), 0.45]])) : null,
                language: rng.chance(0.86) ? "id" : "en", categories, coverUrl: null,
                metadata: { synthetic: true, generator: "scripts/seed", seedVersion: SEED_VERSION },
                createdAt, updatedAt: createdAt,
            });
            books.push({ id, title, categories, createdAt, weight: 0, synthetic: true });
        }
        for (const book of [...input.books].sort((a, b) => a.id.localeCompare(b.id))) {
            books.push({ id: book.id, title: book.title, categories: book.categories, createdAt: maxDate(book.createdAt, launch), weight: 0, synthetic: false });
        }
        // Zipf-like popularity over a shuffled order: a few books are wanted by many readers.
        const order = rng.sample(books, books.length);
        order.forEach((book, rank) => { book.weight = 1 / Math.pow(rank + 1, 0.85); });
    }
    const bookSampler = weightedSampler(books, (book) => book.weight);
    const booksByGenre = new Map<string, Book[]>();
    for (const book of books) for (const label of book.categories) booksByGenre.set(label, [...(booksByGenre.get(label) ?? []), book]);
    const syntheticBooks = books.filter((book) => book.synthetic);

    // ---- Interests and bookmarks -------------------------------------------------------------
    {
        const rng = root.fork("reader-activity");
        for (const user of users) {
            // Interests are picked in the first days after sign-up, never after the reader went quiet.
            const pickedUntil = minDate(addDays(user.createdAt, 7), user.lastActiveAt);
            for (const subject of user.interests) rows.user_interests.push({ id: nextId("user_interests"), userId: user.id, subject, createdAt: rng.between(user.createdAt, pickedUntil) ?? user.createdAt });
            const target = rng.logNormalInt(profile.bookmarkMedian * user.activity, 0.7, 0, 120);
            const chosen = new Set<string>();
            for (let attempt = 0; chosen.size < target && attempt < target * 4; attempt += 1) {
                const favourite = user.interests.length && rng.chance(0.6) ? booksByGenre.get(rng.pick(user.interests)) : undefined;
                const book = favourite?.length ? rng.pick(favourite) : bookSampler.draw(rng)!;
                const from = maxDate(user.createdAt, book.createdAt);
                if (chosen.has(book.id) || from >= user.lastActiveAt) continue;
                chosen.add(book.id);
                rows.bookmarks.push({ id: nextId("bookmarks"), userId: user.id, bookId: book.id, createdAt: rng.date(from, user.lastActiveAt) });
            }
        }
    }

    // ---- Communities --------------------------------------------------------------------------
    const communities: Community[] = [];
    {
        const rng = root.fork("communities");
        const owners = weightedSampler(lenders.filter((user) => user.segment !== "dormant" && user.segment !== "low"), (user) => user.activity);
        const pendingByOwner = new Map<string, number>();
        const usedNames = new Set<string>();
        for (let index = 0; index < profile.communities; index += 1) {
            const kind = rng.pick(vocab.communityKinds);
            const status = rng.weighted([["VERIFIED", 0.58], ["PENDING", 0.17], ["REJECTED", 0.15], ["SUSPENDED", 0.1]] as const);
            const latest = status === "PENDING" ? addDays(anchor, -1) : addDays(anchor, -35);
            let owner = owners.draw(rng)!;
            for (let attempt = 0; attempt < 20 && (owner.createdAt >= addDays(latest, -3) || (status === "PENDING" && (pendingByOwner.get(owner.id) ?? 0) >= 3)); attempt += 1) owner = owners.draw(rng)!;
            if (owner.createdAt >= addDays(latest, -3)) continue;
            const createdAt = status === "PENDING" && rng.chance(0.7)
                ? rng.date(maxDate(owner.createdAt, addDays(anchor, -40)), latest)
                : rng.date(maxDate(addDays(owner.createdAt, 1), addDays(launch, 5)), latest);
            const regionCode = owner.regionCode ?? regionSampler.draw(rng)!;
            let name = `${rng.pick(kind.prefixes)} ${rng.pick(vocab.communityNameWords)}`;
            if (usedNames.has(name)) name = `${name} ${regionName(regionCode) ?? ""}`.trim();
            for (let n = 2; usedNames.has(name); n += 1) name = `${name.replace(/ \d+$/, "")} ${n}`;
            usedNames.add(name);
            const id = nextId("communities");
            const interests = rng.sample(kind.interests, rng.int(1, Math.min(5, kind.interests.length)));
            const row = {
                id, ownerId: owner.id, name, status: status as SeedRows["communities"][number]["status"], regionCode, interests,
                description: `${kind.blurb} ${rng.chance(0.6) ? `Terbuka untuk warga ${regionName(regionCode) ?? "sekitar"}.` : ""}`.trim(),
                publicLocation: regionName(regionCode),
                contactEmail: `halo.${slug(name)}@temubaca.test`, instagramHandle: null, whatsappNumber: null, logoPath: null,
                createdAt, updatedAt: createdAt,
            } satisfies SeedRows["communities"][number];
            rows.communities.push(row);
            rows.community_memberships.push({ id: nextId("community_memberships"), userId: owner.id, communityId: id, role: "OWNER", status: "ACTIVE", createdAt, updatedAt: createdAt });

            // Application (DEC-04) and the admin decisions on it, oldest first.
            const submit = (at: Date) => {
                const submission: SeedRows["community_submissions"][number] = { id: nextId("community_submissions"), communityId: id, submittedById: owner.id, evidenceUrl: `https://arsip.temubaca.test/komunitas/${slug(name)}`, note: rng.pick(vocab.evidenceNotes), status: "PENDING", createdAt: at };
                rows.community_submissions.push(submission);
                return submission;
            };
            const decide = (submission: SeedRows["community_submissions"][number] | null, at: Date, record: "APPROVED" | "REJECTED" | "REVOKED") => {
                const reviewerId = pickAdmin(rng);
                const note = rng.pick(vocab.reviewNotes[record]);
                rows.verifications.push({ id: nextId("verifications"), targetType: "COMMUNITY", targetId: id, status: record, reviewerId, note, reviewedAt: at, createdAt: at, updatedAt: at });
                if (submission) Object.assign(submission, { status: record === "APPROVED" ? "APPROVED" : "REJECTED", reviewerId, reviewNote: note, reviewedAt: at });
                row.updatedAt = at;
            };
            let first = submit(createdAt);
            let activeFrom: Date | null = null;
            let activeUntil = anchor;
            let at = addDays(createdAt, rng.int(1, 6));
            if (status === "PENDING") {
                if (rng.chance(0.3) && at < addDays(anchor, -3)) {
                    decide(first, at, "REJECTED");
                    first = submit(rng.date(addHours(at, 6), anchor));
                }
                pendingByOwner.set(owner.id, (pendingByOwner.get(owner.id) ?? 0) + 1);
            } else if (status === "REJECTED") {
                decide(first, at, "REJECTED");
            } else {
                if (rng.chance(0.15)) {
                    decide(first, at, "REJECTED");
                    at = addDays(at, rng.int(2, 12));
                    first = submit(at);
                    at = addDays(at, rng.int(1, 5));
                }
                decide(first, at, "APPROVED");
                activeFrom = at;
                if (status === "SUSPENDED") {
                    activeUntil = rng.between(addDays(at, 15), addDays(anchor, -1)) ?? rng.between(at, anchor)!;
                    decide(null, activeUntil, "REVOKED");
                } else if (rng.chance(0.06)) {
                    const suspendedAt = rng.between(addDays(at, 10), addDays(anchor, -20));
                    if (suspendedAt) {
                        decide(null, suspendedAt, "REVOKED");
                        activeFrom = addDays(suspendedAt, rng.int(3, 15));
                        decide(null, activeFrom, "APPROVED");
                    }
                }
                if (status === "VERIFIED" && rng.chance(0.15)) {
                    const resubmitAt = rng.date(addDays(activeFrom, 20), anchor);
                    if (resubmitAt > activeFrom && resubmitAt < anchor) {
                        const reverification = submit(resubmitAt);
                        const reviewAt = addDays(resubmitAt, rng.int(1, 10));
                        if (reviewAt < anchor && rng.chance(0.75)) {
                            const reviewerId = pickAdmin(rng);
                            if (rng.chance(0.7)) {
                                Object.assign(reverification, { status: "APPROVED", reviewerId, reviewNote: null, reviewedAt: reviewAt });
                                rows.verifications.push({ id: nextId("verifications"), targetType: "COMMUNITY", targetId: id, status: "APPROVED", reviewerId, note: "Pembaruan verifikasi dikonfirmasi.", reviewedAt: reviewAt, createdAt: reviewAt, updatedAt: reviewAt });
                            } else {
                                Object.assign(reverification, { status: "REJECTED", reviewerId, reviewNote: "Bukti pembaruan belum cukup; status tetap terverifikasi.", reviewedAt: reviewAt });
                            }
                        }
                    }
                }
            }
            communities.push({ row, ownerId: owner.id, regionCode, activeFrom, activeUntil, managers: [], activity: Math.exp(rng.normal(0, 0.6)) });
        }
    }

    // Managers by one-time invite, then ordinary members (counted on the profile as active members).
    {
        const rng = root.fork("memberships");
        for (const community of communities) {
            const { activeFrom, activeUntil } = community;
            if (!activeFrom) continue;
            const id = community.row.id;
            const taken = new Set([community.ownerId]);
            const inviteCount = rng.weighted([[0, 0.35], [1, 0.3], [2, 0.2], [3, 0.1], [4, 0.05]]);
            for (let n = 0; n < inviteCount; n += 1) {
                const createdAt = rng.date(activeFrom, activeUntil);
                const expiresAt = addDays(createdAt, 7);
                const inviteId = nextId("community_invites");
                const invite: SeedRows["community_invites"][number] = { id: inviteId, communityId: id, tokenHash: createHash("sha256").update(`temubaca-seed:${inviteId}`).digest("hex"), createdById: community.ownerId, expiresAt, createdAt };
                const outcome = expiresAt > anchor ? rng.weighted([["open", 0.6], ["used", 0.3], ["revoked", 0.1]] as const) : rng.weighted([["used", 0.6], ["revoked", 0.15], ["expired", 0.25]] as const);
                if (outcome === "used") {
                    const usedAt = rng.between(createdAt, minDate(expiresAt, anchor, activeUntil));
                    let manager: User | undefined;
                    for (let draw = 0; usedAt && !manager && draw < 40; draw += 1) {
                        const user = rng.pick(lenders);
                        if (!taken.has(user.id) && activeAt(user, usedAt)) manager = user;
                    }
                    if (manager && usedAt) {
                        taken.add(manager.id);
                        invite.usedAt = usedAt;
                        invite.usedById = manager.id;
                        const removedAt = rng.chance(0.1) ? rng.between(addDays(usedAt, 3), anchor) : null;
                        if (!removedAt) community.managers.push(manager.id);
                        rows.community_memberships.push({ id: nextId("community_memberships"), userId: manager.id, communityId: id, role: "MANAGER", status: removedAt ? "REMOVED" : "ACTIVE", createdAt: usedAt, updatedAt: removedAt ?? usedAt });
                    }
                } else if (outcome === "revoked") {
                    invite.revokedAt = rng.between(createdAt, minDate(expiresAt, anchor));
                }
                rows.community_invites.push(invite);
            }
            const memberCount = Math.round(rng.logNormalInt(profile.memberMedian, 0.9, 0, 400) * Math.sqrt(community.activity));
            const candidates = weightedSampler(users.filter((user) => !user.admin && !taken.has(user.id)), (user) => user.activity
                * (user.regionCode === community.regionCode ? 4 : 1)
                * (user.interests.some((label) => community.row.interests!.includes(label)) ? 2.5 : 1));
            for (let attempt = 0, added = 0; added < memberCount && attempt < memberCount * 5; attempt += 1) {
                const user = candidates.draw(rng);
                if (!user || taken.has(user.id)) continue;
                const joinedAt = rng.between(maxDate(activeFrom, user.createdAt), minDate(activeUntil, user.lastActiveAt));
                if (!joinedAt) continue;
                taken.add(user.id);
                added += 1;
                const status = rng.weighted([["ACTIVE", 0.75], ["PENDING", 0.07], ["LEFT", 0.11], ["REMOVED", 0.03], ["REJECTED", 0.04]] as const);
                const changedAt = status === "ACTIVE" || status === "PENDING" ? joinedAt : rng.between(joinedAt, anchor) ?? joinedAt;
                rows.community_memberships.push({ id: nextId("community_memberships"), userId: user.id, communityId: id, role: "MEMBER", status, createdAt: joinedAt, updatedAt: changedAt });
            }
        }
    }

    // ---- Community pins, events, and merchandise ---------------------------------------------
    {
        const rng = root.fork("community-content");
        let eventNumber = 0;
        for (const community of communities) {
            const { activeFrom, activeUntil, row } = community;
            if (!activeFrom) continue;
            const pinPlace = rng.chance(0.7) ? placeNear(rng, community.regionCode) : undefined;
            if (pinPlace) {
                const at = rng.date(activeFrom, activeUntil);
                rows.places.push({ id: nextId("places"), type: "COMMUNITY", name: row.name, addressPublic: pinPlace.addressPublic, latitude: pinPlace.latitude, longitude: pinPlace.longitude, regionCode: row.regionCode, communityId: row.id, createdById: community.ownerId, checkedAt: at, createdAt: at, updatedAt: at });
            }
            const organisers = [community.ownerId, ...community.managers];
            const eventCount = rng.logNormalInt(profile.eventMedian * community.activity, 0.7, 0, 30);
            for (let n = 0; n < eventCount; n += 1) {
                const kind = places.length ? rng.pick(vocab.eventKinds) : rng.pick(vocab.eventKinds.filter((item) => item.online));
                const createdAt = rng.date(activeFrom, activeUntil);
                const day = addDays(createdAt, rng.int(2, 35));
                // A WIB hour between 09:00 and 19:00 (UTC+7).
                const startsAt = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), rng.int(9, 19) - 7, rng.pick([0, 30])));
                const endsAt = addHours(startsAt, kind.online ? rng.pick([1, 1.5, 2]) : rng.pick([1.5, 2, 2.5, 3, 4]));
                const past = endsAt < anchor;
                const publicationStatus = community.row.status === "SUSPENDED" || past
                    ? rng.weighted([["PUBLISHED", 0.68], ["ARCHIVED", 0.27], ["DRAFT", 0.05]] as const)
                    : rng.weighted([["PUBLISHED", 0.72], ["DRAFT", 0.28]] as const);
                const draftMissing = publicationStatus === "DRAFT" ? rng.weighted([["none", 0.5], ["schedule", 0.3], ["location", 0.2]] as const) : "none";
                const venue = kind.online || draftMissing === "location" ? undefined : placeNear(rng, community.regionCode);
                const id = nextId("events");
                eventNumber += 1;
                const subject = rng.pick(syntheticBooks.length ? syntheticBooks : books).title;
                const title = kind.title(subject);
                const updatedAt = publicationStatus === "ARCHIVED" ? minDate(addDays(endsAt, rng.int(1, 20)), anchor) : addHours(createdAt, rng.int(0, 48));
                rows.events.push({
                    id, communityId: row.id, title, description: kind.description,
                    startsAt: draftMissing === "schedule" ? null : startsAt, endsAt: draftMissing === "schedule" ? null : endsAt,
                    locationType: kind.online ? "ONLINE" : "PHYSICAL",
                    venueName: venue?.name ?? null,
                    publicLocation: venue ? venue.addressPublic ?? regionName(venue.regionCode) : null,
                    eventUrl: kind.online && draftMissing !== "location" ? `https://daring.temubaca.test/acara/${eventNumber}` : null,
                    publicationStatus, createdAt, updatedAt: maxDate(updatedAt, createdAt),
                });
                if (venue && (publicationStatus !== "DRAFT" || rng.chance(0.5)) && rng.chance(0.85)) {
                    rows.places.push({ id: nextId("places"), type: "EVENT", name: title, addressPublic: venue.addressPublic, latitude: venue.latitude, longitude: venue.longitude, regionCode: venue.regionCode, eventId: id, createdById: rng.pick(organisers), checkedAt: createdAt, createdAt, updatedAt: createdAt });
                }
            }
            if (!rng.chance(0.55)) continue;
            const shortName = row.name.split(" ").slice(-1)[0];
            const merchCount = rng.logNormalInt(3 * community.activity, 0.6, 1, 12);
            for (let n = 0; n < merchCount; n += 1) {
                const template = rng.pick(vocab.merchTemplates);
                if (!(merchandiseCategories as readonly string[]).includes(template.category)) throw new Error(`Unknown merchandise category ${template.category}`);
                const createdAt = rng.date(activeFrom, activeUntil);
                const status = rng.weighted([["PUBLISHED", 0.65], ["DRAFT", 0.15], ["UNAVAILABLE", 0.1], ["ARCHIVED", 0.1]] as const);
                const priced = rng.chance(0.92);
                const [low, high] = template.price;
                rows.merchandise_listings.push({
                    id: nextId("merchandise_listings"), communityId: row.id, title: `${rng.pick(template.titles)} ${shortName}`,
                    description: `Merchandise resmi ${row.name}. Hasil penjualan dipakai untuk kegiatan komunitas.`,
                    priceAmount: priced ? String(Math.round(rng.int(low, high) / 5000) * 5000 || low) : null, currency: priced ? "IDR" : null,
                    priceNote: priced ? (rng.chance(0.15) ? "Harga belum termasuk ongkir" : null) : "Harga menyesuaikan, hubungi pengurus",
                    availability: status === "UNAVAILABLE" ? "UNAVAILABLE" : status === "PUBLISHED" && rng.chance(0.05) ? "RESERVED" : "AVAILABLE",
                    category: template.category, stockNote: rng.pick(vocab.stockNotes), contactOverride: null,
                    variants: rng.pick(template.variants), fulfillmentNote: rng.pick(vocab.fulfillmentNotes), photoPaths: [],
                    status, createdAt, updatedAt: addHours(createdAt, rng.int(0, 72)),
                });
            }
        }
    }

    // ---- Book listings and the loan lifecycle -------------------------------------------------
    type Listing = SeedRows["book_listings"][number] & { id: string; createdAt: Date; lastActivityAt: Date; open: boolean };
    const listings: Listing[] = [];
    {
        const rng = root.fork("listings");
        const owners = weightedSampler(lenders, (user) => user.activity);
        for (let index = 0, attempts = 0; index < profile.listings && attempts < profile.listings * 10; attempts += 1) {
            const owner = owners.draw(rng)!;
            const book = bookSampler.draw(rng)!;
            const from = addHours(maxDate(owner.createdAt, book.createdAt), 1);
            const to = minDate(owner.lastActiveAt, addDays(anchor, -1));
            if (from >= to) continue;
            index += 1;
            const createdAt = rng.date(from, to);
            const points = rng.weighted([[0, 0.1], [1, 0.5], [2, 0.3], [3, 0.1]]);
            const chosen: RefPlace[] = [];
            for (let n = 0; n < points * 3 && chosen.length < points; n += 1) {
                const place = placeNear(rng, owner.regionCode);
                if (place && !chosen.some((other) => other.name === place.name)) chosen.push(place);
            }
            // Outside the mapped area the owner types the points (TB-027 keeps free text); they have no place id.
            const typed = chosen.length || !points ? [] : rng.sample(vocab.typedMeetingPoints, points).map((point) => `${point}, ${regionName(owner.regionCode) ?? "dekat rumah"}`);
            const maxDays = rng.weighted([[7, 0.15], [14, 0.5], [21, 0.15], [30, 0.2]]);
            const details = composeListingDetails({ meetingPoints: [...chosen.map((place) => place.name), ...typed], loanDays: maxDays, conditionNote: rng.chance(0.3) ? rng.pick(vocab.conditionNotes) : undefined });
            const listing: Listing = {
                id: nextId("book_listings"), ownerId: owner.id, bookId: book.id,
                condition: rng.weighted([["LIKE_NEW", 0.3], ["GOOD", 0.5], ["FAIR", 0.2]] as const), availability: "AVAILABLE",
                publicLocation: details.publicLocation ?? null, borrowingRules: details.borrowingRules, meetingPlaceIds: chosen.map((place) => place.id),
                createdAt, updatedAt: createdAt, lastActivityAt: createdAt, open: false,
            };
            listings.push(listing);
            rows.book_listings.push(listing);
            simulateLoans(listing, owner, book, maxDays, chosen, typed, rng.fork(listing.id));
        }
    }

    function simulateLoans(listing: Listing, owner: User, book: Book, maxDays: number, meetingPlaces: RefPlace[], typedPoints: string[], rng: Rng) {
        const popularity = Math.min(3, Math.max(0.4, book.weight * 12));
        const requesters = weightedSampler(lenders.filter((user) => user.id !== owner.id), (user) => user.activity);
        const choices = loanDayChoices(maxDays);
        const touch = (at: Date) => { listing.updatedAt = at; listing.lastActivityAt = at; };
        let t = addDays(listing.createdAt, rng.logNormalInt(6 / popularity, 0.9, 0, 90));

        while (t < anchor) {
            if (rng.chance(0.03)) { listing.availability = "UNAVAILABLE"; touch(t); return; } // owner stopped offering it
            const wanted = rng.weighted([[1, 0.7], [2, 0.22], [3, 0.08]]);
            const round: { row: SeedRows["borrow_requests"][number] & { id: string; requestedAt: Date }; requester: User; cancelledAt: Date | null }[] = [];
            for (let n = 0; n < wanted * 4 && round.length < wanted; n += 1) {
                const requester = requesters.draw(rng);
                if (!requester || round.some((item) => item.requester.id === requester.id)) continue;
                const requestedAt = addHours(t, rng.int(0, 72));
                if (!activeAt(requester, requestedAt) || requestedAt >= anchor) continue;
                // The reader picks one of the owner's points; only map places carry a place id.
                const point = meetingPlaces.length ? rng.pick(meetingPlaces) : typedPoints.length ? { name: rng.pick(typedPoints), id: null } : null;
                const row: SeedRows["borrow_requests"][number] & { id: string; requestedAt: Date } = {
                    id: nextId("borrow_requests"), listingId: listing.id, requesterId: requester.id, status: "PENDING",
                    note: rng.chance(0.45) ? rng.pick(vocab.requestNotes) : null, meetingPoint: point?.name ?? null, meetingPlaceId: point?.id ?? null,
                    loanDays: rng.pick(choices), preferredTime: rng.chance(0.5) ? rng.pick(vocab.preferredTimes) : null,
                    requestedAt, updatedAt: requestedAt,
                };
                rows.borrow_requests.push(row);
                event(row.id, requester.id, "REQUESTED", null, requestedAt);
                round.push({ row, requester, cancelledAt: null });
            }
            if (!round.length) { t = addDays(t, rng.int(5, 30)); continue; }
            touch(round.reduce((latest, item) => maxDate(latest, item.row.requestedAt), t));
            const respondAt = addHours(listing.lastActivityAt, rng.int(1, 96));

            for (const item of round) {
                const cancelAt = addHours(item.row.requestedAt, rng.int(1, 48));
                if (rng.chance(0.07) && cancelAt < minDate(respondAt, anchor)) {
                    Object.assign(item.row, { status: "CANCELLED", cancelledById: item.requester.id, updatedAt: cancelAt });
                    event(item.row.id, item.requester.id, "CANCELLED", "Dibatalkan peminjam.", cancelAt);
                    item.cancelledAt = cancelAt;
                }
            }
            const open = round.filter((item) => !item.cancelledAt);
            if (respondAt >= anchor) { listing.open = open.length > 0; return; } // still waiting for the owner
            if (!open.length) { t = addDays(respondAt, rng.logNormalInt(10 / popularity, 0.9, 1, 120)); continue; }
            touch(respondAt);

            if (rng.chance(0.2)) {
                const markUnavailable = rng.chance(0.15);
                for (const item of open) {
                    const reason = rng.weighted(rejectionReasons.map((value) => [value, value === "Lainnya" ? 0.5 : 1] as const));
                    Object.assign(item.row, { status: "REJECTED", rejectionReason: reason, responseNote: rng.chance(0.3) ? rng.pick(vocab.responseNotes) : null, respondedAt: respondAt, updatedAt: respondAt });
                    event(item.row.id, owner.id, "REJECTED", reason, respondAt);
                }
                if (markUnavailable) { listing.availability = "UNAVAILABLE"; return; }
                t = addDays(respondAt, rng.logNormalInt(10 / popularity, 0.9, 1, 120));
                continue;
            }

            // Accepting one request reserves the copy and closes the other waiting requests.
            const chosen = open[0];
            const request = chosen.row;
            Object.assign(request, { status: "APPROVED", respondedAt: respondAt, updatedAt: respondAt });
            event(request.id, owner.id, "APPROVED", null, respondAt);
            for (const other of open.slice(1)) {
                Object.assign(other.row, { status: "REJECTED", rejectionReason: AUTO_REJECTION_REASON, respondedAt: respondAt, updatedAt: respondAt });
                event(other.row.id, owner.id, "REJECTED", "Otomatis: permintaan lain untuk salinan ini diterima.", respondAt);
            }
            listing.availability = "RESERVED";

            const firstAt = addHours(respondAt, rng.int(4, 120));
            const secondAt = addHours(firstAt, rng.int(0, 48));
            const ownerFirst = rng.chance(0.5);
            // Either side may cancel after acceptance, before the second handover confirmation.
            const cancelAt = rng.between(respondAt, secondAt);
            if (rng.chance(0.08) && cancelAt && cancelAt < anchor) {
                const byOwner = rng.chance(0.4);
                if (firstAt < cancelAt) {
                    request[ownerFirst ? "ownerHandoverAt" : "requesterHandoverAt"] = firstAt;
                    event(request.id, ownerFirst ? owner.id : chosen.requester.id, "HANDOVER_CONFIRMED", ownerFirst ? "Pemilik" : "Peminjam", firstAt);
                }
                Object.assign(request, { status: "CANCELLED", cancelledById: byOwner ? owner.id : chosen.requester.id, updatedAt: cancelAt });
                event(request.id, byOwner ? owner.id : chosen.requester.id, "CANCELLED", byOwner ? "Dibatalkan pemilik." : "Dibatalkan peminjam.", cancelAt);
                listing.availability = "AVAILABLE";
                touch(cancelAt);
                t = addDays(cancelAt, rng.logNormalInt(8 / popularity, 0.9, 1, 120));
                continue;
            }
            if (firstAt >= anchor) { listing.open = true; return; }
            request[ownerFirst ? "ownerHandoverAt" : "requesterHandoverAt"] = firstAt;
            request.updatedAt = firstAt;
            event(request.id, ownerFirst ? owner.id : chosen.requester.id, "HANDOVER_CONFIRMED", ownerFirst ? "Pemilik" : "Peminjam", firstAt);
            touch(firstAt);
            if (secondAt >= anchor) { listing.open = true; return; }
            request[ownerFirst ? "requesterHandoverAt" : "ownerHandoverAt"] = secondAt;
            Object.assign(request, { status: "COMPLETED", updatedAt: secondAt });
            event(request.id, ownerFirst ? chosen.requester.id : owner.id, "HANDOVER_CONFIRMED", ownerFirst ? "Peminjam" : "Pemilik", secondAt);
            event(request.id, null, "BORROWING_STARTED", null, secondAt);
            touch(secondAt);

            const end = simulateBorrowing(request.id, request.loanDays!, secondAt, owner, chosen.requester, rng);
            touch(end.at);
            if (end.outcome === "OPEN") { listing.open = true; return; }
            if (end.outcome === "LOST") { listing.availability = "UNAVAILABLE"; return; }
            listing.availability = "AVAILABLE";
            t = addDays(end.at, rng.logNormalInt(10 / popularity, 0.9, 1, 120));
        }
    }

    function simulateBorrowing(requestId: string, loanDays: number, handedOverAt: Date, owner: User, requester: User, rng: Rng): { outcome: "OPEN" | "RETURNED" | "LOST"; at: Date } {
        let dueAt = dueDateFrom(handedOverAt, loanDays);
        const borrowing: SeedRows["borrowings"][number] & { id: string } = { id: nextId("borrowings"), requestId, status: "ACTIVE", handedOverAt, dueAt, createdAt: handedOverAt, updatedAt: handedOverAt };
        rows.borrowings.push(borrowing);
        let last = handedOverAt;
        const done = (outcome: "OPEN" | "RETURNED" | "LOST") => { borrowing.dueAt = dueAt; borrowing.updatedAt = last; return { outcome, at: last }; };

        // At most one extension, asked before the due date (DEC-02).
        if (rng.chance(0.15)) {
            const askedAt = new Date(handedOverAt.getTime() + (dueAt.getTime() - handedOverAt.getTime()) * (0.3 + rng.next() * 0.65));
            if (askedAt >= anchor) return done("OPEN");
            const days = rng.pick([7, 14]);
            Object.assign(borrowing, { extensionStatus: "PENDING", extensionDays: days, extensionNote: rng.pick(vocab.extensionNotes), extensionRequestedAt: askedAt });
            event(requestId, requester.id, "EXTENSION_REQUESTED", `${days} hari`, askedAt);
            last = askedAt;
            const answeredAt = addHours(askedAt, rng.int(2, 72));
            if (answeredAt >= anchor) return done("OPEN");
            if (rng.chance(0.7)) {
                dueAt = new Date(dueAt.getTime() + days * DAY_MS);
                Object.assign(borrowing, { extensionStatus: "APPROVED", extensionRespondedAt: answeredAt });
                event(requestId, owner.id, "EXTENSION_APPROVED", `${days} hari`, answeredAt);
            } else {
                const note = rng.chance(0.5) ? "Bukunya akan saya pakai untuk diskusi." : null;
                Object.assign(borrowing, { extensionStatus: "REJECTED", extensionRespondedAt: answeredAt, extensionResponseNote: note });
                event(requestId, owner.id, "EXTENSION_REJECTED", note, answeredAt);
            }
            last = answeredAt;
        }

        const late = rng.chance(0.22);
        let returnAt = late
            ? addDays(dueAt, rng.int(1, 21))
            : addHours(dueAt, -rng.int(0, Math.max(1, Math.round(loanDays * 0.7 * 24))));
        returnAt = maxDate(returnAt, addHours(last, 2), addDays(handedOverAt, 1));

        // Owner reminders on an overdue loan, at most once a day.
        const remindUntil = minDate(returnAt, anchor);
        for (let at = maxDate(addHours(dueAt, rng.int(24, 36)), addHours(last, rng.int(2, 24))), n = 0; at < remindUntil && n < 4 && rng.chance(0.7); at = addDays(at, rng.int(1, 4)), n += 1) {
            event(requestId, owner.id, "REMINDER_SENT", null, at);
            borrowing.lastReminderAt = at;
            last = at;
        }

        if (rng.chance(0.045)) {
            const openedAt = rng.date(addHours(last, 1), minDate(returnAt, anchor));
            if (openedAt < anchor && openedAt > last) {
                const byOwner = rng.chance(0.75);
                const reason = late && byOwner ? "Buku tidak dikembalikan" : rng.pick(problemReasons.map((item) => item.value));
                Object.assign(borrowing, { status: "DISPUTED", disputedAt: openedAt, disputedById: byOwner ? owner.id : requester.id, disputeReason: reason, disputeDetails: rng.pick(vocab.disputeDetails) });
                event(requestId, byOwner ? owner.id : requester.id, "DISPUTE_OPENED", reason, openedAt);
                last = openedAt;
                const resolvedAt = addDays(openedAt, rng.int(1, 10));
                if (resolvedAt >= anchor || rng.chance(0.1)) return done("OPEN");
                const outcome = rng.chance(0.65) ? "RETURNED" : "LOST";
                const adminId = pickAdmin(rng);
                const note = rng.pick(vocab.resolutionNotes[outcome]);
                Object.assign(borrowing, { status: outcome, returnedAt: outcome === "RETURNED" ? resolvedAt : null, resolvedAt, resolvedById: adminId, resolutionNote: note });
                event(requestId, adminId, "DISPUTE_RESOLVED", outcome === "RETURNED" ? "Dinyatakan dikembalikan" : "Dinyatakan hilang", resolvedAt);
                audit({ actorId: adminId, action: "BORROWING_DISPUTE_RESOLVED", targetType: "BORROWING", targetId: borrowing.id, note, metadata: { outcome }, createdAt: resolvedAt });
                last = resolvedAt;
                return done(outcome);
            }
        }

        if (returnAt >= anchor) return done("OPEN");
        const requesterFirst = rng.chance(0.6);
        const secondAt = addHours(returnAt, rng.int(0, 36));
        borrowing[requesterFirst ? "requesterReturnAt" : "ownerReturnAt"] = returnAt;
        event(requestId, requesterFirst ? requester.id : owner.id, "RETURN_CONFIRMED", requesterFirst ? "Peminjam" : "Pemilik", returnAt);
        last = returnAt;
        if (secondAt >= anchor) return done("OPEN");
        borrowing[requesterFirst ? "ownerReturnAt" : "requesterReturnAt"] = secondAt;
        event(requestId, requesterFirst ? owner.id : requester.id, "RETURN_CONFIRMED", requesterFirst ? "Pemilik" : "Peminjam", secondAt);
        event(requestId, null, "RETURNED", null, secondAt);
        Object.assign(borrowing, { status: "RETURNED", returnedAt: secondAt });
        last = secondAt;
        return done("RETURNED");
    }

    function event(requestId: string, actorId: string | null, type: SeedRows["borrow_events"][number]["type"], note: string | null, createdAt: Date) {
        rows.borrow_events.push({ id: nextId("borrow_events"), requestId, actorId, type, note, createdAt });
    }

    // ---- Moderation: reports, hidden listings, appeals ----------------------------------------
    {
        const rng = root.fork("moderation");
        /** A decided report (`decidedAt`) is the reason behind a suspension or a hidden listing. */
        const report = (input: { reporterId: string; targetType: ReportTargetType; targetId: string; at: Date; decidedAt?: Date; outcome?: string }) => {
            const age = (anchor.getTime() - input.at.getTime()) / DAY_MS;
            let status = input.decidedAt ? "RESOLVED" as const
                : rng.chance(Math.min(0.9, age / 20)) ? rng.weighted([["RESOLVED", 0.62], ["REJECTED", 0.38]] as const) : rng.weighted([["PENDING", 0.75], ["REVIEWING", 0.25]] as const);
            const reviewedAt = status === "RESOLVED" || status === "REJECTED" ? input.decidedAt ?? rng.between(input.at, minDate(addHours(input.at, rng.int(6, 240)), anchor)) : null;
            if ((status === "RESOLVED" || status === "REJECTED") && !reviewedAt) status = "REVIEWING";
            const decided = status === "RESOLVED" || status === "REJECTED";
            rows.reports.push({
                id: nextId("reports"), reporterId: input.reporterId, targetType: input.targetType, targetId: input.targetId,
                reason: rng.pick(reportReasonsFor(input.targetType)).value, details: rng.pick(vocab.reportDetails),
                status, reviewerId: status === "PENDING" ? null : pickAdmin(rng),
                outcome: decided ? input.outcome ?? rng.pick(vocab.reportOutcomes[status as "RESOLVED" | "REJECTED"]) : null,
                createdAt: input.at, reviewedAt: decided ? reviewedAt : null, updatedAt: decided ? reviewedAt! : input.at,
            });
        };
        const reporterFor = (at: Date, exclude: string[]) => {
            for (let n = 0; n < 50; n += 1) {
                const user = rng.pick(lenders);
                if (activeAt(user, at) && !exclude.includes(user.id)) return user;
            }
            return undefined;
        };

        for (const pending of pendingUserReports) {
            const reporter = reporterFor(pending.at, [pending.userId]);
            if (reporter && pending.at > userById.get(pending.userId)!.createdAt) report({ reporterId: reporter.id, targetType: "USER", targetId: pending.userId, at: pending.at, decidedAt: pending.decidedAt, outcome: pending.outcome });
        }

        // An admin hides a few idle listings after reports; some owners appeal.
        const idle = listings.filter((listing) => listing.availability === "AVAILABLE" && !listing.open && addDays(listing.lastActivityAt, 2) < addDays(anchor, -2));
        for (const listing of rng.sample(idle, Math.round(listings.length * 0.03))) {
            const hiddenAt = rng.date(addDays(listing.lastActivityAt, 2), addDays(anchor, -1));
            const reason = rng.pick(vocab.hideReasons);
            const adminId = pickAdmin(rng);
            const reportAt = rng.date(listing.lastActivityAt, hiddenAt);
            const reporter = reporterFor(reportAt, [listing.ownerId]);
            if (reporter) report({ reporterId: reporter.id, targetType: "BOOK_LISTING", targetId: listing.id, at: reportAt, decidedAt: hiddenAt, outcome: "Listing disembunyikan sampai informasinya diperbarui." });
            Object.assign(listing, { hiddenAt, hiddenReason: reason, hiddenById: adminId, updatedAt: hiddenAt });
            rows.verifications.push({ id: nextId("verifications"), targetType: "BOOK_LISTING", targetId: listing.id, status: "REVOKED", reviewerId: adminId, note: reason, reviewedAt: hiddenAt, createdAt: hiddenAt, updatedAt: hiddenAt });

            const appealAt = addDays(hiddenAt, rng.int(0, 10));
            const restore = (at: Date, note: string) => {
                Object.assign(listing, { hiddenAt: null, hiddenReason: null, hiddenById: null, updatedAt: at });
                rows.verifications.push({ id: nextId("verifications"), targetType: "BOOK_LISTING", targetId: listing.id, status: "APPROVED", reviewerId: pickAdmin(rng), note, reviewedAt: at, createdAt: at, updatedAt: at });
            };
            if (rng.chance(0.6) && appealAt < anchor) {
                const reviewAt = addDays(appealAt, rng.int(1, 7));
                const decision = reviewAt >= anchor ? "PENDING" : rng.weighted([["PENDING", 0.3], ["APPROVED", 0.4], ["REJECTED", 0.3]] as const);
                const reviewNote = decision === "PENDING" ? null : rng.pick(vocab.appealReviewNotes[decision]);
                rows.listing_appeals.push({
                    id: nextId("listing_appeals"), listingId: listing.id, ownerId: listing.ownerId, reason: rng.pick(vocab.appealReasons), details: rng.pick(vocab.appealDetails),
                    status: decision, reviewerId: decision === "PENDING" ? null : pickAdmin(rng), reviewNote, createdAt: appealAt, reviewedAt: decision === "PENDING" ? null : reviewAt,
                });
                if (decision === "APPROVED") restore(reviewAt, `Banding diterima: ${reviewNote}`);
            } else if (rng.chance(0.15)) {
                const at = addDays(hiddenAt, rng.int(1, 14));
                if (at < anchor) restore(at, "Pemilik sudah memperbaiki informasi listing.");
            }
        }

        // Other reports, spread over every kind of content the report form covers.
        const targetsOf: Record<ReportTargetType, { id: string; createdAt: Date; ownerIds: string[] }[]> = {
            BOOK: syntheticBooks.map((book) => ({ id: book.id, createdAt: book.createdAt, ownerIds: [] })),
            BOOK_LISTING: listings.map((listing) => ({ id: listing.id, createdAt: listing.createdAt, ownerIds: [listing.ownerId] })),
            COMMUNITY: communities.filter((item) => item.activeFrom).map((item) => ({ id: item.row.id, createdAt: item.activeFrom!, ownerIds: [item.ownerId, ...item.managers] })),
            EVENT: rows.events.filter((item) => item.publicationStatus !== "DRAFT").map((item) => ({ id: item.id!, createdAt: item.createdAt!, ownerIds: [] })),
            MERCHANDISE_LISTING: rows.merchandise_listings.filter((item) => item.status === "PUBLISHED").map((item) => ({ id: item.id!, createdAt: item.createdAt!, ownerIds: [] })),
            USER: lenders.map((user) => ({ id: user.id, createdAt: user.createdAt, ownerIds: [user.id] })),
        };
        const typeWeights: readonly (readonly [ReportTargetType, number])[] = [["BOOK_LISTING", 0.3], ["BOOK", 0.15], ["COMMUNITY", 0.15], ["EVENT", 0.15], ["MERCHANDISE_LISTING", 0.1], ["USER", 0.15]];
        for (let n = rows.reports.length, attempts = 0; n < profile.reports && attempts < profile.reports * 5; attempts += 1) {
            const targetType = rng.weighted(typeWeights);
            const pool = targetsOf[targetType];
            if (!pool.length) continue;
            const target = rng.pick(pool);
            const at = rng.date(addHours(target.createdAt, 1), addHours(anchor, -1));
            const reporter = reporterFor(at, target.ownerIds);
            if (!reporter || at <= target.createdAt) continue;
            report({ reporterId: reporter.id, targetType, targetId: target.id, at });
            n += 1;
        }
    }

    // The meta row is the first seed profile; it is written with the first batch.
    const hash = createHash("sha256");
    for (const list of Object.values(rows)) for (const row of list) hash.update(JSON.stringify(row));
    meta.dataset = hash.digest("hex").slice(0, 16);
    if (rows.user_profiles[0]) rows.user_profiles[0].preferences = { seed: meta };
    return { rows, meta };
}

/** Number of rows per table, for logs and reports. */
export function countRows(rows: SeedRows) {
    return Object.fromEntries(Object.entries(rows).map(([table, list]) => [table, list.length])) as Record<SeedTable, number>;
}
