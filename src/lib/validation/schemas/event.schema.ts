import { z } from "zod";

import {
    publicationStatusValues,
} from "@/lib/db/schema";

import {
    communityIdParamSchema,
    eventIdParamSchema,
} from "../common";

import {
    descriptionSchema,
    titleSchema,
} from "../strings";

import {
    httpUrlSchema,
} from "../urls";

export const publicationStatusSchema =
    z.enum(
        publicationStatusValues,
    );

export const createEventSchema =
    z
        .object({
            communityId:
                z.uuid(),

            title:
                titleSchema,

            description:
                descriptionSchema,

            startsAt:
                z.coerce.date(),

            endsAt:
                z.coerce.date(),

            publicLocation:
                z
                    .string()
                    .trim()
                    .max(500)
                    .optional(),

            eventUrl:
                httpUrlSchema.optional(),

            publicationStatus:
                publicationStatusSchema
                    .default("DRAFT"),
        })
        .strict()
        .refine(
            (data) =>
                data.endsAt >
                data.startsAt,
            {
                error:
                    "Event end time must be after start time.",
                path: ["endsAt"],
            },
        );

export const updateEventSchema =
    z
        .object({
            title:
                titleSchema.optional(),

            description:
                descriptionSchema
                    .nullable()
                    .optional(),

            startsAt:
                z.coerce.date().optional(),

            endsAt:
                z.coerce.date().optional(),

            publicLocation:
                z
                    .string()
                    .trim()
                    .max(500)
                    .nullable()
                    .optional(),

            eventUrl:
                httpUrlSchema
                    .nullable()
                    .optional(),

            publicationStatus:
                publicationStatusSchema
                    .optional(),
        })
        .strict();

export const eventIdSchema =
    eventIdParamSchema;

export const communityEventPathSchema =
    communityIdParamSchema;