import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

import { SEED_PROFILES } from "../../scripts/seed/config";
import { countRows, generateSeed, type RefPlace } from "../../scripts/seed/generate";
import { isSeedId, seedId } from "../../scripts/seed/ids";
import { createRng } from "../../scripts/seed/random";
import { validateRows } from "../../scripts/seed/validate";

// Synthetic dataset generator (scripts/seed): pure, so it is tested without a database.
const anchor = new Date("2026-10-27T00:00:00Z");
const places: RefPlace[] = [
    { id: "00000000-0000-4000-8000-000000000001", type: "MEETING_POINT", name: "RPTRA Uji Satu", addressPublic: "Jalan Uji 1", regionCode: "31.74", latitude: -6.25, longitude: 106.8 },
    { id: "00000000-0000-4000-8000-000000000002", type: "MEETING_POINT", name: "RPTRA Uji Dua", addressPublic: null, regionCode: "31.75", latitude: -6.22, longitude: 106.9 },
    { id: "00000000-0000-4000-8000-000000000003", type: "LIBRARY", name: "Perpustakaan Uji", addressPublic: "Jalan Uji 3", regionCode: "36.71", latitude: -6.18, longitude: 106.63 },
];
const input = { profile: SEED_PROFILES.small, anchor, places, books: [], reference: "test" };
const { rows } = generateSeed(input);

describe("seed generator", () => {
    test("same seed and anchor give identical rows", () => {
        expect(JSON.stringify(generateSeed(input).rows)).toBe(JSON.stringify(rows));
    });

    test("another seed gives different rows", () => {
        const other = generateSeed({ ...input, profile: { ...SEED_PROFILES.small, seed: 7 } }).rows;
        expect(JSON.stringify(other.user_profiles)).not.toBe(JSON.stringify(rows.user_profiles));
    });

    test("passes every in-memory check", () => {
        expect(validateRows(rows, { anchor, refIds: { places: new Set(places.map((place) => place.id)) } })).toEqual([]);
    });

    test("every id is a seed id and the meta row carries the anchor", () => {
        for (const list of Object.values(rows)) for (const row of list as { id: string }[]) expect(isSeedId(row.id)).toBe(true);
        expect(rows.user_profiles[0].preferences).toEqual({ seed: { version: 1, profile: "small", seed: SEED_PROFILES.small.seed, anchor: anchor.toISOString(), reference: "test", dataset: expect.stringMatching(/^[0-9a-f]{16}$/), extensions: expect.stringMatching(/^[0-9a-f]{16}$/) } });
        expect(isSeedId("5eed0000-0000-4000-8000-000000000001")).toBe(false);
        expect(isSeedId(crypto.randomUUID())).toBe(false);
        expect(seedId("books", 255)).toBe("5eed0001-0002-4000-8000-0000000000ff");
    });

    test("extension tables: libraries copy the real LIBRARY places, accesses follow each accepted loan", () => {
        const libraries = places.filter((place) => place.type === "LIBRARY");
        expect(rows.libraries.map((row) => row.name)).toEqual(libraries.map((place) => place.name));
        for (const row of rows.libraries) expect([row.openingHours, row.websiteUrl]).toEqual([null, null]);

        const approved = new Set(rows.borrow_events.filter((event) => event.type === "APPROVED").map((event) => event.requestId));
        expect(rows.book_accesses.map((row) => row.requestId).sort()).toEqual([...approved].sort());
        const requestOf = new Map(rows.borrow_requests.map((row) => [row.id, row]));
        const borrowingOf = new Map(rows.borrowings.map((row) => [row.requestId, row]));
        for (const access of rows.book_accesses) {
            const request = requestOf.get(access.requestId)!;
            const borrowing = borrowingOf.get(access.requestId);
            const expected = request.status === "CANCELLED" || borrowing?.status === "LOST" ? "REVOKED" : borrowing?.status === "RETURNED" ? "EXPIRED" : "ACTIVE";
            expect(access.status).toBe(expected);
            expect(access.revokedAt != null).toBe(expected === "REVOKED");
        }
        expect(new Set(rows.book_accesses.map((row) => row.status))).toEqual(new Set(["ACTIVE", "EXPIRED", "REVOKED"]));
    });

    test("covers the lifecycle states and statuses, not one uniform value", () => {
        const statuses = (list: { status?: string | null }[]) => new Set(list.map((row) => row.status));
        expect(statuses(rows.borrow_requests)).toEqual(new Set(["PENDING", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"]));
        expect(statuses(rows.borrowings).has("RETURNED")).toBe(true);
        expect(statuses(rows.borrowings).has("ACTIVE")).toBe(true);
        expect(statuses(rows.borrowings).has("OVERDUE")).toBe(false); // derived from dueAt, never stored
        expect(statuses(rows.communities).size).toBeGreaterThanOrEqual(3);
        expect(new Set(rows.events.map((row) => row.publicationStatus)).size).toBeGreaterThanOrEqual(2);
        expect(statuses(rows.reports).size).toBeGreaterThanOrEqual(3);
    });

    test("activity is uneven across readers and spread over months", () => {
        const perUser = new Map<string, number>();
        for (const row of rows.bookmarks) perUser.set(row.userId, (perUser.get(row.userId) ?? 0) + 1);
        const counts = [...perUser.values()].sort((a, b) => a - b);
        expect(counts.at(-1)!).toBeGreaterThan(counts[Math.floor(counts.length / 2)] * 3);
        expect(new Set(rows.user_profiles.map((row) => row.createdAt!.toISOString().slice(0, 7))).size).toBeGreaterThanOrEqual(5);
    });

    test("listing availability matches its loans", () => {
        const busy = new Set([
            ...rows.borrow_requests.filter((row) => row.status === "APPROVED").map((row) => row.listingId),
            ...rows.borrowings.filter((row) => row.status === "ACTIVE" || row.status === "DISPUTED").map((row) => rows.borrow_requests.find((request) => request.id === row.requestId)!.listingId),
        ]);
        for (const listing of rows.book_listings) expect(listing.availability === "RESERVED").toBe(busy.has(listing.id!));
    });

    test("synthetic books never claim an ISBN or cover", () => {
        for (const book of rows.books) {
            expect(book.isbn).toBeNull();
            expect(book.coverUrl).toBeNull();
            expect(book.metadata).toMatchObject({ synthetic: true });
        }
    });

    test("contacts use the reserved .test domain only", () => {
        for (const community of rows.communities) {
            expect(community.contactEmail).toEndWith("@temubaca.test");
            expect(community.whatsappNumber).toBeNull();
            expect(community.instagramHandle).toBeNull();
        }
    });

    test("the seeder never uses Math.random", () => {
        for (const file of readdirSync("scripts/seed")) expect(readFileSync(`scripts/seed/${file}`, "utf8")).not.toMatch(/Math\.random\s*\(/);
        const a = createRng(1);
        const b = createRng(1);
        expect([a.next(), a.next()]).toEqual([b.next(), b.next()]);
    });

    test("profile counts are honoured for the root tables", () => {
        const counts = countRows(rows);
        expect(counts.user_profiles).toBe(SEED_PROFILES.small.users);
        expect(counts.books).toBe(SEED_PROFILES.small.books);
        expect(counts.book_listings).toBe(SEED_PROFILES.small.listings);
    });
});
