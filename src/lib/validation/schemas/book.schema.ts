import { z } from "zod";

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
