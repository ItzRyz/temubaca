import { MailCheck, MailWarning } from "lucide-react";
import Link from "next/link";

import { AuthLayout, AuthPanel, authPrimaryButtonClass } from "@/features/auth/components/auth-layout";

type VerifyEmailPageProps = {
    searchParams: Promise<{ error?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
    const { error } = await searchParams;
    const Icon = error ? MailWarning : MailCheck;

    return (
        <AuthLayout
            title="Satu Langkah Lagi"
            description="Kami perlu memastikan email ini milikmu sebelum akun TemuBaca aktif."
        >
            <AuthPanel className="items-center text-center">
                <span className={`flex size-10 items-center justify-center rounded-full ${error ? "bg-destructive/10 text-destructive" : "bg-[#e7efe8] text-primary"}`}>
                    <Icon aria-hidden="true" className="size-4" />
                </span>
                <h2 className="mt-3 font-heading text-xl leading-[30px] font-semibold text-[#1f2924]">
                    {error ? "Tautan verifikasi tidak berlaku" : "Periksa email kamu"}
                </h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[#6e7870]">
                    {error
                        ? "Tautan mungkin sudah digunakan atau kedaluwarsa. Coba daftar kembali atau masuk jika akunmu sudah aktif."
                        : "Buka email konfirmasi yang kami kirim untuk mengaktifkan akun. Periksa juga folder spam."}
                </p>
                <Link href="/login" className={`${authPrimaryButtonClass} mt-6`}>Kembali ke halaman masuk</Link>
            </AuthPanel>
        </AuthLayout>
    );
}
