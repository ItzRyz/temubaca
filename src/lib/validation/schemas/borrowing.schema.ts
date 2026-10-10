import { z } from "zod";

import {
    borrowRequestStatusValues,
    borrowingStatusValues,
    bookAccessStatusValues,
} from "@/lib/db/schema";

import {
    listingIdParamSchema,
    requestIdParamSchema,
} from "../common";

import {
    noteSchema,
} from "../strings";

export const borrowRequestStatusSchema =
    z.enum(
        borrowRequestStatusValues,
    );

export const borrowingStatusSchema =
    z.enum(
        borrowingStatusValues,
    );

export const bookAccessStatusSchema =
    z.enum(
        bookAccessStatusValues,
    );

export const createBorrowRequestSchema =
    z
        .object({
            listingId:
                z.uuid(),

            note:
                noteSchema,
        })
        .strict();

export const updateBorrowRequestSchema =
    z
        .object({
            status:
                borrowRequestStatusSchema,

            note:
                noteSchema,
        })
        .strict();

export const borrowingListingIdSchema =
    listingIdParamSchema;

export const borrowingRequestIdSchema =
    requestIdParamSchema;

export const createBorrowingSchema =
    z
        .object({
            requestId:
                z.uuid(),

            handedOverAt:
                z.coerce.date()
                    .optional(),

            dueAt:
                z.coerce.date()
                    .optional(),

            note:
                noteSchema,
        })
        .strict()
        .refine(
            (data) =>
                !data.dueAt ||
                !data.handedOverAt ||
                data.dueAt >
                data.handedOverAt,
            {
                error:
                    "Due date must be after handover date.",
                path: ["dueAt"],
            },
        );

export const updateBorrowingSchema =
    z
        .object({
            status:
                borrowingStatusSchema,

            dueAt:
                z.coerce.date()
                    .nullable()
                    .optional(),

            note:
                noteSchema,
        })
        .strict();

export const createBookAccessSchema =
    z
        .object({
            requestId:
                z.uuid(),

            expiresAt:
                z.coerce.date()
                    .optional(),

            note:
                noteSchema,
        })
        .strict();

export const updateBookAccessSchema =
    z
        .object({
            status:
                bookAccessStatusSchema,

            expiresAt:
                z.coerce.date()
                    .nullable()
                    .optional(),

            note:
                noteSchema,
        })
        .strict();