import { z } from "zod";

import {
    reportStatusValues,
    targetTypeValues,
} from "@/lib/db/schema";

import {
    detailsSchema,
    reasonSchema,
} from "../strings";

import {
    paginationSchema,
} from "../pagination";

export const reportTargetTypeSchema =
    z.enum(
        targetTypeValues,
    );

export const reportStatusSchema =
    z.enum(
        reportStatusValues,
    );

export const reportIdParamSchema = z.object({ reportId: z.uuid() }).strict();

export const createReportSchema =
    z
        .object({
            targetType:
                reportTargetTypeSchema,

            targetId:
                z.uuid(),

            reason:
                reasonSchema,

            details:
                detailsSchema,
        })
        .strict();

export const updateReportSchema =
    z
        .object({
            status:
                reportStatusSchema,

            outcome:
                z
                    .string()
                    .trim()
                    .max(10_000)
                    .optional(),
        })
        .strict();

export const reportListQuerySchema =
    paginationSchema
        .extend({
            status:
                reportStatusSchema
                    .optional(),

            targetType:
                reportTargetTypeSchema
                    .optional(),
        })
        .strict();
