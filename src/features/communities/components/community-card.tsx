import { BadgeCheck, CalendarDays, ChevronRight, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";

import { merchandisePhotoUrl } from "@/features/merchandise/format";
import { ReportForm } from "@/features/reports/components/report-form";
import { cn } from "@/lib/utils";

import { instagramFollowersLabel } from "../instagram";

export type CommunityCardData = {
    id: string;
    name: string;
    logoPath: string | null;
    description: string | null;
    publicLocation: string | null;
    instagramFollowers: number | null;
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

/**
 * The community's logo (TB-030), or its initials on a colour picked from its id. Decorative: the name
 * always sits next to it. `className` sets the size, corner radius, and text size.
 */
export function CommunityAvatar({ community, className }: { community: { id: string; name: string; logoPath: string | null }; className?: string }) {
    return (
        <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center overflow-hidden font-heading text-white", community.logoPath ? "bg-card" : colorFor(community.id), className)}>
            {community.logoPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={merchandisePhotoUrl(community.logoPath)} alt="" loading="lazy" className="size-full object-cover" />
            ) : initialsOf(community.name)}
        </span>
    );
}

/** `reason` is set when the card is a recommendation (TB-060). */
export function CommunityCard({ community, isAuthenticated, reason }: { community: CommunityCardData; isAuthenticated: boolean; reason?: string }) {
    return (
        <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-[0_4px_16px_rgba(31,41,36,0.06)]">
            <div className="flex items-start gap-3">
                <CommunityAvatar community={community} className="size-10 rounded-lg text-sm" />
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
            </div>
            {reason && (
                <p className="mt-4 flex items-start gap-1.5 rounded-lg bg-[#e7efe8] px-3 py-2 text-xs leading-5 font-medium text-primary">
                    <Sparkles aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /> {reason}
                </p>
            )}
            <p className="mt-4 line-clamp-3 text-sm leading-[22px] text-muted-foreground">
                {community.description || "Belum ada deskripsi komunitas."}
            </p>
            <ul aria-label="Status" className="mt-3 mb-5 flex list-none flex-wrap gap-1.5 p-0">
                <li className="flex items-center gap-1 rounded-full bg-[#c9ecd6] px-2 py-0.5 text-[11px] font-semibold text-primary">
                    <BadgeCheck aria-hidden="true" className="size-3" /> Terverifikasi
                </li>
                {instagramFollowersLabel(community.instagramFollowers) && (
                    <li className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{instagramFollowersLabel(community.instagramFollowers)}</li>
                )}
            </ul>
            <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                    <span className="block">Agenda</span>
                    <span className="flex items-center gap-1 font-semibold text-primary">
                        <CalendarDays aria-hidden="true" className="size-3.5" />
                        {community.upcomingEventCount > 0 ? `${community.upcomingEventCount} acara mendatang` : "Belum ada acara terjadwal"}
                    </span>
                </p>
                <Link href={`/communities/${community.id}`} className="flex min-h-10 shrink-0 items-center justify-center gap-1 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                    Lihat Profil <ChevronRight aria-hidden="true" className="size-3.5" />
                </Link>
            </div>
            <ReportForm targetType="COMMUNITY" targetId={community.id} targetName={community.name} isAuthenticated={isAuthenticated} />
        </article>
    );
}
