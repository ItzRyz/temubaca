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
            password: passwordSchema,
        })
        .strict();
