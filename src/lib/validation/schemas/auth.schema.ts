import { z } from "zod";

import {
    displayNameSchema,
} from "../strings";

export const emailSchema =
    z
        .string()
        .trim()
        .toLowerCase()
        .max(320)
        .pipe(z.email());

export const passwordSchema =
    z
        .string()
        .min(8, {
            error:
                "Password must contain at least 8 characters.",
        })
        .max(128, {
            error:
                "Password must not exceed 128 characters.",
        });

export const signInSchema =
    z
        .object({
            email: emailSchema,

            password: passwordSchema,
        })
        .strict();

export const signUpSchema =
    z
        .object({
            email: emailSchema,

            password: passwordSchema,

            displayName:
                displayNameSchema,
        })
        .strict();

export const forgotPasswordSchema =
    z
        .object({
            email: emailSchema,
        })
        .strict();

export const resetPasswordSchema =
    z
        .object({
            password: passwordSchema,
        })
        .strict();
