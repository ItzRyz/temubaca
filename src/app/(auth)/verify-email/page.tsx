import { MailWarning } from "lucide-react";
import Link from "next/link";

import { AuthLayout, AuthPanel, authPrimaryButtonClass } from "@/features/auth/components/auth-layout";
import { OtpVerificationCard } from "@/features/auth/components/OtpVerificationCard";
import { readPendingOtp, secondsUntilResend } from "@/features/auth/pending-otp";

type VerifyEmailPageProps = {
    searchParams: Promise<{ error?: string }>;
};

const layoutCopy = {
    title: "Verifikasi Kode Keamanan",
    description: "Kami mengirimkan 6 digit kode ke email kamu untuk memastikan rak buku dan jejak interaksi wargamu tetap aman.",
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
    const [{ error }, pending] = await Promise.all([searchParams, readPendingOtp()]);

    if (pending && !error) {
        return (
            <AuthLayout {...layoutCopy}>
                <OtpVerificationCard
                    email={pending.email}
                    purpose={pending.purpose}
                    initialResendIn={secondsUntilResend(pending)}
                />
            </AuthLayout>
        );
    }

    // No pending code: the session expired, or an older email link failed in /auth/callback.
    return (
        <AuthLayout {...layoutCopy}>
            <AuthPanel className="items-center text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <MailWarning aria-hidden="true" className="size-4" />
                </span>
                <h2 className="mt-3 font-heading text-xl leading-[30px] font-semibold text-[#1f2924]">
                    {error ? "Tautan verifikasi tidak berlaku" : "Tidak ada kode yang menunggu"}
                </h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    {error
                        ? "Tautan mungkin sudah digunakan atau kedaluwarsa. Masuk jika akunmu sudah aktif, atau minta kode baru."
                        : "Sesi verifikasi sudah berakhir. Daftar kembali atau minta kode atur ulang kata sandi yang baru."}
                </p>
                <Link href="/login" className={`${authPrimaryButtonClass} mt-6`}>Kembali ke halaman masuk</Link>
                <Link href="/forgot-password" className="mt-4 text-[13px] font-semibold text-primary hover:underline">Lupa kata sandi?</Link>
            </AuthPanel>
        </AuthLayout>
    );
}
