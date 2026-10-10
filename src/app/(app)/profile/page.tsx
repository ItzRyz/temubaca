import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

export default async function ProfilePage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect("/login");
    }

    return (
        <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-12 sm:px-8 sm:py-16">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Profil pembaca</p>
            <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">Halo, {user.displayName}</h1>
            <p className="mt-3 text-sm text-muted-foreground">Kelola buku tersimpan dan salinan yang kamu tawarkan.</p>
            <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/dashboard" className="rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-muted">Dashboard</Link>
                <Link href="/bookmarks" className="rounded-xl border border-primary px-5 py-3 text-sm font-semibold text-primary hover:bg-primary/5">Buku tersimpan</Link>
                <Link href="/my-listings" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Listing saya</Link>
                <Link href="/settings" className="rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-muted">Pengaturan profil</Link>
                <Link href="/recommendations" className="rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-muted">Rekomendasi buku</Link>
                {user.role === "ADMIN" && <Link href="/moderation/reports" className="rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-muted">Tinjauan laporan</Link>}
            </div>
        </main>
    );
}
