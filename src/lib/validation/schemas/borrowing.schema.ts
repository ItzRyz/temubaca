import { z } from "zod";

import {
    borrowRequestStatusValues,
    borrowingStatusValues,
    bookAccessStatusValues,
} from "@/lib/db/schema";
import { EXTENSION_MAX_DAYS, problemReasons, rejectionReasons } from "@/features/borrowing/lifecycle";

import {
    requestIdParamSchema,
    uuidSchema,
} from "../common";

export const borrowRequestStatusSchema = z.enum(borrowRequestStatusValues);
export const borrowingStatusSchema = z.enum(borrowingStatusValues);
export const bookAccessStatusSchema = z.enum(bookAccessStatusValues);

const optionalText = (max: number, message: string) =>
    z.string().trim().max(max, message).optional().transform((value) => value || undefined);

/** Figma "Ajukan Pinjam" (299:2608). Whether the period and meeting point fit the listing is checked server-side. */
export const createBorrowRequestSchema = z
    .object({
        listingId: z.uuid(),
        meetingPoint: optionalText(80, "Titik temu maksimal 80 karakter."),
        loanDays: z.coerce.number().int().min(1).max(60),
        preferredTime: optionalText(80, "Waktu bertemu maksimal 80 karakter."),
        note: optionalText(200, "Pesan maksimal 200 karakter."),
        agreed: z.literal(true, { error: "Setujui etika bertukar sebelum mengirim permintaan." }),
    })
    .strict();

export const borrowRequestIdSchema = requestIdParamSchema;

export const borrowRequestActionSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("approve") }).strict(),
    z.object({ action: z.literal("cancel") }).strict(),
    z.object({ action: z.literal("confirm_handover") }).strict(),
    z
        .object({
            action: z.literal("reject"),
            reason: z.enum(rejectionReasons, { error: "Pilih alasan penolakan." }),
            note: optionalText(200, "Catatan maksimal 200 karakter."),
            markUnavailable: z.boolean().optional(),
        })
        .strict()
        .refine((data) => data.reason !== "Lainnya" || Boolean(data.note), {
            error: "Isi catatan jika memilih \"Lainnya\".",
            path: ["note"],
        }),
]);

export const borrowingIdSchema = z.object({ borrowingId: uuidSchema });

const problemReasonValues = problemReasons.map((reason) => reason.value) as [string, ...string[]];

export const borrowingActionSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("confirm_return") }).strict(),
    z.object({ action: z.literal("remind") }).strict(),
    z
        .object({
            action: z.literal("report_problem"),
            reason: z.enum(problemReasonValues, { error: "Pilih jenis masalah." }),
            details: z.string().trim().min(10, "Jelaskan masalahnya minimal 10 karakter.").max(500, "Penjelasan maksimal 500 karakter."),
        })
        .strict(),
    z
        .object({
            action: z.literal("request_extension"),
            days: z.coerce.number().int().min(1).max(EXTENSION_MAX_DAYS, `Perpanjangan maksimal ${EXTENSION_MAX_DAYS} hari.`),
            note: optionalText(200, "Pesan maksimal 200 karakter."),
        })
        .strict(),
    z.object({ action: z.literal("approve_extension") }).strict(),
    z.object({ action: z.literal("reject_extension"), note: optionalText(200, "Catatan maksimal 200 karakter.") }).strict(),
]);

export const resolveBorrowingDisputeSchema = z
    .object({
        outcome: z.enum(["RETURNED", "LOST"], { error: "Pilih hasil sengketa." }),
        note: z.string().trim().min(5, "Tulis alasan keputusan minimal 5 karakter.").max(500, "Alasan maksimal 500 karakter."),
    })
    .strict();

export type CreateBorrowRequestInput = z.infer<typeof createBorrowRequestSchema>;
export type BorrowRequestActionInput = z.infer<typeof borrowRequestActionSchema>;
export type BorrowingActionInput = z.infer<typeof borrowingActionSchema>;
