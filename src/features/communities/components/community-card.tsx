import { BadgeCheck, ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";

import { ReportForm } from "@/features/reports/components/report-form";

export type CommunityCardData = {
    id: string;
    name: string;
    description: string | null;
    publicLocation: string | null;
    activeMemberCount: number;
    upcomingEventCount: number;
};

const avatarColors = ["bg-primary", "bg-[#b4583f]", "bg-[#55607f]", "bg-[#a88445]", "bg-[#7b2d1f]", "bg-[#6aa47f]"];

export function initialsOf(name: string) {
    return name.trim().split(/\s+/).slice(0, 3).map((word) => word[0]?.toUpperCase() ?? "").join("") || "TB";
}

export function colorFor(id: string) {
    let hash = 0;
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return avatarColors[hash % avatarColors.length];
}

export function CommunityCard({ community, isAuthenticated }: { community: CommunityCardData; isAuthenticated: boolean }) {
    return (
        <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-[0_4px_16px_rgba(31,41,36,0.06)]">
            <div className="flex items-start gap-3">
                <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-lg font-heading text-sm text-white ${colorFor(community.id)}`}>
                    {initialsOf(community.name)}
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="font-heading text-lg leading-6 font-semibold text-[#1f2924]">
                        <Link href={`/communities/${community.id}`} className="hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring">{community.name}</Link>
                    </h3>
                    {community.publicLocation && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin aria-hidden="true" className="size-3 shrink-0" /> {community.publicLocation}
                        </p>
                    )}
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#c9ecd6] px-2 py-0.5 text-[11px] font-semibold text-primary">
                    <BadgeCheck aria-hidden="true" className="size-3" /> Terverifikasi
                </span>
            </div>
            <p className="mt-4 line-clamp-4 text-sm leading-[22px] text-muted-foreground">
                {community.description || "Belum ada deskripsi komunitas."}
            </p>
            <dl className="mt-4 grid grid-cols-2 rounded-lg bg-[#f1f0ea] py-2.5 text-center">
                <div>
                    <dt className="sr-only">Anggota aktif</dt>
                    <dd className="text-sm font-semibold">{community.activeMemberCount}</dd>
                    <dd aria-hidden="true" className="text-[11px] text-muted-foreground">Kawan aktif</dd>
                </div>
                <div>
                    <dt className="sr-only">Acara mendatang</dt>
                    <dd className="text-sm font-semibold">{community.upcomingEventCount}</dd>
                    <dd aria-hidden="true" className="text-[11px] text-muted-foreground">Acara mendatang</dd>
                </div>
            </dl>
            <div className="mt-auto pt-4">
                <Link href={`/communities/${community.id}`} className="flex min-h-10 items-center justify-center gap-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                    Lihat Profil <ChevronRight aria-hidden="true" className="size-3.5" />
                </Link>
                <ReportForm targetType="COMMUNITY" targetId={community.id} targetName={community.name} isAuthenticated={isAuthenticated} />
            </div>
        </article>
    );
}
