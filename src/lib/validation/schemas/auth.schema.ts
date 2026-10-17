import { z } from "zod";

import {
    displayNameSchema,
} from "../strings";

export const emailSchema =
    z
        .string()
        .trim()
        .toLowerCase()
        .max(320, { error: "Email terlalu panjang." })
        .pipe(z.email({ error: "Format email belum benar." }));

export const passwordSchema =
    z
        .string()
        .min(8, {
            error:
                "Kata sandi minimal 8 karakter.",
        })
        .max(128, {
            error:
                "Kata sandi maksimal 128 karakter.",
        });

/**
 * Rules for passwords chosen at sign-up or reset, shared by the schema and
 * the on-screen checklist. Sign-in keeps the looser `passwordSchema` so
 * accounts created before these rules can still log in.
 */
export const newPasswordRules = [
    {
        id: "length",
        label: "Minimal 8 karakter",
        test: (value: string) => value.length >= 8 && value.length <= 128,
    },
    {
        id: "letter-and-digit",
        label: "Mengandung angka dan huruf",
        test: (value: string) => /\p{L}/u.test(value) && /\d/.test(value),
    },
] as const;

export const newPasswordSchema =
    passwordSchema
        .refine(newPasswordRules[1].test, {
            error:
                "Kata sandi harus mengandung angka dan huruf.",
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

            password: newPasswordSchema,

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

export const OTP_LENGTH = 6;

/** Matches Supabase's default minimum interval between auth emails per user. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

export const otpTokenSchema =
    z
        .string()
        .trim()
        .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), {
            error:
                `Kode harus ${OTP_LENGTH} digit angka.`,
        });

export const pendingOtpPurposeSchema =
    z.enum(["signup", "recovery"]);

export const pendingOtpSchema =
    z
        .object({
            email: emailSchema,

            purpose: pendingOtpPurposeSchema,

            sentAt: z.number().int().nonnegative(),
        })
        .strict();

export type PendingOtpPurpose = z.infer<typeof pendingOtpPurposeSchema>;
export type PendingOtp = z.infer<typeof pendingOtpSchema>;

export const resetPasswordSchema =
    z
        .object({
            password: newPasswordSchema,
        })
        .strict();
