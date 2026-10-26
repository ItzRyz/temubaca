import { describe, expect, test } from "bun:test";

import {
    communityCapabilities,
    eventDisplayStatus,
    eventMissingFields,
    evidenceFileError,
    maskWhatsapp,
    merchPhotoError,
    normalizeInstagram,
    normalizeWhatsapp,
    parseVariants,
    submissionBlocker,
    wibDateTime,
} from "../../src/features/community-management/rules";
import { isKnownKabkota, kabkotaOptions, provinceOptions, regionByCode } from "../../src/features/regions/regions";
import { profileUpdateSchema } from "../../src/lib/validation/common";
import { communityApplicationSchema, communityEventSchema, communityMerchandiseSchema, communityProfileSchema } from "../../src/lib/validation/schemas/community-management.schema";

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
        const base = {
            name: "Klub Buku Menteng", description: "Lingkar pembaca santai yang berkumpul dua pekan sekali.", publicLocation: "Jakarta Pusat", contactEmail: "halo@contoh.org",
            // Kota Administrasi Jakarta Pusat in src/features/regions/data.ts.
            regionCode: "31.71", interests: ["Puisi"],
        };
        expect(communityApplicationSchema.safeParse({ ...base, evidenceUrl: "javascript:alert(1)" }).success).toBe(false);
        const parsed = communityApplicationSchema.parse({ ...base, evidenceUrl: "https://instagram.com/klub", instagramHandle: "@klub", whatsappNumber: "" });
        expect(parsed.instagramHandle).toBe("klub");
        expect(parsed.whatsappNumber).toBeNull();
    });

    test("communities pick 1-5 site genres and a kab/kota from the reference table (ML-04, R-11)", () => {
        const base = {
            name: "Klub Buku Menteng", description: "Lingkar pembaca santai yang berkumpul dua pekan sekali.", publicLocation: "Jakarta Pusat",
            contactEmail: "halo@contoh.org", regionCode: "31.71", interests: ["Puisi"],
        };
        const issue = (input: Record<string, unknown>) => communityProfileSchema.safeParse({ ...base, ...input }).error?.issues[0]?.message;

        // Multipart forms send the list as JSON; duplicates collapse.
        expect(communityProfileSchema.parse({ ...base, interests: JSON.stringify(["Puisi", "Sejarah", "Puisi"]) }).interests).toEqual(["Puisi", "Sejarah"]);
        expect(issue({ interests: [] })).toBe("Pilih minimal 1 minat bacaan.");
        expect(issue({ interests: ["Horor"] })).toBe("Pilih minat dari daftar genre.");
        expect(issue({ interests: ["Puisi", "Sejarah", "Romansa", "Filsafat", "Biografi", "Keluarga"] })).toBe("Pilih maksimal 5 minat bacaan.");
        expect(issue({ regionCode: "" })).toBe("Pilih kabupaten/kota.");
        expect(issue({ regionCode: "31.99" })).toBe("Pilih kabupaten/kota dari daftar.");
        expect(issue({ regionCode: "31" })).toBe("Pilih kabupaten/kota dari daftar.");
    });
});

describe("Kemendagri regions (R-11)", () => {
    test("the reference table has 38 provinces and 514 kab/kota, and lookups follow the code", () => {
        expect(provinceOptions()).toHaveLength(38);
        expect(provinceOptions().reduce((total, province) => total + kabkotaOptions(province.code).length, 0)).toBe(514);
        expect(regionByCode("36.74")).toEqual({ code: "36.74", name: "Kota Tangerang Selatan", provinceCode: "36", provinceName: "Banten" });
        expect(regionByCode("36.99")).toBeUndefined();
        expect(isKnownKabkota("32.73")).toBe(true);
        expect(isKnownKabkota("32-73")).toBe(false);
    });

    test("profile region is optional and an empty choice clears it", () => {
        expect(profileUpdateSchema.parse({ regionCode: "" }).regionCode).toBeNull();
        expect(profileUpdateSchema.parse({ regionCode: "36.74" }).regionCode).toBe("36.74");
        expect(profileUpdateSchema.parse({}).regionCode).toBeUndefined();
        expect(profileUpdateSchema.safeParse({ regionCode: "36.99" }).success).toBe(false);
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

describe("merchandise details (DEC-12)", () => {
    const base = { title: "Tote Bag", priceMode: "FLEXIBLE", availability: "AVAILABLE", contactMode: "COMMUNITY", visible: true };
    const photo = (n: number) => `00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-${String(n).padStart(12, "0")}.jpg`;

    test("variants are split on commas or lines, trimmed, without repeats", () => {
        expect(parseVariants(" S, M ,\nL,, M ")).toEqual(["S", "M", "L"]);
        expect(parseVariants("")).toEqual([]);
    });

    test("photos are JPG, PNG, or WebP up to 2 MB", () => {
        expect(merchPhotoError({ type: "image/webp", size: 1024 })).toBeNull();
        expect(merchPhotoError({ type: "image/gif", size: 1024 }, "Logo")).toBe("Logo harus JPG, PNG, atau WebP.");
        expect(merchPhotoError({ type: "image/png", size: 3 * 1024 * 1024 }, "Logo")).toBe("Ukuran logo maksimal 2 MB.");
        expect(merchPhotoError({ type: "image/gif", size: 1024 })).toContain("JPG");
        expect(merchPhotoError({ type: "image/png", size: 2 * 1024 * 1024 + 1 })).toContain("2 MB");
    });

    test("at most three photo paths and ten variants are accepted", () => {
        expect(communityMerchandiseSchema.parse(base)).toMatchObject({ variants: [], photoPaths: [] });
        expect(communityMerchandiseSchema.safeParse({ ...base, photoPaths: [photo(1), photo(2), photo(3)] }).success).toBe(true);
        expect(communityMerchandiseSchema.safeParse({ ...base, photoPaths: [photo(1), photo(2), photo(3), photo(4)] }).success).toBe(false);
        expect(communityMerchandiseSchema.safeParse({ ...base, photoPaths: ["../etc/passwd"] }).success).toBe(false);
        expect(communityMerchandiseSchema.safeParse({ ...base, variants: Array.from({ length: 11 }, (_, i) => `V${i}`) }).success).toBe(false);
    });
});
