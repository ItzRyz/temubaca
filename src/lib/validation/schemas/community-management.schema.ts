import { z } from "zod";

import { genres } from "@/features/books/genres";
import { MERCH_PHOTO_LIMIT, MERCH_VARIANT_LIMIT, merchandiseCategories, normalizeInstagram, normalizeWhatsapp } from "@/features/community-management/rules";
import { isKnownKabkota } from "@/features/regions/regions";

import { uuidSchema } from "../common";

const text = (min: number, max: number, label: string) =>
    z.string({ error: `${label} wajib diisi.` }).trim()
        .min(1, `${label} wajib diisi.`)
        .min(min, `${label} minimal ${min} karakter.`)
        .max(max, `${label} maksimal ${max} karakter.`);

const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

const optionalText = (max: number, label: string) =>
    z.preprocess(blankToUndefined, z.string().trim().max(max, `${label} maksimal ${max} karakter.`).optional());

export const linkSchema = (label: string) =>
    z.string({ error: `${label} wajib diisi.` }).trim().max(2048)
        .refine((value) => {
            try {
                return ["http:", "https:"].includes(new URL(value).protocol);
            } catch {
                return false;
            }
        }, `${label} harus berupa tautan http(s) yang valid.`);

export const COMMUNITY_INTEREST_LIMIT = 5;
const genreLabels = new Set(genres.map((genre) => genre.label));

/** Multipart forms send the tag list as a JSON string; JSON bodies send the array itself. */
const jsonArray = (value: unknown) => {
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

/** Site genre labels the community reads (ML-04), so they match the interests readers pick. */
export const communityInterestsSchema = z.preprocess(
    jsonArray,
    z.array(z.string().refine((label) => genreLabels.has(label), "Pilih minat dari daftar genre."), { error: "Pilih minimal 1 minat bacaan." })
        .min(1, "Pilih minimal 1 minat bacaan.")
        .max(COMMUNITY_INTEREST_LIMIT, `Pilih maksimal ${COMMUNITY_INTEREST_LIMIT} minat bacaan.`)
        .transform((labels) => [...new Set(labels)]),
);

/** Kemendagri kab/kota code (R-11) from the region picker. */
export const regionCodeSchema = z.string({ error: "Pilih kabupaten/kota." }).trim()
    .min(1, "Pilih kabupaten/kota.")
    .refine(isKnownKabkota, "Pilih kabupaten/kota dari daftar.");

/** Figma "Kelola Komunitas - Profil Komunitas" (25:5622). */
export const communityProfileSchema = z.object({
    name: text(3, 50, "Nama komunitas"),
    description: text(20, 1000, "Deskripsi"),
    regionCode: regionCodeSchema,
    publicLocation: text(3, 120, "Wilayah dan titik pertemuan"),
    interests: communityInterestsSchema,
    contactEmail: z.string({ error: "Surel kontak wajib diisi." }).trim().max(254).email("Surel kontak tidak valid."),
    instagramHandle: z.string().optional().transform((value, ctx) => {
        const handle = normalizeInstagram(value);
        if (handle === undefined) ctx.addIssue({ code: "custom", message: "Nama pengguna Instagram tidak valid." });
        return handle ?? null;
    }),
    whatsappNumber: z.string().optional().transform((value, ctx) => {
        const number = normalizeWhatsapp(value);
        if (number === undefined) ctx.addIssue({ code: "custom", message: "Nomor WhatsApp tidak valid. Gunakan nomor Indonesia, mis. 0812 9842 1102." });
        return number ?? null;
    }),
});

const evidenceFields = {
    evidenceUrl: linkSchema("Tautan bukti aktivitas"),
    note: optionalText(500, "Catatan untuk peninjau"),
};

export const communityApplicationSchema = communityProfileSchema.extend(evidenceFields);
export const verificationSubmissionSchema = z.object(evidenceFields);

export const communityIdSchema = z.object({ communityId: uuidSchema });
export const submissionIdSchema = z.object({ communityId: uuidSchema, submissionId: uuidSchema });
export const inviteIdSchema = z.object({ communityId: uuidSchema, inviteId: uuidSchema });
export const managerIdSchema = z.object({ communityId: uuidSchema, userId: uuidSchema });
export const communityEventIdSchema = z.object({ communityId: uuidSchema, eventId: uuidSchema });
export const communityMerchandiseIdSchema = z.object({ communityId: uuidSchema, itemId: uuidSchema });

export const acceptInviteSchema = z.object({ token: z.string().trim().regex(/^[A-Za-z0-9_-]{32,64}$/, "Tautan undangan tidak valid.") }).strict();

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.");
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Jam tidak valid.");
/** Figma "Buat Acara" (293:2789). Drafts may lack a schedule or location; publishing needs both. */
export const communityEventSchema = z
    .object({
        title: text(3, 100, "Judul acara"),
        description: text(10, 1000, "Deskripsi"),
        date: z.preprocess(blankToUndefined, dateSchema.optional()),
        startTime: z.preprocess(blankToUndefined, timeSchema.optional()),
        endTime: z.preprocess(blankToUndefined, timeSchema.optional()),
        locationType: z.enum(["PHYSICAL", "ONLINE"]),
        venueName: optionalText(120, "Nama tempat"),
        publicLocation: optionalText(200, "Alamat atau patokan"),
        eventUrl: z.preprocess(blankToUndefined, linkSchema("Tautan daring").optional()),
        publicationStatus: z.enum(["DRAFT", "PUBLISHED"]),
    })
    .strict()
    .superRefine((data, ctx) => {
        if (data.startTime && data.endTime && data.endTime <= data.startTime) {
            ctx.addIssue({ code: "custom", path: ["endTime"], message: "Jam selesai harus setelah jam mulai." });
        }
        if (data.publicationStatus !== "PUBLISHED") return;
        if (!data.date) ctx.addIssue({ code: "custom", path: ["date"], message: "Isi tanggal sebelum menerbitkan." });
        if (!data.startTime) ctx.addIssue({ code: "custom", path: ["startTime"], message: "Isi jam mulai sebelum menerbitkan." });
        if (!data.endTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "Isi jam selesai sebelum menerbitkan." });
        if (data.locationType === "ONLINE") {
            if (!data.eventUrl) ctx.addIssue({ code: "custom", path: ["eventUrl"], message: "Isi tautan daring sebelum menerbitkan." });
        } else {
            if (!data.venueName) ctx.addIssue({ code: "custom", path: ["venueName"], message: "Isi nama tempat sebelum menerbitkan." });
            if (!data.publicLocation) ctx.addIssue({ code: "custom", path: ["publicLocation"], message: "Isi alamat atau patokan sebelum menerbitkan." });
        }
    });

export const eventStatusActionSchema = z.object({ action: z.enum(["archive", "duplicate"]) }).strict();

/** Figma "Tambah Merchandise" (309:2922). Purchases happen with the community, outside TemuBaca (DEC-03). */
export const communityMerchandiseSchema = z
    .object({
        title: text(2, 80, "Nama item"),
        category: z.preprocess(blankToUndefined, z.enum(merchandiseCategories).optional()),
        description: optionalText(300, "Deskripsi"),
        priceMode: z.enum(["FIXED", "FLEXIBLE"]),
        priceAmount: z.preprocess(blankToUndefined, z.coerce.number().int("Harga harus bilangan bulat.").min(0).max(100_000_000).optional()),
        priceNote: optionalText(120, "Keterangan harga"),
        availability: z.enum(["AVAILABLE", "UNAVAILABLE"]),
        stockNote: optionalText(80, "Keterangan"),
        contactMode: z.enum(["COMMUNITY", "CUSTOM"]),
        contactOverride: optionalText(120, "Kontak khusus"),
        variants: z
            .array(z.string().trim().min(1).max(40, "Setiap varian maksimal 40 karakter."))
            .max(MERCH_VARIANT_LIMIT, `Varian maksimal ${MERCH_VARIANT_LIMIT}.`)
            .default([]),
        fulfillmentNote: optionalText(200, "Cara pengiriman atau pengambilan"),
        // Paths returned by the photo upload; the server also checks they belong to this community.
        photoPaths: z
            .array(z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/, "Foto tidak valid."))
            .max(MERCH_PHOTO_LIMIT, `Foto maksimal ${MERCH_PHOTO_LIMIT}.`)
            .default([]),
        visible: z.boolean(),
    })
    .strict()
    .superRefine((data, ctx) => {
        if (data.priceMode === "FIXED" && data.priceAmount === undefined) {
            ctx.addIssue({ code: "custom", path: ["priceAmount"], message: "Isi harga, atau pilih \"Tanpa harga tetap\"." });
        }
        if (data.contactMode === "CUSTOM" && !data.contactOverride) {
            ctx.addIssue({ code: "custom", path: ["contactOverride"], message: "Isi kontak khusus untuk item ini." });
        }
    });

export const reverificationReviewSchema = z
    .object({
        decision: z.enum(["CONFIRM", "DISMISS"]),
        note: z.string().trim().max(500).optional().transform((value) => value || undefined),
    })
    .strict()
    .refine((data) => data.decision === "CONFIRM" || Boolean(data.note), { path: ["note"], error: "Tulis alasan bila pengajuan diabaikan." });

export type CommunityProfileInput = z.infer<typeof communityProfileSchema>;
export type CommunityApplicationInput = z.infer<typeof communityApplicationSchema>;
export type CommunityEventInput = z.infer<typeof communityEventSchema>;
export type CommunityMerchandiseInput = z.infer<typeof communityMerchandiseSchema>;
