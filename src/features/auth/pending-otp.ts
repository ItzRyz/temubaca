import "server-only";

import { cookies } from "next/headers";

import {
    OTP_RESEND_COOLDOWN_SECONDS,
    pendingOtpSchema,
    type PendingOtp,
    type PendingOtpPurpose,
} from "@/lib/validation/schemas/auth.schema";

/**
 * Holds the email awaiting a 6-digit code so it never travels in the URL.
 * Tampering only changes which address the user tries to verify; the code
 * itself is checked by Supabase.
 */
export const PENDING_OTP_COOKIE = "tb-otp-pending";

/** Matches Supabase's default email OTP expiry. */
const PENDING_OTP_MAX_AGE_SECONDS = 60 * 60;

export async function readPendingOtp(): Promise<PendingOtp | null> {
    const raw = (await cookies()).get(PENDING_OTP_COOKIE)?.value;
    if (!raw) return null;

    try {
        const parsed = pendingOtpSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : null;
    } catch {
        return null;
    }
}

export async function writePendingOtp(email: string, purpose: PendingOtpPurpose) {
    const value: PendingOtp = { email, purpose, sentAt: Date.now() };
    (await cookies()).set(PENDING_OTP_COOKIE, JSON.stringify(value), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: PENDING_OTP_MAX_AGE_SECONDS,
    });
}

export async function clearPendingOtp() {
    (await cookies()).delete(PENDING_OTP_COOKIE);
}

export function secondsUntilResend(pending: PendingOtp, now = Date.now()) {
    const elapsed = Math.floor((now - pending.sentAt) / 1000);
    return Math.max(0, OTP_RESEND_COOLDOWN_SECONDS - elapsed);
}
