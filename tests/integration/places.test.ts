import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../../src/lib/db/schema";

// Run the real place queries against an in-memory Postgres with every migration applied.
const pg = new PGlite();
const testDb = drizzle({ client: pg, schema });
mock.module("server-only", () => ({}));
mock.module(resolve(import.meta.dir, "../../src/lib/db/client.ts"), () => ({ db: testDb }));

setDefaultTimeout(60_000);

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADMIN = id(1), OWNER = id(2);
const VERIFIED = id(101), PENDING = id(102);
const ALL = ["LIBRARY", "COMMUNITY", "EVENT", "MEETING_POINT"] as const;
// Region codes from src/features/regions/data.ts: 31.71 Kota Administrasi Jakarta Pusat, 32.73 Kota Bandung.
const point = (latitude: number, longitude: number) => ({ latitude, longitude, addressPublic: "Tempat umum" });

let places: typeof import("../../src/lib/db/queries/places");
let communityManagement: typeof import("../../src/lib/db/queries/community-management");

beforeAll(async () => {
    const files = (await readdir("drizzle/migrations")).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
        const sql = await readFile(`drizzle/migrations/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) {
            await pg.exec(statement);
        }
    }

    await testDb.insert(schema.userProfiles).values([{ id: ADMIN, displayName: "Admin", role: "ADMIN" }, { id: OWNER, displayName: "Pengelola" }]);
    await testDb.insert(schema.communities).values([
        { id: VERIFIED, ownerId: OWNER, name: "Klub Menteng", status: "VERIFIED", regionCode: "31.71", interests: ["Puisi"] },
        { id: PENDING, ownerId: OWNER, name: "Klub Menunggu", status: "PENDING", regionCode: "32.73" },
    ]);

    places = await import("../../src/lib/db/queries/places");
    communityManagement = await import("../../src/lib/db/queries/community-management");
});

afterAll(async () => {
    await pg.close();
});

describe("Peta Literasi places (DEC-07)", () => {
    test("curated places are created with an audit entry and are public", async () => {
        const library = await places.createCuratedPlace({ type: "LIBRARY", name: "Perpustakaan Nasional", regionCode: "31.71", source: null, ...point(-6.1815, 106.8272) }, ADMIN);
        await places.createCuratedPlace({ type: "MEETING_POINT", name: "Taman Balai Kota Bandung", regionCode: "32.73", source: null, ...point(-6.9111, 107.6098) }, ADMIN);

        const audit = await testDb.select().from(schema.adminAuditLogs).where(eq(schema.adminAuditLogs.targetId, library.id));
        expect(audit.map((row) => [row.action, row.targetType, row.actorId])).toEqual([["PLACE_CREATED", "PLACE", ADMIN]]);

        const listed = await places.listPublicPlaces({ types: [...ALL] });
        expect(listed.map((place) => [place.name, place.latitude, place.longitude])).toEqual([
            ["Perpustakaan Nasional", -6.1815, 106.8272],
            ["Taman Balai Kota Bandung", -6.9111, 107.6098],
        ]);
    });

    test("a community pin is one per community, follows the profile, and shows only while VERIFIED", async () => {
        await places.upsertCommunityPlace({ id: VERIFIED, name: "Klub Menteng", regionCode: "31.71" }, point(-6.1993, 106.8323), OWNER);
        // Saving again moves the same pin instead of adding a second one.
        await places.upsertCommunityPlace({ id: VERIFIED, name: "Klub Menteng", regionCode: "31.71" }, point(-6.2, 106.83), OWNER);
        await places.upsertCommunityPlace({ id: PENDING, name: "Klub Menunggu", regionCode: "32.73" }, point(-6.9, 107.6), OWNER);

        const communityPins = await places.listPublicPlaces({ types: ["COMMUNITY"] });
        expect(communityPins.map((place) => [place.communityName, place.latitude])).toEqual([["Klub Menteng", -6.2]]);

        await communityManagement.updateCommunityProfile(VERIFIED, {
            name: "Klub Menteng Raya", description: "Komunitas baca santai di Menteng setiap dua pekan.", regionCode: "31.71", publicLocation: "Menteng",
            interests: ["Puisi"], contactEmail: "halo@contoh.org", instagramHandle: null, whatsappNumber: null,
        });
        const [renamed] = await places.listPublicPlaces({ types: ["COMMUNITY"] });
        expect(renamed.name).toBe("Klub Menteng Raya");
    });

    test("filters by type, province or kab/kota prefix, and name", async () => {
        const names = async (filter: Parameters<typeof places.listPublicPlaces>[0]) => (await places.listPublicPlaces(filter)).map((place) => place.name);
        expect(await names({ types: ["LIBRARY", "MEETING_POINT"], region: "32" })).toEqual(["Taman Balai Kota Bandung"]);
        expect(await names({ types: [...ALL], region: "31.71" })).toEqual(["Klub Menteng Raya", "Perpustakaan Nasional"]);
        expect(await names({ types: [...ALL], q: "nasional" })).toEqual(["Perpustakaan Nasional"]);
        // Event pins arrive in phase 2 and never show yet.
        expect(await names({ types: ["EVENT"] })).toEqual([]);
    });

    test("hidden places leave the map until restored, and the admin cannot edit a community pin as curated", async () => {
        const [library] = await places.listPublicPlaces({ types: ["LIBRARY"] });
        await places.setPlaceHidden(library.id, { reason: "Alamat keliru" }, ADMIN);
        expect(await places.listPublicPlaces({ types: ["LIBRARY"] })).toEqual([]);
        await places.setPlaceHidden(library.id, null, ADMIN);
        expect(await places.listPublicPlaces({ types: ["LIBRARY"] })).toHaveLength(1);

        const actions = (await testDb.select({ action: schema.adminAuditLogs.action }).from(schema.adminAuditLogs).where(eq(schema.adminAuditLogs.targetId, library.id))).map((row) => row.action);
        expect(actions.sort()).toEqual(["PLACE_CREATED", "PLACE_HIDDEN", "PLACE_RESTORED"]);

        const [pin] = await places.listPublicPlaces({ types: ["COMMUNITY"] });
        expect(await places.updateCuratedPlace(pin.id, { type: "LIBRARY", name: "x", regionCode: "31.71", source: null, ...point(-6.2, 106.8) }, ADMIN)).toBeNull();
    });

    test("the database rejects points outside Indonesia and community rows without a community", async () => {
        await expect(testDb.insert(schema.places).values({ type: "LIBRARY", name: "London", latitude: 51.5, longitude: -0.12 }).execute()).rejects.toThrow();
        await expect(testDb.insert(schema.places).values({ type: "COMMUNITY", name: "Tanpa komunitas", latitude: -6.2, longitude: 106.8 }).execute()).rejects.toThrow();
    });

    test("removing the pin keeps the community", async () => {
        expect(await places.deleteCommunityPlace(VERIFIED)).toBe(true);
        expect(await places.findCommunityPlace(VERIFIED)).toBeNull();
        expect(await testDb.query.communities.findFirst({ where: eq(schema.communities.id, VERIFIED) })).toBeTruthy();
    });
});
