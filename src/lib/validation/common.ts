import { z } from "zod";

import {
    descriptionSchema,
    displayNameSchema,
    noteSchema,
    titleSchema,
} from "./strings";

import {
    latitudeSchema,
    longitudeSchema,
} from "./numbers";

export const uuidSchema =
    z.uuid({
        error: "Invalid ID format.",
    });

export const idParamSchema =
    z.object({
        id: uuidSchema,
    });

export const bookIdParamSchema =
    z.object({
        bookId: uuidSchema,
    });

export const communityIdParamSchema =
    z.object({
        communityId: uuidSchema,
    });

export const listingIdParamSchema =
    z.object({
        listingId: uuidSchema,
    });

export const requestIdParamSchema =
    z.object({
        requestId: uuidSchema,
    });

export const eventIdParamSchema =
    z.object({
        eventId: uuidSchema,
    });

export const merchandiseIdParamSchema =
    z.object({
        merchandiseId: uuidSchema,
    });

export const userIdParamSchema =
    z.object({
        userId: uuidSchema,
    });

export const publicLocationSchema =
    z
        .string()
        .trim()
        .max(500)
        .optional();

export const coordinatesSchema =
    z
        .object({
            latitude: latitudeSchema,
            longitude: longitudeSchema,
        })
        .strict();

export const preferencesSchema =
    z
        .record(
            z.string().max(100),
            z.unknown(),
        )
        .refine(
            (value) =>
                Object.keys(value).length <= 50,
            {
                error:
                    "Too many preference entries.",
            },
        );

export const profileUpdateSchema =
    z
        .object({
            displayName:
                displayNameSchema.optional(),

            preferences:
                preferencesSchema.optional(),
        })
        .strict();

export const textEntitySchema =
    z
        .object({
            title: titleSchema,

            description:
                descriptionSchema,

            note: noteSchema,
        })
        .strict();