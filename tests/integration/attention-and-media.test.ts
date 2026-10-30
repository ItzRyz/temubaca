import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../../src/lib/db/schema";

// 29 Okt 2026: event images and the Instagram follower cache, against every migration.
const pg = new PGlite();
const testDb = drizzle({ client: pg, schema });
mock.module("server-only", () => ({}));
mock.module(resolve(import.meta.dir, "../../src/lib/db/client.ts"), () => ({ db: testDb }));
const removed: string[][] = [];
mock.module(resolve(import.meta.dir, "../../src/lib/supabase/storage.ts"), () => ({
    removeCommunityImages: async (paths: string[]) => { if (paths.length) removed.push(paths); },
    isEvidenceStorageAvailable: () => false,
}));

setDefaultTimeout(60_000);

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OWNER = id(1), READER = id(2), BOOK = id(100), COMMUNITY = id(300);


beforeAll(async () => {
    const files = (await readdir("drizzle/migrations")).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
        const sql = await readFile(`drizzle/migrations/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await pg.exec(statement);
    }
    await testDb.insert(schema.userProfiles).values([{ id: OWNER, displayName: "Pemilik" }, { id: READER, displayName: "Pembaca" }]);
    await testDb.insert(schema.books).values({ id: BOOK, provider: "MANUAL", providerId: "a", title: "Amba" });
    await testDb.insert(schema.communities).values({ id: COMMUNITY, ownerId: OWNER, name: "Klub Baca", status: "VERIFIED", instagramHandle: "klub.baca" });
});

afterAll(async () => {
    await pg.close();
});

describe("event images", () => {
    test("set, replace, and delete with the draft remove the files; duplicates start without one", async () => {
        const content = await import("../../src/lib/db/queries/community-content");
        const events = await import("../../src/lib/db/queries/events");
        const [event] = await testDb.insert(schema.events).values({ communityId: COMMUNITY, title: "Lingkar Baca", startsAt: new Date(Date.now() + 86_400_000) }).returning();
        await content.setCommunityEventImage(COMMUNITY, event.id, `${COMMUNITY}/event-a.png`);
        await content.setCommunityEventImage(COMMUNITY, event.id, `${COMMUNITY}/event-b.png`);
        expect(removed).toEqual([[`${COMMUNITY}/event-a.png`]]);
        await expect(content.setCommunityEventImage(id(999), event.id, null)).rejects.toThrow("tidak ditemukan");

        const copy = await content.duplicateCommunityEvent(COMMUNITY, event.id);
        expect((await content.findManagedEvent(COMMUNITY, copy.id))?.imagePath).toBeNull();

        await testDb.update(schema.events).set({ publicationStatus: "PUBLISHED" }).where(eq(schema.events.id, event.id));
        const [upcoming] = await events.listUpcomingPublicEvents({ communityId: COMMUNITY, limit: 5 });
        expect(upcoming?.imagePath).toBe(`${COMMUNITY}/event-b.png`);

        await testDb.update(schema.events).set({ publicationStatus: "DRAFT" }).where(eq(schema.events.id, event.id));
        await content.deleteCommunityEvent(COMMUNITY, event.id);
        expect(removed.at(-1)).toEqual([`${COMMUNITY}/event-b.png`]);
    });
});

describe("Instagram follower cache", () => {
    test("a saved count shows on the profile; changing the handle clears it", async () => {
        const communities = await import("../../src/lib/db/queries/communities");
        const management = await import("../../src/lib/db/queries/community-management");
        await communities.saveInstagramFollowers(COMMUNITY, "klub.baca", 1520);
        // A count for a handle the community no longer uses is ignored.
        await communities.saveInstagramFollowers(COMMUNITY, "akun.lama", 99);
        const profile = await communities.findPublicCommunityProfile(COMMUNITY);
        expect([profile?.instagramFollowers, profile?.instagramCheckedAt instanceof Date]).toEqual([1520, true]);

        const keep = { name: "Klub Baca", description: "Klub baca untuk warga sekitar taman.", regionCode: "31.71", publicLocation: "Taman Suropati", interests: [], contactEmail: "klub@contoh.id", whatsappNumber: null };
        await management.updateCommunityProfile(COMMUNITY, { ...keep, instagramHandle: "klub.baca" });
        expect((await communities.findPublicCommunityProfile(COMMUNITY))?.instagramFollowers).toBe(1520);
        await management.updateCommunityProfile(COMMUNITY, { ...keep, instagramHandle: "klub.baca.baru" });
        const changed = await communities.findPublicCommunityProfile(COMMUNITY);
        expect([changed?.instagramFollowers, changed?.instagramCheckedAt]).toEqual([null, null]);
    });
});
