import { z } from "zod";

import {
    communityStatusValues,
    membershipRoleValues,
    membershipStatusValues,
} from "@/lib/db/schema";

import {
    communityIdParamSchema,
} from "../common";

import {
    descriptionSchema,
    displayNameSchema,
} from "../strings";

import {
    paginationSchema,
} from "../pagination";

export const communityStatusSchema =
    z.enum(
        communityStatusValues,
    );

export const membershipRoleSchema =
    z.enum(
        membershipRoleValues,
    );

export const membershipStatusSchema =
    z.enum(
        membershipStatusValues,
    );

export const communitySearchSchema =
    paginationSchema
        .extend({
            q: z
                .string()
                .trim()
                .max(200)
                .optional(),
        })
        .strict();

export const createCommunitySchema =
    z
        .object({
            name:
                displayNameSchema
                    .max(255),

            description:
                descriptionSchema,

            publicLocation:
                z
                    .string()
                    .trim()
                    .max(500)
                    .optional(),
        })
        .strict();

export const updateCommunitySchema =
    z
        .object({
            name:
                displayNameSchema
                    .max(255)
                    .optional(),

            description:
                descriptionSchema.nullable(),

            publicLocation:
                z
                    .string()
                    .trim()
                    .max(500)
                    .nullable()
                    .optional(),
        })
        .strict();

export const communityIdSchema =
    communityIdParamSchema;

export const membershipCreateSchema =
    z
        .object({
            userId:
                z.uuid(),

            role:
                membershipRoleSchema
                    .default("MEMBER"),
        })
        .strict();

export const membershipUpdateSchema =
    z
        .object({
            role:
                membershipRoleSchema.optional(),

            status:
                membershipStatusSchema
                    .optional(),
        })
        .strict();