import { describe, expect, test } from "bun:test";

import {
    communityCapabilities,
    eventDisplayStatus,
    eventMissingFields,
    evidenceFileError,
    maskWhatsapp,
    normalizeInstagram,
    normalizeWhatsapp,
    submissionBlocker,
    wibDateTime,
} from "../../src/features/community-management/rules";
import { communityApplicationSchema, communityEventSchema, communityMerchandiseSchema } from "../../src/lib/validation/schemas/community-management.schema";

describe("who may do what (DEC-04)", () => {
    test("owners edit and manage the team; managers only handle content once verified", () => {
        expect(communityCapabilities("owner", "VERIFIED")).toEqual({ view: true, editProfile: true, manageTeam: true, submitVerification: true, manageContent: true });
        expect(communityCapabilities("manager", "VERIFIED")).toEqual({ view: true, editProfile: false, manageTeam: false, submitVerification: false, manageContent: true });
        expect(communityCapabilities("owner", "PENDING")).toMatchObject({ editProfile: true, manageContent: false, submitVerification: false });
        expect(communityCapabilities("owner", "REJECTED")).toMatchObject({ editProfile: true, submitVerification: true });
        expect(communityCapabilities("owner", "SUSPENDED")).toMatchObject({ editProfile: false, manageContent: false });
        expect(communityCapabilities(null, "VERIFIED").view).toBe(false);
    });

    test("re-verification waits for the previous request", () => {
        expect(submissionBlocker("VERIFIED", false)).toBeNull();
        expect(submissionBlocker("VERIFIED", true)).not.toBeNull();
        expect(submissionBlocker("PENDING", false)).not.toBeNull();
        expect(submissionBlocker("REJECTED", false)).toBeNull();
    });
});

describe("contact and evidence rules", () => {
    test("normalise Instagram and WhatsApp", () => {
        expect(normalizeInstagram("@klubbukumenteng")).toBe("klubbukumenteng");
        expect(normalizeInstagram("https://www.instagram.com/klub.buku/")).toBe("klub.buku");
        expect(normalizeInstagram("bukan handle!")).toBeUndefined();
        expect(normalizeInstagram("")).toBeNull();
        expect(normalizeWhatsapp("0812-9842-1102")).toBe("+6281298421102");
        expect(normalizeWhatsapp("+62 812 9842 1102")).toBe("+6281298421102");
        expect(normalizeWhatsapp("12345")).toBeUndefined();
        expect(maskWhatsapp("+6281298421102")).toBe("0812-••••-1102");
    });

    test("evidence files are PDF/JPG/PNG up to 5 MB", () => {
        expect(evidenceFileError({ size: 1024, type: "application/pdf" })).toBeNull();
        expect(evidenceFileError({ size: 1024, type: "image/gif" })).not.toBeNull();
        expect(evidenceFileError({ size: 6 * 1024 * 1024, type: "image/png" })).not.toBeNull();
    });

    test("applications need a valid evidence link", () => {
        const base = { name: "Klub Buku Menteng", description: "Lingkar pembaca santai yang berkumpul dua pekan sekali.", publicLocation: "Jakarta Pusat", contactEmail: "halo@contoh.org" };
        expect(communityApplicationSchema.safeParse({ ...base, evidenceUrl: "javascript:alert(1)" }).success).toBe(false);
        const parsed = communityApplicationSchema.parse({ ...base, evidenceUrl: "https://instagram.com/klub", instagramHandle: "@klub", whatsappNumber: "" });
        expect(parsed.instagramHandle).toBe("klub");
        expect(parsed.whatsappNumber).toBeNull();
    });
});

describe("events and merchandise", () => {
    const now = new Date("2026-10-18T03:00:00Z");

    test("display status and missing fields", () => {
        expect(eventDisplayStatus({ publicationStatus: "PUBLISHED", startsAt: new Date("2026-10-11T01:30:00Z"), endsAt: new Date("2026-10-11T03:30:00Z") }, now)).toBe("DONE");
        expect(eventDisplayStatus({ publicationStatus: "PUBLISHED", startsAt: new Date("2026-10-25T01:30:00Z"), endsAt: null }, now)).toBe("PUBLISHED");
        expect(eventDisplayStatus({ publicationStatus: "DRAFT", startsAt: null, endsAt: null }, now)).toBe("DRAFT");
        expect(eventMissingFields({ startsAt: null, endsAt: null, locationType: "PHYSICAL", venueName: null, publicLocation: null, eventUrl: null })).toEqual(["schedule", "location"]);
        expect(wibDateTime("2026-10-25", "08:30").toISOString()).toBe("2026-10-25T01:30:00.000Z");
    });

    test("publishing needs a schedule and location; drafts do not", () => {
        const base = { title: "Lingkar Baca #15", description: "Diskusi santai buku bulan ini.", locationType: "PHYSICAL" as const };
        expect(communityEventSchema.safeParse({ ...base, publicationStatus: "DRAFT" }).success).toBe(true);
        expect(communityEventSchema.safeParse({ ...base, publicationStatus: "PUBLISHED" }).success).toBe(false);
        expect(communityEventSchema.safeParse({ ...base, publicationStatus: "PUBLISHED", date: "2026-10-25", startTime: "10:00", endTime: "09:00", venueName: "Gazebo", publicLocation: "Taman Suropati" }).success).toBe(false);
        expect(communityEventSchema.safeParse({ ...base, publicationStatus: "PUBLISHED", date: "2026-10-25", startTime: "08:30", endTime: "10:30", venueName: "Gazebo", publicLocation: "Taman Suropati" }).success).toBe(true);
        expect(communityEventSchema.safeParse({ ...base, locationType: "ONLINE", publicationStatus: "PUBLISHED", date: "2026-10-25", startTime: "08:30", endTime: "10:30" }).success).toBe(false);
    });

    test("fixed prices need an amount and custom contact needs a value", () => {
        const base = { title: "Tote Bag", priceMode: "FIXED" as const, availability: "AVAILABLE" as const, contactMode: "COMMUNITY" as const, visible: true };
        expect(communityMerchandiseSchema.safeParse(base).success).toBe(false);
        expect(communityMerchandiseSchema.safeParse({ ...base, priceAmount: "75000" }).success).toBe(true);
        expect(communityMerchandiseSchema.safeParse({ ...base, priceMode: "FLEXIBLE" }).success).toBe(true);
        expect(communityMerchandiseSchema.safeParse({ ...base, priceAmount: 1, contactMode: "CUSTOM" }).success).toBe(false);
    });
});
