"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { REMEMBER_ME_COOKIE } from "@/lib/supabase/session-cookies";
import {
    signInSchema,
    signUpSchema,
    type SignInInput,
    type SignUpInput,
} from "@/lib/validation/auth";

type AuthActionResult<Field extends string> =
    | { success: true; redirectTo?: string }
    | {
          success: false;
          fieldErrors?: Partial<Record<Field, string[]>>;
          message?: string;
      };

function signUpErrorMessage(error: { code?: string; message: string }) {
    const message = error.message.toLowerCase();

    if (
        error.code === "email_exists" ||
        error.code === "user_already_exists" ||
        message.includes("already registered")
    ) {
        return "Email ini sudah terdaftar. Silakan masuk atau gunakan email lain.";
    }
    if (error.code === "over_email_send_rate_limit" || message.includes("rate limit")) {
        return "Terlalu banyak permintaan email. Tunggu sebentar lalu coba lagi.";
    }
    if (error.code === "signup_disabled" || message.includes("signups not allowed")) {
        return "Pendaftaran email sedang dinonaktifkan di konfigurasi Supabase.";
    }
    if (message.includes("database error saving new user")) {
        return "Supabase gagal menyimpan akun baru. Periksa trigger dan tabel profil di database.";
    }
    if (message.includes("email address is invalid")) {
        return "Alamat email tidak dapat digunakan. Periksa kembali alamat emailmu.";
    }
    if (error.code === "weak_password" || message.includes("password should")) {
        return "Kata sandi belum memenuhi persyaratan keamanan.";
    }

    return error.message;
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
        const origin = (await headers()).get("origin");
        const emailRedirectTo = origin
            ? new URL("/auth/callback", origin).toString()
            : undefined;

        const { data: signUpData, error } = await supabase.auth.signUp({
            email: parsed.data.email.trim(),
            password: parsed.data.password,
            options: {
                data: { display_name: parsed.data.name.trim() },
                emailRedirectTo,
            },
        });

        if (error) {
            return { success: false, message: signUpErrorMessage(error) };
        }

        return {
            success: true,
            redirectTo: signUpData.session ? "/" : "/verify-email",
        };
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

        if (error) return { success: false, message: error.message };

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
    const parsed = z.email().safeParse(email.trim());
    if (!parsed.success) {
        return {
            success: false,
            fieldErrors: { email: ["Masukkan alamat email yang valid."] },
        };
    }

    try {
        const supabase = await createClient();
        const origin = (await headers()).get("origin");
        const redirectTo = origin
            ? new URL("/auth/callback?next=/update-password", origin).toString()
            : undefined;
        const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
            redirectTo,
        });

        if (error) {
            return {
                success: false,
                message: "Email reset kata sandi belum dapat dikirim. Tunggu sebentar lalu coba lagi.",
            };
        }

        // Keep the response generic so the form does not reveal whether an email has an account.
        return { success: true };
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
    const parsed = z.string().min(8, "Kata sandi minimal 8 karakter.").safeParse(password);
    if (!parsed.success) {
        return {
            success: false,
            fieldErrors: { password: [parsed.error.issues[0]?.message ?? "Kata sandi tidak valid."] },
        };
    }

    try {
        const supabase = await createClient();
        const { error } = await supabase.auth.updateUser({ password: parsed.data });
        if (error) {
            return {
                success: false,
                message: "Kata sandi belum dapat diperbarui. Minta tautan reset yang baru lalu coba lagi.",
            };
        }
        return { success: true };
    } catch {
        return {
            success: false,
            message: "Kata sandi belum dapat diperbarui. Minta tautan reset yang baru lalu coba lagi.",
        };
    }
}

export async function signOut() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    const cookieStore = await cookies();
    cookieStore.delete(REMEMBER_ME_COOKIE);
    redirect("/auth");
}
