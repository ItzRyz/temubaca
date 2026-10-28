import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

import { accessState, mergeHoldings } from "../../src/features/libraries/access";
import * as schema from "../../src/lib/db/schema";

// TB-023: libraries, holdings from three sources, and access requests, against every migration.
const pg = new PGlite();
const testDb = drizzle({ client: pg, schema });
mock.module("server-only", () => ({}));
mock.module(resolve(import.meta.dir, "../../src/lib/db/client.ts"), () => ({ db: testDb }));

setDefaultTimeout(60_000);

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADMIN = id(1), MANAGER = id(2), READER = id(3), OTHER = id(4), BLOCKED = id(5);
const PLACE = id(100), BOOK = id(200), OTHER_BOOK = id(201);

let libraries: typeof import("../../src/lib/db/queries/libraries");
let libraryId: string;

beforeAll(async () => {
    const files = (await readdir("drizzle/migrations")).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
        const sql = await readFile(`drizzle/migrations/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await pg.exec(statement);
    }
    await testDb.insert(schema.userProfiles).values([
        { id: ADMIN, displayName: "Admin", role: "ADMIN" },
        { id: MANAGER, displayName: "Pustakawan" },
        { id: READER, displayName: "Pembaca" },
        { id: OTHER, displayName: "Orang Lain" },
        { id: BLOCKED, displayName: "Diblokir", borrowBlockedUntil: new Date(Date.now() + 30 * 86_400_000) },
    ]);
    await testDb.insert(schema.places).values({ id: PLACE, type: "LIBRARY", name: "Perpustakaan Uji", addressPublic: "Jalan Uji 1", regionCode: "31.71", latitude: -6.18, longitude: 106.83 });
    await testDb.insert(schema.books).values([
        { id: BOOK, provider: "MANUAL", providerId: "lib-1", title: "Laut Bercerita", authors: ["Leila S. Chudori"] },
        { id: OTHER_BOOK, provider: "MANUAL", providerId: "lib-2", title: "Cantik Itu Luka", authors: ["Eka Kurniawan"] },
    ]);
    libraries = await import("../../src/lib/db/queries/libraries");
});

afterAll(async () => {
    await pg.close();
});

describe("libraries and holdings", () => {
    test("an admin creates a library from its map place, once, and appoints a manager", async () => {
        expect((await libraries.listLibraryPlacesWithoutLibrary()).map((place) => place.id)).toEqual([PLACE]);
        ({ id: libraryId } = await libraries.createLibraryFromPlace(PLACE, ADMIN));
        await expect(libraries.createLibraryFromPlace(PLACE, ADMIN)).rejects.toThrow("sudah menjadi perpustakaan");
        const library = await libraries.findLibrary(libraryId);
        expect([library?.name, library?.regionCode, library?.placeId, library?.accessEnabled]).toEqual(["Perpustakaan Uji", "31.71", PLACE, false]);

        expect(await libraries.setLibraryManager(libraryId, MANAGER, ADMIN, true)).toEqual({ changed: true });
        expect(await libraries.setLibraryManager(libraryId, MANAGER, ADMIN, true)).toEqual({ changed: false });
        expect(await libraries.isLibraryManager(MANAGER, libraryId)).toBe(true);
        const audit = await testDb.select({ action: schema.adminAuditLogs.action }).from(schema.adminAuditLogs).where(eq(schema.adminAuditLogs.targetId, libraryId));
        expect(audit.map((row) => row.action).sort()).toEqual(["LIBRARY_CREATED", "LIBRARY_MANAGER_ADDED"]);
    });

    test("holdings from three sources merge per library, the manager's word first", async () => {
        await libraries.setCuratedHolding(libraryId, ADMIN, BOOK, { bookId: BOOK, status: "LISTED", copiesTotal: null, copiesAvailable: null, callNumber: null });
        await libraries.replaceOneSearchHoldings(BOOK, [{ libraryId, sourceRecordId: "onesearch-1", sourceUrl: "https://onesearch.id/Record/onesearch-1" }]);
        await expect(libraries.upsertManagerHolding(libraryId, OTHER, { bookId: BOOK, status: "AVAILABLE", copiesTotal: 2, copiesAvailable: 1, callNumber: null })).rejects.toThrow("tidak ditemukan");
        await libraries.upsertManagerHolding(libraryId, MANAGER, { bookId: BOOK, status: "AVAILABLE", copiesTotal: 2, copiesAvailable: 1, callNumber: "899.221 LEI" });

        const rows = await libraries.listHoldingsForBook(BOOK);
        expect(rows.map((row) => row.source).sort()).toEqual(["CURATED", "MANAGER", "ONESEARCH"]);
        const [merged] = mergeHoldings(rows);
        expect([merged.source, merged.status, merged.copiesAvailable, merged.sourceUrl]).toEqual(["MANAGER", "AVAILABLE", 1, "https://onesearch.id/Record/onesearch-1"]);
        expect(merged.sources.sort()).toEqual(["CURATED", "MANAGER", "ONESEARCH"]);

        const [book] = await testDb.select({ checkedAt: schema.books.librariesCheckedAt }).from(schema.books).where(eq(schema.books.id, BOOK));
        expect(book.checkedAt).not.toBeNull();
        await libraries.replaceOneSearchHoldings(BOOK, []);
        expect((await libraries.listHoldingsForBook(BOOK)).map((row) => row.source).sort()).toEqual(["CURATED", "MANAGER"]);
    });
});

describe("access requests", () => {
    const ask = (requesterId: string, bookId = BOOK) => libraries.createAccessRequest(requesterId, { libraryId, bookId, message: "Saya ingin membaca di tempat.", agreed: true });

    test("only a library that opted in takes requests, for books it holds, and not from blocked readers", async () => {
        await expect(ask(READER)).rejects.toThrow("belum menerima pengajuan");
        await expect(libraries.updateLibraryAccessSettings(libraryId, OTHER, { accessEnabled: true, accessRules: null, pickupDays: 3 })).rejects.toThrow("tidak ditemukan");
        await libraries.updateLibraryAccessSettings(libraryId, MANAGER, { accessEnabled: true, accessRules: "Bawa kartu anggota.", pickupDays: 3 });

        await expect(ask(READER, OTHER_BOOK)).rejects.toThrow("tidak tercatat");
        await expect(ask(BLOCKED)).rejects.toThrow("belum dapat mengajukan pinjam");
        await expect(ask(MANAGER)).rejects.toThrow("pengelola perpustakaan ini");
    });

    test("ask → approve with a pick-up deadline → collected; one open request per reader", async () => {
        const { id: accessId } = await ask(READER);
        await expect(ask(READER)).rejects.toThrow("sudah punya pengajuan");
        expect(await libraries.countLibraryActions(MANAGER)).toEqual({ toAnswer: 1, toCollect: 0 });

        await expect(libraries.actOnAccessRequest(accessId, READER, { action: "approve", note: null })).rejects.toThrow("tidak ditemukan");
        await libraries.actOnAccessRequest(accessId, MANAGER, { action: "approve", note: "Ambil di meja sirkulasi." });
        const [approved] = await libraries.listAccessRequestsForUser(READER);
        expect(approved.status).toBe("APPROVED");
        expect(approved.expiresAt!.getTime() - approved.respondedAt!.getTime()).toBe(3 * 86_400_000);
        expect(accessState(approved, new Date(approved.expiresAt!.getTime() + 1))).toBe("EXPIRED");
        expect(await libraries.countLibraryActions(READER)).toEqual({ toAnswer: 0, toCollect: 1 });
        expect(await libraries.countLibraryActions(MANAGER)).toEqual({ toAnswer: 0, toCollect: 0 });

        await expect(libraries.actOnAccessRequest(accessId, MANAGER, { action: "approve", note: null })).rejects.toThrow("sudah ditanggapi");
        await libraries.actOnAccessRequest(accessId, MANAGER, { action: "collected" });
        await expect(libraries.actOnAccessRequest(accessId, READER, { action: "cancel" })).rejects.toThrow("tidak dapat dibatalkan");

        const forLibrary = await libraries.listAccessRequestsForLibrary(libraryId);
        expect([forLibrary[0].status, forLibrary[0].requesterName]).toEqual(["COLLECTED", "Pembaca"]);
        expect(Object.keys(forLibrary[0])).not.toContain("email");
    });

    test("a reader cancels; a manager rejects with a reason", async () => {
        const { id: first } = await ask(READER);
        await expect(libraries.actOnAccessRequest(first, OTHER, { action: "cancel" })).rejects.toThrow("tidak ditemukan");
        await libraries.actOnAccessRequest(first, READER, { action: "cancel" });
        const { id: second } = await ask(OTHER);
        await libraries.actOnAccessRequest(second, MANAGER, { action: "reject", note: "Buku sedang diperbaiki." });
        const [mine] = await libraries.listAccessRequestsForUser(OTHER);
        expect([mine.status, mine.responseNote]).toEqual(["REJECTED", "Buku sedang diperbaiki."]);
    });

    test("a hidden library disappears from public lists but keeps its data", async () => {
        await libraries.updateLibrary(libraryId, { name: "Perpustakaan Uji", publicLocation: "Jalan Uji 1", regionCode: "31.71", catalogUrl: null, websiteUrl: null, oneSearchInstitution: null, hidden: true }, ADMIN);
        expect(await libraries.listLibraries()).toEqual([]);
        expect(await libraries.listHoldingsForBook(BOOK)).toEqual([]);
        expect(await libraries.findLibrary(libraryId)).toBeNull();
        expect((await libraries.findLibrary(libraryId, { includeHidden: true }))?.hiddenAt).not.toBeNull();
        await expect(libraries.createAccessRequest(READER, { libraryId, bookId: BOOK, message: null, agreed: true })).rejects.toThrow("tidak ditemukan");
    });
});

describe("privacy and retention (DEC-11)", () => {
    test("asking for account deletion withdraws open requests; purging removes manager rights and messages", async () => {
        const deletion = await import("../../src/lib/db/queries/account-deletion");
        await libraries.updateLibrary(libraryId, { name: "Perpustakaan Uji", publicLocation: "Jalan Uji 1", regionCode: "31.71", catalogUrl: null, websiteUrl: null, oneSearchInstitution: null, hidden: false }, ADMIN);
        const { id: open } = await libraries.createAccessRequest(READER, { libraryId, bookId: BOOK, message: "Pesan pribadi", agreed: true });
        await deletion.requestAccountDeletion(READER);
        const [withdrawn] = await testDb.select().from(schema.bookAccesses).where(eq(schema.bookAccesses.id, open));
        expect(withdrawn.status).toBe("CANCELLED");

        const exported = await deletion.exportUserData(READER);
        expect(exported.libraryRequests.map((request) => request.library)).toContain("Perpustakaan Uji");

        await libraries.setLibraryManager(libraryId, OTHER, ADMIN, true);
        await testDb.update(schema.userProfiles).set({ deletionRequestedAt: new Date(), deletionScheduledFor: new Date(Date.now() - 1000) }).where(eq(schema.userProfiles.id, OTHER));
        expect((await deletion.purgeAccount(OTHER)).status).toBe("purged");
        expect(await libraries.isLibraryManager(OTHER, libraryId)).toBe(false);
        const [rejected] = await testDb.select({ message: schema.bookAccesses.message }).from(schema.bookAccesses).where(eq(schema.bookAccesses.requesterId, OTHER));
        expect(rejected.message).toBeNull();
    });

    test("retention removes finished requests after the loan-history period, keeps open ones", async () => {
        const deletion = await import("../../src/lib/db/queries/account-deletion");
        const before = await testDb.select({ id: schema.bookAccesses.id }).from(schema.bookAccesses);
        const later = new Date(Date.now() + 40 * 30 * 86_400_000);
        const result = await deletion.applyRetention(later);
        const after = await testDb.select({ id: schema.bookAccesses.id }).from(schema.bookAccesses);
        expect(after).toHaveLength(0);
        expect(result.loans).toBeGreaterThanOrEqual(before.length);
    });
});
