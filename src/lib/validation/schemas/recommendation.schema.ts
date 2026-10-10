import { z } from "zod";

import {
    targetTypeValues,
} from "@/lib/db/schema";

import {
    paginationSchema,
} from "../pagination";

import {
    scoreSchema,
} from "../numbers";

export const recommendationTargetTypeSchema =
    z.enum(
        targetTypeValues,
    );

export const recommendationQuerySchema =
    paginationSchema
        .extend({
            targetType:
                recommendationTargetTypeSchema
                    .optional(),
        })
        .strict();

export const recommendationSchema =
    z
        .object({
            targetType:
                recommendationTargetTypeSchema,

            targetId:
                z.uuid(),

            score:
                scoreSchema.optional(),

            reason:
                z
                    .string()
                    .trim()
                    .max(2_000)
                    .optional(),

            modelVersion:
                z
                    .string()
                    .trim()
                    .max(100)
                    .optional(),
        })
        .strict();