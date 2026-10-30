"use client";

import { ArrowLeftRight, BookOpen, Building2, CalendarDays, Lock, Tag, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: LucideIcon; count?: number; locked?: string; attention?: boolean };

/** Figma "Kelola Komunitas" side menu: Profil, Acara, Merchandise, Koleksi, Peminjaman (30 Okt 2026), Pengurus. */
export function ManageNav({ communityId, counts, can }: {
    communityId: string;
    counts: { events: number; merchandise: number; collection: number; loansNeedingAction: number };
    can: { editProfile: boolean; manageTeam: boolean; manageContent: boolean; isOwner: boolean };
}) {
    const pathname = usePathname();
    const base = `/communities/${communityId}/manage`;
    const contentLock = can.manageContent ? undefined : "Tersedia setelah komunitas terverifikasi";
    const items: Item[] = [
        ...(can.isOwner ? [{ href: base, label: "Profil Komunitas", icon: Building2 }] : []),
        { href: `${base}/events`, label: "Acara", icon: CalendarDays, count: counts.events, locked: contentLock },
        { href: `${base}/merchandise`, label: "Merchandise", icon: Tag, count: counts.merchandise, locked: contentLock },
        { href: `${base}/collection`, label: "Koleksi Buku", icon: BookOpen, count: counts.collection, locked: contentLock },
        { href: `${base}/loans`, label: "Peminjaman", icon: ArrowLeftRight, attention: counts.loansNeedingAction > 0, locked: contentLock },
        ...(can.isOwner ? [{ href: `${base}/team`, label: "Pengurus", icon: UsersRound, locked: can.manageTeam ? undefined : "Tersedia setelah komunitas terverifikasi" }] : []),
    ];
    const active = (href: string) => (href === base ? pathname === base : pathname.startsWith(href));

    return (
        <nav aria-label="Menu kelola komunitas" className="h-fit rounded-2xl border border-border bg-card p-3">
            <p className="px-2 pb-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Menu</p>
            <ul className="flex list-none gap-1 overflow-x-auto p-0 [scrollbar-width:none] lg:flex-col">
                {items.map(({ href, label, icon: Icon, count, locked, attention }) => (
                    <li key={href} className="shrink-0">
                        {locked ? (
                            <span aria-disabled="true" title={locked} className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm text-muted-foreground">
                                <Icon aria-hidden="true" className="size-4" /> <span className="flex-1">{label}</span> <Lock aria-hidden="true" className="size-3.5" />
                                <span className="sr-only">({locked})</span>
                            </span>
                        ) : (
                            <Link href={href} aria-current={active(href) ? "page" : undefined}
                                className={cn("flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm", active(href) ? "bg-[#e7efe8] font-semibold text-primary" : "hover:bg-muted")}>
                                <Icon aria-hidden="true" className="size-4" /> <span className="flex-1">{label}</span>
                                {count !== undefined && count > 0 && <span className="rounded-full bg-[#ebe9e1] px-2 text-xs">{count}</span>}
                                {attention && <span className="size-2 rounded-full bg-destructive"><span className="sr-only">Perlu tindakan</span></span>}
                            </Link>
                        )}
                    </li>
                ))}
            </ul>
        </nav>
    );
}
