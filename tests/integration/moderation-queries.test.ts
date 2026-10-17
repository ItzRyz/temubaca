import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../../src/lib/db/schema";

// Run the real query modules against an in-memory Postgres with every migration applied.
const pg = new PGlite();
const testDb = drizzle({ client: pg, schema });
mock.module("server-only", () => ({}));
mock.module(resolve(import.meta.dir, "../../src/lib/db/client.ts"), () => ({ db: testDb }));

setDefaultTimeout(60_000);

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OWNER = id(1), ADMIN = id(2), SUSPENDED_OWNER = id(3), REQUESTER = id(4);
const BOOK = id(100);
const VISIBLE = id(201), HIDDEN = id(202), OF_SUSPENDED = id(203), RESERVED = id(204), REQUESTED = id(205);

let books: typeof import("../../src/lib/db/queries/books");
let catalogAdmin: typeof import("../../src/lib/db/queries/catalog-admin");
let adminUsers: typeof import("../../src/lib/db/queries/admin-users");

beforeAll(async () => {
    const files = (await readdir("drizzle/migrations")).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
        const sql = await readFile(`drizzle/migrations/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) {
            await pg.exec(statement);
        }
    }

    await testDb.insert(schema.userProfiles).values([
        { id: OWNER, displayName: "Pemilik" },
        { id: ADMIN, displayName: "Admin", role: "ADMIN" },
        { id: SUSPENDED_OWNER, displayName: "Tertangguh" },
        { id: REQUESTER, displayName: "Peminjam" },
    ]);
    await testDb.insert(schema.books).values({ id: BOOK, provider: "MANUAL", providerId: "test-100", title: "Laut Bercerita", authors: ["Leila S. Chudori"] });
    await testDb.insert(schema.bookListings).values([
        { id: VISIBLE, ownerId: OWNER, bookId: BOOK, condition: "GOOD" },
        { id: HIDDEN, ownerId: OWNER, bookId: BOOK, condition: "GOOD", hiddenAt: new Date(), hiddenReason: "uji" },
        { id: OF_SUSPENDED, ownerId: SUSPENDED_OWNER, bookId: BOOK, condition: "GOOD" },
        { id: RESERVED, ownerId: OWNER, bookId: BOOK, condition: "GOOD", availability: "RESERVED" },
        { id: REQUESTED, ownerId: OWNER, bookId: BOOK, condition: "GOOD", availability: "UNAVAILABLE" },
    ]);
    await testDb.insert(schema.borrowRequests).values({ listingId: REQUESTED, requesterId: REQUESTER });

    books = await import("../../src/lib/db/queries/books");
    catalogAdmin = await import("../../src/lib/db/queries/catalog-admin");
    adminUsers = await import("../../src/lib/db/queries/admin-users");
});

afterAll(async () => {
    await pg.close();
});

const publicListingIds = async () => (await books.listBookListings(BOOK)).map((listing) => listing.id).sort();

describe("public listing visibility", () => {
    test("hidden listings are never public", async () => {
        expect(await publicListingIds()).not.toContain(HIDDEN);
        expect(await publicListingIds()).toContain(VISIBLE);
    });

    test("suspending an owner hides their listings and is audited; reinstating restores them", async () => {
        expect(await publicListingIds()).toContain(OF_SUSPENDED);

        expect((await adminUsers.setUserSuspension({ targetId: SUSPENDED_OWNER, actorId: ADMIN, suspended: true, reason: "Spam" })).status).toBe("updated");
        expect(await publicListingIds()).not.toContain(OF_SUSPENDED);

        // Catalog counts follow the same rule: only VISIBLE is still a public, available copy.
        const { items: [browsed] } = await books.browseBooks({}, 10, 0);
        expect(browsed?.availableCopies).toBe(1);

        const trail = await adminUsers.listUserAuditTrail(SUSPENDED_OWNER);
        expect(trail.map((entry) => entry.action)).toEqual(["USER_SUSPENDED"]);
        expect(trail[0]?.note).toBe("Spam");

        expect((await adminUsers.setUserSuspension({ targetId: SUSPENDED_OWNER, actorId: ADMIN, suspended: false })).status).toBe("updated");
        expect(await publicListingIds()).toContain(OF_SUSPENDED);
    });

    test("a repeated suspension decision changes nothing", async () => {
        expect((await adminUsers.setUserSuspension({ targetId: SUSPENDED_OWNER, actorId: ADMIN, suspended: false })).status).toBe("unchanged");
    });
});

describe("listing moderation", () => {
    test("hiding and restoring a listing toggles public visibility and records each decision", async () => {
        expect((await catalogAdmin.setListingVisibility({ listingId: VISIBLE, adminId: ADMIN, hidden: true, reason: "Foto menyesatkan" })).status).toBe("updated");
        expect(await publicListingIds()).not.toContain(VISIBLE);

        expect((await catalogAdmin.setListingVisibility({ listingId: VISIBLE, adminId: ADMIN, hidden: false })).status).toBe("updated");
        expect(await publicListingIds()).toContain(VISIBLE);

        const history = await catalogAdmin.listListingModerationHistory(VISIBLE);
        expect(history.map((entry) => entry.status)).toEqual(["APPROVED", "REVOKED"]);
        expect(history[1]?.note).toBe("Foto menyesatkan");
    });

    test("unknown listings report not_found", async () => {
        expect((await catalogAdmin.setListingVisibility({ listingId: id(999), adminId: ADMIN, hidden: true, reason: "x x x" })).status).toBe("not_found");
    });
});

describe("owner listing deletion", () => {
    test("is refused while reserved or with borrow history, and only for the owner", async () => {
        expect(await books.deleteBookListing(RESERVED, OWNER)).toEqual({ status: "blocked", reason: "reserved" });
        expect(await books.deleteBookListing(REQUESTED, OWNER)).toEqual({ status: "blocked", reason: "has_requests" });
        expect(await books.deleteBookListing(VISIBLE, ADMIN)).toEqual({ status: "not_found" });
    });

    test("deletes an unencumbered listing", async () => {
        expect(await books.deleteBookListing(VISIBLE, OWNER)).toEqual({ status: "deleted", id: VISIBLE });
        expect(await publicListingIds()).not.toContain(VISIBLE);
    });
});
