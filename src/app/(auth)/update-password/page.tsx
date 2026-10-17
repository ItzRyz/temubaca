import { TimerOff } from "lucide-react";
import Link from "next/link";

import { AuthLayout, AuthPanel, authPrimaryButtonClass } from "@/features/auth/components/auth-layout";
import { UpdatePasswordCard } from "@/features/auth/components/PasswordRecoveryCard";
import { isAuthenticated } from "@/lib/auth";

export default async function UpdatePasswordPage() {
    const signedIn = await isAuthenticated();

    return (
        <AuthLayout
            title="Perbarui Kunci Masukmu"
            description="Buat kata sandi baru yang kuat agar akunmu tetap aman saat berbagi buku di titik temu."
        >
            {signedIn ? (
                <UpdatePasswordCard />
            ) : (
                <AuthPanel className="items-center text-center">
                    <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <TimerOff aria-hidden="true" className="size-4" />
                    </span>
                    <h2 className="mt-3 font-heading text-xl leading-[30px] font-semibold text-[#1f2924]">Sesi atur ulang berakhir</h2>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                        Minta kode verifikasi baru untuk membuat kata sandi baru.
                    </p>
                    <Link href="/forgot-password" className={`${authPrimaryButtonClass} mt-6`}>Minta kode baru</Link>
                    <Link href="/login" className="mt-4 text-[13px] text-muted-foreground hover:text-foreground">Kembali ke halaman masuk</Link>
                </AuthPanel>
            )}
        </AuthLayout>
    );
}
