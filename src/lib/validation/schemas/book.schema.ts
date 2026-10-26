import { z } from "zod";

import { MAX_MEETING_POINTS } from "@/features/book-listings/listing-draft";
import {
    bookConditionValues,
    bookProviderValues,
    listingAvailabilityValues,
} from "@/lib/db/schema";

import {
    bookIdParamSchema,
    listingIdParamSchema,
} from "../common";

import {
    descriptionSchema,
    isbnSchema,
    languageSchema,
    titleSchema,
} from "../strings";

import {
    paginationSchema,
} from "../pagination";

import {
    httpUrlSchema,
} from "../urls";

export const bookProviderSchema =
    z.enum(bookProviderValues);

export const bookConditionSchema =
    z.enum(bookConditionValues);

export const listingAvailabilitySchema =
    z.enum(
        listingAvailabilityValues,
    );

export const bookSearchQuerySchema =
    paginationSchema
        .extend({
            q: z
                .string()
                .trim()
                .min(1)
                .max(200),
        })
        .strict();

const optionalFilterText = (max: number) =>
    z
        .string()
        .trim()
        .max(max)
        .optional()
        .transform((value) => value || undefined);

export const bookBrowseQuerySchema =
    paginationSchema
        .extend({
            q: optionalFilterText(200),
            category: optionalFilterText(100),
            language: optionalFilterText(35),
        })
        .strict();

export const bookIdSchema =
    bookIdParamSchema;

const meetingPlaceIdsSchema =
    z
        .array(z.uuid())
        .max(MAX_MEETING_POINTS);

export const createBookListingSchema =
    z
        .object({
            bookId:
                z.uuid(),

            condition:
                bookConditionSchema,

            availability:
                listingAvailabilitySchema
                    .default("AVAILABLE"),

            publicLocation:
                z
                    .string()
                    .trim()
                    .max(500)
                    .optional(),

            // Peta Literasi places among the meeting points (TB-027).
            meetingPlaceIds:
                meetingPlaceIdsSchema
                    .optional(),

            borrowingRules:
                z
                    .string()
                    .trim()
                    .max(5_000)
                    .optional(),
        })
        .strict();

export const updateBookListingSchema =
    z
        .object({
            condition:
                bookConditionSchema.optional(),

            availability:
                listingAvailabilitySchema
                    .optional(),

            publicLocation:
                z
                    .string()
                    .trim()
                    .max(500)
                    .nullable()
                    .optional(),

            meetingPlaceIds:
                meetingPlaceIdsSchema
                    .optional(),

            borrowingRules:
                z
                    .string()
                    .trim()
                    .max(5_000)
                    .nullable()
                    .optional(),
        })
        .strict()
        .refine((input) => Object.keys(input).length > 0, {
            message: "Provide at least one field to update.",
        });

export const bookListingIdSchema =
    listingIdParamSchema;

export const externalBookSchema =
    z
        .object({
            provider:
                bookProviderSchema,

            providerId:
                z.string().trim().min(1).max(500),

            isbn:
                isbnSchema.optional(),

            title:
                titleSchema,

            authors:
                z.array(
                    z.string().trim().min(1).max(255),
                ).max(50).default([]),

            description:
                descriptionSchema,

            publisher:
                z.string().trim().max(255).optional(),

            publishedAt:
                z.string().trim().max(100).optional(),

            language:
                languageSchema.optional(),

            categories:
                z.array(
                    z.string().trim().min(1).max(100),
                ).max(50).default([]),

            coverUrl:
                httpUrlSchema.optional(),
        })
        .strict();

export type ExternalBook = z.infer<typeof externalBookSchema>;

export const listingVisibilitySchema =
    z
        .object({
            hidden: z.boolean(),

            reason:
                z.string().trim().max(500).optional(),
        })
        .strict()
        .refine((input) => !input.hidden || (input.reason?.length ?? 0) >= 3, {
            message: "Alasan wajib diisi (minimal 3 karakter) untuk menyembunyikan listing.",
            path: ["reason"],
        });

export const externalBookImportSchema =
    z
        .object({
            provider: z.enum(["OPEN_LIBRARY", "GOOGLE_BOOKS"]),

            providerId:
                z.string().trim().min(1).max(100).regex(/^[\w-]+$/),
        })
        .strict();

export const externalBookSearchQuerySchema =
    z
        .object({
            q: z.string().trim().min(2).max(200),
        })
        .strict();

export const manualBookSchema =
    z
        .object({
            title: z.string().trim().min(1, { error: "Judul wajib diisi." }).max(255),

            author: z.string().trim().min(2, { error: "Penulis wajib diisi." }).max(255),

            publishedAt:
                z.string().trim().regex(/^\d{4}$/, { error: "Tahun terbit 4 digit, mis. 2015." }).optional(),

            publisher: z.string().trim().max(255).optional(),

            isbn: isbnSchema.optional(),

            category: z.string().trim().min(2, { error: "Genre wajib dipilih." }).max(100),
        })
        .strict();
