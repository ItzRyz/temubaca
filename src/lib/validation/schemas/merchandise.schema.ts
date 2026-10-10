import { z } from "zod";

import {
    listingAvailabilityValues,
    merchandiseStatusValues,
} from "@/lib/db/schema";

import {
    communityIdParamSchema,
    merchandiseIdParamSchema,
} from "../common";

import {
    descriptionSchema,
    titleSchema,
    currencyCodeSchema,
} from "../strings";

import {
    moneySchema,
} from "../numbers";

export const merchandiseAvailabilitySchema =
    z.enum(
        listingAvailabilityValues,
    );

export const merchandiseStatusSchema =
    z.enum(
        merchandiseStatusValues,
    );

const merchandiseFields = {
            communityId:
                z.uuid(),

            title:
                titleSchema,

            description:
                descriptionSchema,

            priceAmount:
                moneySchema.optional(),

            currency:
                currencyCodeSchema.optional(),

            priceNote:
                z
                    .string()
                    .trim()
                    .max(500)
                    .optional(),

            availability:
                merchandiseAvailabilitySchema
                    .default("AVAILABLE"),

            imageReference:
                z
                    .string()
                    .trim()
                    .max(2_048)
                    .optional(),

            status:
                merchandiseStatusSchema
                    .default("DRAFT"),
        };

export const createMerchandiseSchema =
    z
        .object(merchandiseFields)
        .strict()
        .superRefine(
            (data, ctx) => {
                if (
                    data.priceAmount !==
                    undefined &&
                    !data.currency
                ) {
                    ctx.addIssue({
                        code: "custom",
                        path: ["currency"],
                        message:
                            "Currency is required when price is provided.",
                    });
                }

                if (
                    data.currency &&
                    data.priceAmount ===
                    undefined
                ) {
                    ctx.addIssue({
                        code: "custom",
                        path: ["priceAmount"],
                        message:
                            "Price amount is required when currency is provided.",
                    });
                }
            },
        );

export const updateMerchandiseSchema =
    z
        .object(merchandiseFields)
        .omit({
            communityId: true,
        })
        .partial()
        .strict()
        .superRefine((data, ctx) => {
            if (
                data.priceAmount !== undefined &&
                data.currency === undefined
            ) {
                ctx.addIssue({
                    code: "custom",
                    path: ["currency"],
                    message: "Currency is required when updating price.",
                });
            }

            if (
                data.currency !== undefined &&
                data.priceAmount === undefined
            ) {
                ctx.addIssue({
                    code: "custom",
                    path: ["priceAmount"],
                    message: "Price amount is required when updating currency.",
                });
            }
        });

export const merchandiseIdSchema =
    merchandiseIdParamSchema;

export const communityMerchandisePathSchema =
    communityIdParamSchema;
