import { z } from "zod";

import {
    targetTypeValues,
    verificationStatusValues,
} from "@/lib/db/schema";

import {
    paginationSchema,
} from "../pagination";

export const verificationTargetTypeSchema =
    z.enum(
        targetTypeValues,
    );

export const verificationStatusSchema =
    z.enum(
        verificationStatusValues,
    );

export const createVerificationSchema =
    z
        .object({
            targetType:
                verificationTargetTypeSchema,

            targetId:
                z.uuid(),

            note:
                z
                    .string()
                    .trim()
                    .max(10_000)
                    .optional(),
        })
        .strict();

export const updateVerificationSchema =
    z
        .object({
            status:
                verificationStatusSchema,

            note:
                z
                    .string()
                    .trim()
                    .max(10_000)
                    .optional(),
        })
        .strict();

export const verificationListQuerySchema =
    paginationSchema
        .extend({
            status:
                verificationStatusSchema
                    .optional(),

            targetType:
                verificationTargetTypeSchema
                    .optional(),
        })
        .strict();