import { Ban, ChevronRight, CircleCheck, Clock, Plus, UsersRound, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MAX_PENDING_APPLICATIONS } from "@/features/community-management/rules";
import { getCurrentUser } from "@/lib/auth";
import { listManagedCommunities } from "@/lib/db/queries/community-management";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Komunitas saya" };

const status = {
    VERIFIED: { label: "Terverifikasi", icon: CircleCheck, className: "bg-[#c9ecd6] text-primary" },
    PENDING: { label: "Menunggu Verifikasi", icon: Clock, className: "bg-[#fbecc4] text-[#5c3d00]" },
    REJECTED: { label: "Ditolak", icon: XCircle, className: "bg-destructive/10 text-destructive" },
    SUSPENDED: { label: "Ditangguhkan", icon: Ban, className: "bg-destructive/10 text-destructive" },
} as const;

/** Communities the reader owns or helps manage, with the entry point to apply for a new one. */
export default async function MyCommunitiesPage() {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    const communities = await listManagedCommunities(user.id);
    const pending = communities.filter((item) => item.role === "owner" && item.status === "PENDING").length;
    const canApply = pending < MAX_PENDING_APPLICATIONS;

    return (
        <main className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6 sm:py-10">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="font-heading text-[32px] leading-tight font-semibold text-primary">Komunitas Saya</h1>
                    <p className="mt-1 text-muted-foreground">Komunitas yang Anda kelola sebagai pemilik atau pengurus.</p>
                </div>
                {canApply ? (
                    <Link href="/communities/new" className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                        <Plus aria-hidden="true" className="size-4" /> Ajukan Komunitas
                    </Link>
                ) : (
                    <p className="max-w-xs text-sm text-muted-foreground">Anda sudah punya {MAX_PENDING_APPLICATIONS} pengajuan yang menunggu. Ajukan lagi setelah salah satunya ditinjau.</p>
                )}
            </header>

            {communities.length === 0 ? (
                <section className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
                    <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-xl bg-[#e7efe8] text-primary"><UsersRound className="size-5" /></span>
                    <h2 className="mt-3 font-heading text-lg font-semibold">Belum ada komunitas</h2>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">Ajukan komunitas literasi Anda. Tim TemuBaca meninjau bukti aktivitas sebelum profilnya tampil untuk umum. Bila Anda diundang sebagai pengurus, buka tautan undangannya.</p>
                </section>
            ) : (
                <ul className="mt-8 flex list-none flex-col gap-3 p-0">
                    {communities.map((community) => {
                        const badge = status[community.status as keyof typeof status];
                        const Icon = badge.icon;
                        return (
                            <li key={community.id}>
                                <Link href={`/communities/${community.id}/manage`} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 hover:bg-muted/50">
                                    <div className="min-w-0 flex-1">
                                        <p className="flex flex-wrap items-center gap-2">
                                            <span className="font-heading text-lg font-semibold">{community.name}</span>
                                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", badge.className)}><Icon aria-hidden="true" className="size-3.5" /> {badge.label}</span>
                                        </p>
                                        <p className="text-sm text-muted-foreground">{community.role === "owner" ? "Pemilik" : "Pengurus"}{community.publicLocation ? ` • ${community.publicLocation}` : ""}</p>
                                    </div>
                                    <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </main>
    );
}
