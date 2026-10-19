"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/env";
import { createClient } from "@/lib/supabase/server";
import { REMEMBER_ME_COOKIE } from "@/lib/supabase/session-cookies";
import {
    signInSchema,
    signUpSchema,
    type SignInInput,
    type SignUpInput,
} from "@/lib/validation/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
    forgotPasswordSchema,
    otpTokenSchema,
    resetPasswordSchema,
} from "@/lib/validation/schemas/auth.schema";

import {
    clearPendingOtp,
    readPendingOtp,
    secondsUntilResend,
    writePendingOtp,
} from "./pending-otp";

type AuthActionResult<Field extends string> =
    | { success: true; redirectTo?: string }
    | {
          success: false;
          fieldErrors?: Partial<Record<Field, string[]>>;
          message?: string;
      };

function signUpErrorMessage(error: { code?: string }) {
    if (error.code === "over_email_send_rate_limit") {
        return "Terlalu banyak permintaan email. Tunggu sebentar lalu coba lagi.";
    }
    if (error.code === "signup_disabled") {
        return "Pendaftaran belum tersedia saat ini.";
    }
    if (error.code === "email_address_invalid") {
        return "Alamat email tidak dapat digunakan. Periksa kembali alamat emailmu.";
    }
    if (error.code === "weak_password") {
        return "Kata sandi belum memenuhi persyaratan keamanan.";
    }

    // Provider errors may contain account-existence or infrastructure details.
    return "Pendaftaran belum dapat diproses. Periksa kembali data atau coba lagi nanti.";
}

export async function signUp(
    data: SignUpInput,
): Promise<AuthActionResult<keyof SignUpInput>> {
    const parsed = signUpSchema.safeParse(data);
    if (!parsed.success) {
        const errors = z.flattenError(parsed.error);
        return {
            success: false,
            fieldErrors: errors.fieldErrors,
            message: errors.formErrors[0],
        };
    }

    try {
        const supabase = await createClient();
        const emailRedirectTo = new URL(
            "/auth/callback",
            env.NEXT_PUBLIC_APP_URL,
        ).toString();

        const { data: signUpData, error } = await supabase.auth.signUp({
            email: parsed.data.email.trim(),
            password: parsed.data.password,
            options: {
                // When the reader confirmed the minimum age (DEC-09); a consent record, never used for access.
                data: { display_name: parsed.data.name.trim(), age_confirmed_at: new Date().toISOString() },
                emailRedirectTo,
            },
        });

        if (error) {
            return { success: false, message: signUpErrorMessage(error) };
        }

        if (signUpData.session) {
            return { success: true, redirectTo: "/" };
        }

        await writePendingOtp(parsed.data.email, "signup");
        return { success: true, redirectTo: "/verify-email" };
    } catch {
        return {
            success: false,
            message: "Pendaftaran belum dapat diproses. Periksa koneksi dan konfigurasi Supabase, lalu coba lagi.",
        };
    }
}

export async function signIn(
    data: SignInInput,
    rememberMe: boolean,
): Promise<AuthActionResult<keyof SignInInput>> {
    const parsed = signInSchema.safeParse(data);
    if (!parsed.success) {
        const errors = z.flattenError(parsed.error);
        return {
            success: false,
            fieldErrors: errors.fieldErrors,
            message: errors.formErrors[0],
        };
    }

    try {
        const supabase = await createClient({ rememberMe });
        const { error } = await supabase.auth.signInWithPassword({
            email: parsed.data.email.trim(),
            password: parsed.data.password,
        });

        if (error) {
            if ((error.status ?? 0) >= 500) {
                return { success: false, message: "Masuk belum dapat diproses saat ini. Coba lagi nanti." };
            }
            // Shown under the password field (Figma 87:611). Wording stays generic so it never
            // reveals whether the email has an account.
            return {
                success: false,
                fieldErrors: { password: ["Email atau kata sandi salah. Periksa lagi atau atur ulang kata sandi."] },
            };
        }

        const cookieStore = await cookies();
        cookieStore.set(REMEMBER_ME_COOKIE, rememberMe ? "persistent" : "session", {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            ...(rememberMe ? { maxAge: 400 * 24 * 60 * 60 } : {}),
        });

        return { success: true };
    } catch {
        return {
            success: false,
            message: "Tidak dapat masuk saat ini. Periksa koneksi dan konfigurasi Supabase, lalu coba lagi.",
        };
    }
}

export async function requestPasswordReset(
    email: string,
): Promise<AuthActionResult<"email">> {
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
        const errors = z.flattenError(parsed.error);
        return {
            success: false,
            fieldErrors: { email: errors.fieldErrors.email ?? ["Masukkan alamat email yang valid."] },
        };
    }

    try {
        const supabase = await createClient();
        const redirectTo = new URL(
            "/auth/callback?next=/update-password",
            env.NEXT_PUBLIC_APP_URL,
        ).toString();
        const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
            redirectTo,
        });

        if (error) {
            return {
                success: false,
                message: "Email reset kata sandi belum dapat dikirim. Tunggu sebentar lalu coba lagi.",
            };
        }

        // Always continue to the code step so the form does not reveal whether an email has an account.
        await writePendingOtp(parsed.data.email, "recovery");
        return { success: true, redirectTo: "/verify-email" };
    } catch {
        return {
            success: false,
            message: "Permintaan reset kata sandi gagal. Periksa koneksi dan konfigurasi Supabase.",
        };
    }
}

export async function updatePassword(
    password: string,
): Promise<AuthActionResult<"password">> {
    const parsed = resetPasswordSchema.safeParse({ password });
    if (!parsed.success) {
        const errors = z.flattenError(parsed.error);
        return {
            success: false,
            fieldErrors: { password: errors.fieldErrors.password ?? ["Kata sandi tidak valid."] },
        };
    }

    try {
        const supabase = await createClient();
        const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
        if (error) {
            return {
                success: false,
                message: "Kata sandi belum dapat diperbarui. Minta kode reset yang baru lalu coba lagi.",
            };
        }
        return { success: true };
    } catch {
        return {
            success: false,
            message: "Kata sandi belum dapat diperbarui. Minta kode reset yang baru lalu coba lagi.",
        };
    }
}

const OTP_EXPIRED_MESSAGE = "Sesi verifikasi sudah berakhir. Mulai lagi dari halaman daftar atau lupa kata sandi.";

export async function verifyEmailOtp(
    token: string,
): Promise<AuthActionResult<"token">> {
    const parsed = otpTokenSchema.safeParse(token);
    if (!parsed.success) {
        return { success: false, fieldErrors: { token: [parsed.error.issues[0]?.message ?? "Kode tidak valid."] } };
    }

    const pending = await readPendingOtp();
    if (!pending) {
        return { success: false, message: OTP_EXPIRED_MESSAGE };
    }

    try {
        const rateLimit = await enforceRateLimit(`otp-verify:${pending.email}`, 10, 10 * 60);
        if (!rateLimit.success) {
            return { success: false, message: "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi." };
        }

        const supabase = await createClient();
        const { error } = await supabase.auth.verifyOtp({
            email: pending.email,
            token: parsed.data,
            type: pending.purpose === "signup" ? "email" : "recovery",
        });

        if (error) {
            return {
                success: false,
                fieldErrors: (error.status ?? 0) >= 500
                    ? undefined
                    : { token: ["Kode salah atau sudah kedaluwarsa. Periksa lagi atau kirim ulang kode."] },
                message: (error.status ?? 0) >= 500
                    ? "Verifikasi belum dapat diproses saat ini. Coba lagi nanti."
                    : undefined,
            };
        }
    } catch {
        return { success: false, message: "Verifikasi belum dapat diproses. Periksa koneksi lalu coba lagi." };
    }

    await clearPendingOtp();
    return { success: true, redirectTo: pending.purpose === "signup" ? "/" : "/update-password" };
}

export async function resendEmailOtp(): Promise<AuthActionResult<never> & { retryAfter?: number }> {
    const pending = await readPendingOtp();
    if (!pending) {
        return { success: false, message: OTP_EXPIRED_MESSAGE };
    }

    const wait = secondsUntilResend(pending);
    if (wait > 0) {
        return { success: false, message: `Tunggu ${wait} detik sebelum mengirim ulang kode.`, retryAfter: wait };
    }

    try {
        const supabase = await createClient();
        const { error } = pending.purpose === "signup"
            ? await supabase.auth.resend({ type: "signup", email: pending.email })
            : await supabase.auth.resetPasswordForEmail(pending.email);

        if (error) {
            return {
                success: false,
                message: error.code === "over_email_send_rate_limit"
                    ? "Terlalu banyak permintaan email. Tunggu sebentar lalu coba lagi."
                    : "Kode belum dapat dikirim ulang. Coba lagi nanti.",
            };
        }
    } catch {
        return { success: false, message: "Kode belum dapat dikirim ulang. Periksa koneksi lalu coba lagi." };
    }

    await writePendingOtp(pending.email, pending.purpose);
    return { success: true };
}

export async function cancelEmailOtp(): Promise<void> {
    await clearPendingOtp();
}

export async function signOut() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    const cookieStore = await cookies();
    cookieStore.delete(REMEMBER_ME_COOKIE);
    redirect("/login");
}
