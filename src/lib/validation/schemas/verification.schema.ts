import { z } from "zod";

import {
    targetTypeValues,
    verificationStatusValues,
} from "@/lib/db/schema";

import {
    paginationSchema,
} from "../pagination";

import {
    communityReviewDecisions,
    decisionRequiresNote,
} from "@/features/verification/community-review";

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

/** Admin decision on a community; rejecting or suspending needs a reason (TB-031). */
export const communityReviewSchema =
    z
        .object({
            decision:
                z.enum(communityReviewDecisions),

            note:
                z
                    .string()
                    .trim()
                    .max(2_000)
                    .optional(),
        })
        .strict()
        .refine(
            (input) => !decisionRequiresNote(input.decision) || (input.note?.length ?? 0) >= 3,
            { message: "Alasan wajib diisi untuk menolak atau menangguhkan komunitas.", path: ["note"] },
        );
