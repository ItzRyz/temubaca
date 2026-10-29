import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../../src/lib/db/schema";

// DEC-04 community management against an in-memory Postgres with every migration applied.
const pg = new PGlite();
const testDb = drizzle({ client: pg, schema });
mock.module("server-only", () => ({}));
mock.module(resolve(import.meta.dir, "../../src/lib/db/client.ts"), () => ({ db: testDb }));
const removedPhotos: string[][] = [];
mock.module(resolve(import.meta.dir, "../../src/lib/supabase/storage.ts"), () => ({
    removeCommunityImages: async (paths: string[]) => { if (paths.length) removedPhotos.push(paths); },
    isEvidenceStorageAvailable: () => false,
    uploadEvidenceFile: async () => { throw new Error("no storage in tests"); },
    uploadMerchandisePhoto: async () => { throw new Error("no storage in tests"); },
    removeEvidenceFile: async () => {},
    signedEvidenceUrl: async () => null,
}));

setDefaultTimeout(60_000);

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OWNER = id(1), MANAGER = id(2), STRANGER = id(3), ADMIN = id(4);

let management: typeof import("../../src/lib/db/queries/community-management");
let content: typeof import("../../src/lib/db/queries/community-content");
let verifications: typeof import("../../src/lib/db/queries/verifications");

const application = (name: string) => ({
    name,
    description: "Lingkar pembaca santai yang berkumpul dua pekan sekali.",
    // Kota Administrasi Jakarta Pusat in src/features/regions/data.ts.
    regionCode: "31.71",
    publicLocation: "Jakarta Pusat — Taman Suropati",
    interests: ["Sastra Indonesia", "Puisi"],
    contactEmail: "halo@contoh.org",
    instagramHandle: "klub",
    whatsappNumber: null,
    evidenceUrl: "https://instagram.com/klub",
    note: undefined,
});

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
        { id: MANAGER, displayName: "Pengurus" },
        { id: STRANGER, displayName: "Orang Lain" },
        { id: ADMIN, displayName: "Admin", role: "ADMIN" },
    ]);
    management = await import("../../src/lib/db/queries/community-management");
    content = await import("../../src/lib/db/queries/community-content");
    verifications = await import("../../src/lib/db/queries/verifications");
});

afterAll(async () => {
    await pg.close();
});

describe("applications", () => {
    let communityId: string;

    test("create a PENDING community with an owner membership and the evidence", async () => {
        communityId = (await management.createCommunityApplication(OWNER, application("Klub Buku Menteng"), null)).id;
        const access = await management.getCommunityAccess(OWNER, communityId);
        expect(access?.role).toBe("owner");
        expect(access?.community.status).toBe("PENDING");
        expect((await management.getCommunityAccess(STRANGER, communityId))?.role).toBeNull();
        const [submission] = await management.listCommunitySubmissions(communityId);
        expect(submission.status).toBe("PENDING");
        await expect(management.createVerificationSubmission(communityId, OWNER, { evidenceUrl: "https://contoh.org" }, null)).rejects.toThrow("masih ditinjau");
    });

    test("at most three applications wait per account", async () => {
        await management.createCommunityApplication(OWNER, application("Kedua"), null);
        await management.createCommunityApplication(OWNER, application("Ketiga"), null);
        await expect(management.createCommunityApplication(OWNER, application("Keempat"), null)).rejects.toThrow("3 pengajuan");
    });

    test("rejection answers the evidence; a new attempt goes back to PENDING", async () => {
        await verifications.reviewCommunity({ communityId, reviewerId: ADMIN, decision: "REJECT", note: "Bukti kurang." });
        expect((await management.listCommunitySubmissions(communityId))[0].status).toBe("REJECTED");
        const retry = await management.createVerificationSubmission(communityId, OWNER, { evidenceUrl: "https://contoh.org/arsip" }, null);
        expect(retry.status).toBe("PENDING");
        await verifications.reviewCommunity({ communityId, reviewerId: ADMIN, decision: "APPROVE" });
        const [latest] = await management.listCommunitySubmissions(communityId);
        expect(latest.status).toBe("APPROVED");
    });

    test("re-verification of a verified community never lowers its status", async () => {
        const { id: submissionId } = await management.createVerificationSubmission(communityId, OWNER, { evidenceUrl: "https://contoh.org/2026" }, null);
        expect((await management.listPendingReverifications()).map((item) => item.id)).toContain(submissionId);
        await management.reviewReverification(submissionId, ADMIN, { decision: "DISMISS", note: "Tidak ada perubahan." });
        const community = await testDb.query.communities.findFirst({ where: eq(schema.communities.id, communityId) });
        expect(community?.status).toBe("VERIFIED");
        await expect(management.reviewReverification(submissionId, ADMIN, { decision: "CONFIRM" })).rejects.toThrow("sudah ditinjau");
    });

    describe("managers and content", () => {
        test("a one-time invite makes a manager; it cannot be reused", async () => {
            const { token } = await management.createManagerInvite(communityId, OWNER);
            expect((await management.previewManagerInvite(token))?.valid).toBe(true);
            await expect(management.acceptManagerInvite(token, OWNER)).rejects.toThrow("pemilik");
            await management.acceptManagerInvite(token, MANAGER);
            expect((await management.getCommunityAccess(MANAGER, communityId))?.role).toBe("manager");
            await expect(management.acceptManagerInvite(token, STRANGER)).rejects.toThrow("sudah dipakai");
            expect((await management.listCommunityTeam(communityId)).managers.map((item) => item.displayName)).toEqual(["Pengurus"]);
        });

        test("revoked invites stop working", async () => {
            const invite = await management.createManagerInvite(communityId, OWNER);
            await management.revokeManagerInvite(communityId, invite.id);
            await expect(management.acceptManagerInvite(invite.token, STRANGER)).rejects.toThrow("dicabut");
        });

        test("events: drafts may be incomplete, published ones are archived instead of deleted", async () => {
            const draft = await content.createCommunityEvent(communityId, { title: "Tukar Buku Akhir Tahun", description: "Bawa satu buku, pulang membawa buku lain.", locationType: "PHYSICAL", publicationStatus: "DRAFT" });
            const published = await content.createCommunityEvent(communityId, {
                title: "Lingkar Baca #15", description: "Diskusi santai buku bulan ini.", locationType: "PHYSICAL", publicationStatus: "PUBLISHED",
                date: "2026-10-25", startTime: "08:30", endTime: "10:30", venueName: "Gazebo Barat", publicLocation: "Taman Suropati, Menteng",
            });
            const stored = await content.findManagedEvent(communityId, published.id);
            expect(stored?.startsAt?.toISOString()).toBe("2026-10-25T01:30:00.000Z");
            await expect(content.deleteCommunityEvent(communityId, published.id)).rejects.toThrow("diarsipkan");
            await content.archiveCommunityEvent(communityId, published.id);
            const copy = await content.duplicateCommunityEvent(communityId, published.id);
            expect((await content.findManagedEvent(communityId, copy.id))?.publicationStatus).toBe("DRAFT");
            await content.deleteCommunityEvent(communityId, draft.id);
            expect(await content.findManagedEvent(communityId, draft.id)).toBeUndefined();
        });

        test("merchandise keeps prices in IDR and hides items without deleting them", async () => {
            const own = (n: number) => `${communityId}/${id(n)}.jpg`;
            const foreign = `${id(999)}/${id(1)}.jpg`;
            const item = await content.createCommunityMerchandise(communityId, {
                title: "Tote Bag Kanvas", priceMode: "FIXED", priceAmount: 75000, availability: "AVAILABLE", contactMode: "COMMUNITY", visible: true,
                variants: ["Hitam", "Krem"], fulfillmentNote: "Ambil di acara bulanan", photoPaths: [own(1), own(2), foreign],
            });
            // A path uploaded for another community is never attached.
            expect((await content.findManagedMerchandise(communityId, item.id))?.photoPaths).toEqual([own(1), own(2)]);
            await content.updateCommunityMerchandise(communityId, item.id, {
                title: "Tote Bag Kanvas", priceMode: "FLEXIBLE", priceNote: "Donasi sukarela", availability: "UNAVAILABLE", stockNote: "Menunggu cetak ulang",
                contactMode: "CUSTOM", contactOverride: "DM Instagram @klub", visible: false, variants: [], photoPaths: [own(2)],
            });
            const stored = await content.findManagedMerchandise(communityId, item.id);
            expect(stored).toMatchObject({ priceAmount: null, priceNote: "Donasi sukarela", status: "DRAFT", contactOverride: "DM Instagram @klub", variants: [], fulfillmentNote: null, photoPaths: [own(2)] });
            expect(removedPhotos).toEqual([[own(1)]]);
            await content.deleteCommunityMerchandise(communityId, item.id);
            expect(removedPhotos).toEqual([[own(1)], [own(2)]]);
            expect(await content.findManagedMerchandise(id(999), item.id)).toBeUndefined();
        });

        test("removing a manager ends their access", async () => {
            await management.removeCommunityManager(communityId, MANAGER);
            expect((await management.getCommunityAccess(MANAGER, communityId))?.role).toBeNull();
            expect((await management.listManagedCommunities(OWNER)).length).toBe(3);
        });
    });
});

describe("community logo (TB-030)", () => {
    const LOGO_COMMUNITY = id(500), FROZEN = id(501);

    test("setting, replacing, and removing the logo; replaced files are deleted", async () => {
        await testDb.insert(schema.communities).values([
            { id: LOGO_COMMUNITY, ownerId: OWNER, name: "Klub Logo", status: "VERIFIED" },
            { id: FROZEN, ownerId: OWNER, name: "Klub Ditangguhkan", status: "SUSPENDED" },
        ]);
        const communities = await import("../../src/lib/db/queries/communities");
        removedPhotos.length = 0;

        await management.setCommunityImage(LOGO_COMMUNITY, "logoPath", `${LOGO_COMMUNITY}/logo-a.png`);
        expect((await communities.findPublicCommunityProfile(LOGO_COMMUNITY))?.logoPath).toBe(`${LOGO_COMMUNITY}/logo-a.png`);

        await management.setCommunityImage(LOGO_COMMUNITY, "logoPath", `${LOGO_COMMUNITY}/logo-b.webp`);
        await management.setCommunityImage(LOGO_COMMUNITY, "logoPath", null);
        expect((await communities.findPublicCommunityProfile(LOGO_COMMUNITY))?.logoPath).toBeNull();
        expect(removedPhotos).toEqual([[`${LOGO_COMMUNITY}/logo-a.png`], [`${LOGO_COMMUNITY}/logo-b.webp`]]);
    });

    test("the banner is kept apart from the logo and shows on the public profile", async () => {
        const communities = await import("../../src/lib/db/queries/communities");
        removedPhotos.length = 0;
        await management.setCommunityImage(LOGO_COMMUNITY, "logoPath", `${LOGO_COMMUNITY}/logo-c.png`);
        await management.setCommunityImage(LOGO_COMMUNITY, "bannerPath", `${LOGO_COMMUNITY}/banner-a.webp`);
        const profile = await communities.findPublicCommunityProfile(LOGO_COMMUNITY);
        expect([profile?.logoPath, profile?.bannerPath]).toEqual([`${LOGO_COMMUNITY}/logo-c.png`, `${LOGO_COMMUNITY}/banner-a.webp`]);
        await management.setCommunityImage(LOGO_COMMUNITY, "bannerPath", null);
        expect(removedPhotos).toEqual([[`${LOGO_COMMUNITY}/banner-a.webp`]]);
    });

    test("a suspended community's logo is frozen like the rest of its profile", async () => {
        await expect(management.setCommunityImage(FROZEN, "logoPath", `${FROZEN}/logo-a.png`)).rejects.toThrow("ditangguhkan");
        await expect(management.setCommunityImage(id(599), "bannerPath", null)).rejects.toThrow("tidak ditemukan");
    });
});
