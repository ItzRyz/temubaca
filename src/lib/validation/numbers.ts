import { z } from "zod";

export const positiveIntegerSchema =
    z.coerce
        .number()
        .int()
        .positive();

export const nonNegativeIntegerSchema =
    z.coerce
        .number()
        .int()
        .nonnegative();

export const percentageSchema =
    z
        .number()
        .min(0)
        .max(100);

export const scoreSchema =
    z
        .number()
        .finite();

export const moneySchema =
    z
        .number()
        .finite()
        .nonnegative()
        .multipleOf(0.01);

export const latitudeSchema =
    z
        .number()
        .finite()
        .min(-90)
        .max(90);

export const longitudeSchema =
    z
        .number()
        .finite()
        .min(-180)
        .max(180);

export const limitedInteger = (
    min: number,
    max: number,
) =>
    z.coerce
        .number()
        .int()
        .min(min)
        .max(max);