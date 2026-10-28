import { z } from "zod";

import { ACCESS_MESSAGE_MAX, ACCESS_NOTE_MAX, holdingStatuses } from "@/features/libraries/access";

import { uuidSchema } from "../common";
import { linkSchema, regionCodeSchema } from "./community-management.schema";

const optionalText = (max: number, label: string) =>
    z.string().trim().max(max, `${label} maksimal ${max} karakter.`).optional().nullable().transform((value) => value || null);
const optionalLink = (label: string) => z.union([z.literal(""), linkSchema(label)]).optional().nullable().transform((value) => value || null);
const optionalCount = z.preprocess((value) => (value === "" || value === null || value === undefined ? null : Number(value)),
    z.number().int("Jumlah eksemplar harus bilangan bulat.").min(0, "Jumlah eksemplar tidak boleh negatif.").max(999).nullable());

export const libraryIdParamSchema = z.object({ libraryId: uuidSchema });
export const accessIdParamSchema = z.object({ accessId: uuidSchema });

/** A reader asks a library for a book it holds (TB-023). */
export const createAccessRequestSchema = z.object({
    libraryId: z.uuid(),
    bookId: z.uuid(),
    message: optionalText(ACCESS_MESSAGE_MAX, "Pesan"),
    agreed: z.literal(true, { error: "Setujui aturan perpustakaan sebelum mengirim pengajuan." }),
}).strict();

export const accessActionSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("approve"), note: optionalText(ACCESS_NOTE_MAX, "Catatan") }).strict(),
    z.object({
        action: z.literal("reject"),
        note: z.string({ error: "Tulis alasan penolakan." }).trim().min(5, "Tulis alasan penolakan minimal 5 karakter.").max(ACCESS_NOTE_MAX, `Alasan maksimal ${ACCESS_NOTE_MAX} karakter.`),
    }).strict(),
    z.object({ action: z.literal("collected") }).strict(),
    z.object({ action: z.literal("cancel") }).strict(),
]);

/** One book in a library's collection, set by its manager or curated by an admin. */
export const holdingInputSchema = z.object({
    bookId: z.uuid({ error: "Pilih buku." }),
    status: z.enum(holdingStatuses, { error: "Pilih status." }),
    copiesTotal: optionalCount,
    copiesAvailable: optionalCount,
    callNumber: optionalText(60, "Nomor panggil"),
}).strict().refine((input) => input.copiesAvailable === null || input.copiesTotal === null || input.copiesAvailable <= input.copiesTotal, {
    message: "Eksemplar tersedia tidak boleh lebih dari jumlah eksemplar.",
    path: ["copiesAvailable"],
});

export const removeHoldingSchema = z.object({ bookId: z.uuid() }).strict();

/** What a library's manager may change: whether and how readers can ask. */
export const libraryAccessSettingsSchema = z.object({
    accessEnabled: z.boolean(),
    accessRules: optionalText(500, "Aturan akses"),
    pickupDays: z.coerce.number().int().min(1, "Batas ambil minimal 1 hari.").max(14, "Batas ambil maksimal 14 hari."),
}).strict();

export const createLibrarySchema = z.object({ placeId: z.uuid({ error: "Pilih perpustakaan di Peta Literasi." }) }).strict();

/** Admin edit of a library's public details and its OneSearch institution name. */
export const updateLibrarySchema = z.object({
    name: z.string().trim().min(3, "Nama minimal 3 karakter.").max(120, "Nama maksimal 120 karakter."),
    publicLocation: optionalText(200, "Alamat"),
    regionCode: regionCodeSchema.optional().nullable().transform((value) => value || null),
    catalogUrl: optionalLink("Tautan katalog"),
    websiteUrl: optionalLink("Situs web"),
    oneSearchInstitution: optionalText(200, "Nama institusi OneSearch"),
    hidden: z.boolean(),
}).strict();

export const libraryManagerSchema = z.object({ userId: z.uuid({ error: "Pilih akun." }) }).strict();

export const oneSearchSyncSchema = z.object({ bookId: z.uuid() }).strict();

export type CreateAccessRequestInput = z.infer<typeof createAccessRequestSchema>;
export type AccessActionInput = z.infer<typeof accessActionSchema>;
export type HoldingInput = z.infer<typeof holdingInputSchema>;
export type LibraryAccessSettingsInput = z.infer<typeof libraryAccessSettingsSchema>;
export type UpdateLibraryInput = z.infer<typeof updateLibrarySchema>;
