import { Ban, CircleCheck, Clock, ExternalLink, XCircle } from "lucide-react";
import Link from "next/link";

import { ManageNav } from "@/features/community-management/components/manage-nav";
import { loadManageContext } from "@/features/community-management/server";
import { cn } from "@/lib/utils";

const statusBadge = {
    VERIFIED: { label: "Terverifikasi", icon: CircleCheck, className: "bg-[#c9ecd6] text-primary" },
    PENDING: { label: "Menunggu Verifikasi", icon: Clock, className: "bg-[#fbecc4] text-[#5c3d00]" },
    REJECTED: { label: "Ditolak", icon: XCircle, className: "bg-destructive/10 text-destructive" },
    SUSPENDED: { label: "Ditangguhkan", icon: Ban, className: "bg-destructive/10 text-destructive" },
} as const;

/** Figma "Kelola Komunitas" (25:5622) shell: breadcrumb, status badge, side menu. */
export default async function ManageCommunityLayout({ children, params }: LayoutProps<"/communities/[communityId]/manage">) {
    const { communityId } = await params;
    const { community, role, status, can, counts } = await loadManageContext(communityId);
    const badge = statusBadge[status];
    const BadgeIcon = badge.icon;

    return (
        <main className="mx-auto w-full max-w-[1256px] px-4 py-6 sm:px-6 sm:py-8">
            <nav aria-label="Breadcrumb" className="text-[13px] text-muted-foreground">
                <ol className="flex list-none flex-wrap items-center gap-1 p-0">
                    <li><Link href="/communities/mine" className="hover:text-foreground">Komunitas Saya</Link></li>
                    <li aria-hidden="true">/</li>
                    <li className="max-w-60 truncate">{community.name}</li>
                    <li aria-hidden="true">/</li>
                    <li aria-current="page" className="font-semibold text-foreground">Kelola</li>
                </ol>
            </nav>
            <header className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", badge.className)}>
                        <BadgeIcon aria-hidden="true" className="size-3.5" /> {badge.label}
                    </span>
                    <h1 className="mt-2 font-heading text-[32px] leading-tight font-semibold text-primary">Kelola Komunitas</h1>
                    <p className="mt-1 text-muted-foreground">
                        {role === "owner" ? "Perbarui profil publik, kelola acara dan merchandise, serta ajukan pembaruan verifikasi." : `Anda pengurus ${community.name}: kelola acara dan merchandise komunitas.`}
                    </p>
                </div>
                {status === "VERIFIED" && (
                    <Link href={`/communities/${community.id}`} className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted">
                        <ExternalLink aria-hidden="true" className="size-4" /> Lihat Halaman Publik
                    </Link>
                )}
            </header>
            <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
                <ManageNav communityId={community.id} counts={counts} can={{ editProfile: can.editProfile, manageTeam: can.manageTeam, manageContent: can.manageContent, isOwner: role === "owner" }} />
                <div className="min-w-0">{children}</div>
            </div>
        </main>
    );
}
