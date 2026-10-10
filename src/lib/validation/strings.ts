import { z } from "zod";

export const requiredString = (
    field = "Value",
) =>
    z
        .string({
            error: `${field} must be a string.`,
        })
        .trim()
        .min(1, {
            error: `${field} is required.`,
        });

export const optionalString = z
    .string()
    .trim()
    .optional();

export const nullableString = z
    .string()
    .trim()
    .nullable();

export const displayNameSchema =
    requiredString("Display name")
        .min(2, {
            error:
                "Display name must contain at least 2 characters.",
        })
        .max(100, {
            error:
                "Display name must not exceed 100 characters.",
        });

export const titleSchema =
    requiredString("Title")
        .min(1)
        .max(255);

export const descriptionSchema =
    z
        .string()
        .trim()
        .max(10_000, {
            error:
                "Description must not exceed 10,000 characters.",
        })
        .optional();

export const noteSchema =
    z
        .string()
        .trim()
        .max(5_000, {
            error:
                "Note must not exceed 5,000 characters.",
        })
        .optional();

export const reasonSchema =
    requiredString("Reason")
        .min(3)
        .max(500);

export const detailsSchema =
    z
        .string()
        .trim()
        .max(10_000)
        .optional();

export const isbnSchema = z
    .string()
    .trim()
    .transform((value) =>
        value.replace(/[-\s]/g, ""),
    )
    .refine(
        (value) =>
            /^(?:\d{9}[\dX]|\d{13})$/.test(
                value,
            ),
        {
            error:
                "Invalid ISBN format.",
        },
    );

export const languageSchema =
    z
        .string()
        .trim()
        .min(2)
        .max(20);

export const currencyCodeSchema =
    z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{3}$/, {
            error:
                "Currency must be a valid 3-letter code.",
        });

export const slugSchema =
    z
        .string()
        .trim()
        .toLowerCase()
        .regex(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            {
                error:
                    "Invalid slug format.",
            },
        )
        .max(100);