import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../../src/lib/db/schema";

// Meeting points picked from the Peta Literasi (TB-027), against an in-memory Postgres with every migration applied.
const pg = new PGlite();
const testDb = drizzle({ client: pg, schema });
mock.module("server-only", () => ({}));
mock.module(resolve(import.meta.dir, "../../src/lib/db/client.ts"), () => ({ db: testDb }));

setDefaultTimeout(60_000);

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OWNER = id(1), READER = id(2), BOOK = id(100);
const PARK = id(300), LIBRARY = id(301), HIDDEN = id(302), COMMUNITY = id(303), COMMUNITY_PIN = id(304);

let books: typeof import("../../src/lib/db/queries/books");
let borrowing: typeof import("../../src/lib/db/queries/borrowing");

const storedIds = async (listingId: string) =>
    (await testDb.query.bookListings.findFirst({ where: eq(schema.bookListings.id, listingId) }))?.meetingPlaceIds;

beforeAll(async () => {
    const files = (await readdir("drizzle/migrations")).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
        const sql = await readFile(`drizzle/migrations/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) {
            await pg.exec(statement);
        }
    }
    await testDb.insert(schema.userProfiles).values([{ id: OWNER, displayName: "Pemilik" }, { id: READER, displayName: "Pembaca" }]);
    await testDb.insert(schema.books).values({ id: BOOK, provider: "MANUAL", providerId: "test-100", title: "Laut Bercerita", authors: ["Leila S. Chudori"] });
    await testDb.insert(schema.communities).values({ id: COMMUNITY, ownerId: OWNER, name: "Klub Menteng", status: "VERIFIED" });
    await testDb.insert(schema.places).values([
        { id: PARK, type: "MEETING_POINT", name: "Taman Suropati", addressPublic: "Jalan Taman Suropati", regionCode: "31.71", latitude: -6.198854, longitude: 106.832657 },
        { id: LIBRARY, type: "LIBRARY", name: "Perpustakaan Jakarta Pusat", addressPublic: "Jalan Tanah Abang I", regionCode: "31.71", latitude: -6.171575, longitude: 106.819586 },
        { id: HIDDEN, type: "MEETING_POINT", name: "Taman Tutup", addressPublic: "Tempat umum", regionCode: "31.71", latitude: -6.2, longitude: 106.8, hiddenAt: new Date(), hiddenReason: "Sedang direnovasi" },
        { id: COMMUNITY_PIN, type: "COMMUNITY", communityId: COMMUNITY, name: "Klub Menteng", addressPublic: "Menteng", regionCode: "31.71", latitude: -6.19, longitude: 106.83 },
    ]);
    books = await import("../../src/lib/db/queries/books");
    borrowing = await import("../../src/lib/db/queries/borrowing");
});

afterAll(async () => {
    await pg.close();
});

const create = (publicLocation: string, meetingPlaceIds: string[]) =>
    books.createBookListing({ ownerId: OWNER, bookId: BOOK, condition: "GOOD", publicLocation, meetingPlaceIds, borrowingRules: "Lama pinjam: 14 hari." });

describe("meeting points from the Peta Literasi (TB-027)", () => {
    test("a listing keeps map places next to typed points", async () => {
        const listing = await create("Taman Suropati & Stasiun Gondangdia", [PARK]);
        expect(listing.meetingPlaceIds).toEqual([PARK]);
    });

    test("only curated places shown on the map can be picked", async () => {
        await expect(create("Taman Tutup", [HIDDEN])).rejects.toThrow("Peta Literasi");
        await expect(create("Klub Menteng", [COMMUNITY_PIN])).rejects.toThrow("Peta Literasi");
        await expect(create("Taman Suropati", [id(999)])).rejects.toThrow("Peta Literasi");
    });

    test("a place whose point was edited away is dropped, and a new pick is kept", async () => {
        const listing = await create("Taman Suropati & Perpustakaan Jakarta Pusat", [PARK, LIBRARY]);
        await books.updateBookListing(listing.id, OWNER, { publicLocation: "Perpustakaan Jakarta Pusat & Stasiun Gondangdia" });
        expect(await storedIds(listing.id)).toEqual([LIBRARY]);

        await books.updateBookListing(listing.id, OWNER, { publicLocation: "Perpustakaan Jakarta Pusat & Taman Suropati", meetingPlaceIds: [LIBRARY, PARK] });
        expect(await storedIds(listing.id)).toEqual([LIBRARY, PARK]);
    });

    test("an accepted loan links its map meeting point; a typed point has no link", async () => {
        const listing = await create("Taman Suropati & Stasiun Gondangdia", [PARK]);
        const onMap = await borrowing.createBorrowRequest(READER, { listingId: listing.id, loanDays: 14, meetingPoint: "Taman Suropati", agreed: true } as never);
        await borrowing.actOnBorrowRequest(onMap.id, OWNER, { action: "approve" });

        const typedListing = await create("Taman Suropati & Stasiun Gondangdia", [PARK]);
        const typed = await borrowing.createBorrowRequest(READER, { listingId: typedListing.id, loanDays: 14, meetingPoint: "Stasiun Gondangdia", agreed: true } as never);

        const loans = await borrowing.listLoansForUser(READER);
        const loan = (requestId: string) => loans.find((item) => item.requestId === requestId)!;
        expect(loan(onMap.id)).toMatchObject({ state: "AWAITING_HANDOVER", meetingPoint: "Taman Suropati", meetingPlace: { id: PARK, latitude: -6.198854, longitude: 106.832657 } });
        expect(loan(typed.id).meetingPlace).toBeNull();
    });

    test("a place hidden later disappears from the loan, and the point text stays", async () => {
        await testDb.update(schema.places).set({ hiddenAt: new Date(), hiddenReason: "Ditutup" }).where(eq(schema.places.id, PARK));
        const [loan] = (await borrowing.listLoansForUser(READER)).filter((item) => item.state === "AWAITING_HANDOVER");
        expect([loan.meetingPoint, loan.meetingPlace]).toEqual(["Taman Suropati", null]);
    });
});
