import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/features/auth/actions";
import { AuthLayout, AuthPanel } from "@/features/auth/components/auth-layout";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Keluar akun" };

function initialsOf(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "TB";
}

/** Sign-out confirmation (Figma "Keluar Akun" 58:21897). */
export default async function LogoutPage() {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    // The signed-in user's own email, read from their session; never another account's.
    const { data } = await (await createClient()).auth.getUser();
    const email = data.user?.email ?? null;

    return (
        <AuthLayout
            title="Terima Kasih Telah Bersua Hari Ini"
            description="Setiap buku yang kamu bagikan atau baca menyalakan percakapan baru di ruang publik warga. Sampai jumpa di lingkar berikutnya!"
        >
            <AuthPanel className="items-stretch text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <LogOut aria-hidden="true" className="size-5" />
                </span>
                <h2 className="mt-3 font-heading text-xl leading-[30px] font-semibold text-[#1f2924]">Yakin Ingin Keluar?</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Kamu perlu masuk kembali untuk mengelola buku, bookmark, dan komunitasmu.
                </p>

                <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-[#fcfbf7] p-3 text-left">
                    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{initialsOf(user.displayName)}</span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{user.displayName}</span>
                        {email && <span className="block truncate text-xs text-muted-foreground">{email}</span>}
                    </span>
                    <span className={user.suspendedAt
                        ? "shrink-0 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive"
                        : "shrink-0 rounded-full bg-[#e7efe8] px-2.5 py-0.5 text-xs font-semibold text-primary"}>
                        {user.suspendedAt ? "Ditangguhkan" : "Warga Aktif"}
                    </span>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <form action={signOut}>
                        <button type="submit" className="flex h-11 w-full items-center justify-center rounded-lg bg-destructive px-4 text-sm font-semibold text-white hover:bg-destructive/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                            Keluar
                        </button>
                    </form>
                    <Link href="/dashboard" className="flex h-11 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
                        Tetap Masuk
                    </Link>
                </div>
                <p className="mt-6 text-xs text-muted-foreground">Bookmark, listing, dan data akunmu tetap tersimpan setelah keluar.</p>
            </AuthPanel>
        </AuthLayout>
    );
}
