"use client";

import { ArrowLeftRight, Bookmark, BookOpen, CircleHelp, Flag, LayoutDashboard, Library, LogOut, ShieldCheck, Sparkles, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { openTour } from "@/features/onboarding/components/product-tour";

type MenuItem = { href: string; label: string; hint: string; icon: LucideIcon; attention?: keyof Pick<MenuAttention, "loans" | "communities" | "reports"> };
type MenuGroup = { title: string; items: MenuItem[] };

/** What waits for this user, shown as red dots (owner's decision 29 Okt 2026: a dot, no count). */
export type MenuAttention = { loans: boolean; loansHref: string; communities: boolean; reports: boolean; managesLibraries: boolean };

/** Grouped so a new reader can tell the entries apart (owner's request 28 Okt 2026); each has a one-line hint. */
function menuGroups({ isAdmin, managesLibraries, loansHref }: { isAdmin: boolean; managesLibraries: boolean; loansHref: string }): MenuGroup[] {
    return [
        {
            title: "Buku",
            items: [
                { href: "/my-listings", label: "Koleksi saya", hint: "Buku yang kamu bagikan", icon: BookOpen },
                { href: loansHref, label: "Pinjam & pinjamkan", hint: "Permintaan dan pinjaman", icon: ArrowLeftRight, attention: "loans" },
            ],
        },
        {
            title: "Untukmu",
            items: [
                { href: "/recommendations", label: "Rekomendasi", hint: "Buku dan komunitas pilihan", icon: Sparkles },
                { href: "/bookmarks", label: "Bookmark & minat", hint: "Buku tersimpan dan minat baca", icon: Bookmark },
                { href: "/reports/mine", label: "Laporan saya", hint: "Status laporan yang kamu kirim", icon: Flag, attention: "reports" },
            ],
        },
        {
            title: "Komunitas",
            items: [
                { href: "/communities/mine", label: "Komunitas saya", hint: "Komunitas yang kamu ikuti atau kelola", icon: UsersRound, attention: "communities" },
                ...(managesLibraries ? [{ href: "/my-libraries", label: "Perpustakaan saya", hint: "Koleksi yang tercatat", icon: Library }] : []),
            ],
        },
        ...(isAdmin ? [{ title: "Pengelola", items: [{ href: "/admin", label: "Admin", hint: "Peninjauan dan data platform", icon: ShieldCheck }] }] : []),
    ];
}

const itemClass = "flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

/**
 * Avatar button with the account menu (Figma "Profile Dropdown" 135:862). Red dots on the avatar and on
 * "Pinjam & pinjamkan" and "Komunitas saya" show what waits for this user (30 Okt 2026).
 * "Panduan TemuBaca" reopens the tour.
 */
export function ProfileMenu({ initials, displayName, isAdmin, attention }: { initials: string; displayName: string; isAdmin: boolean; attention: MenuAttention }) {
    const [open, setOpen] = useState(false);
    const menuId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();

    // Close whenever navigation happens.
    const [lastPath, setLastPath] = useState(pathname);
    if (pathname !== lastPath) {
        setLastPath(pathname);
        setOpen(false);
    }

    const items = () => [...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];

    useEffect(() => {
        if (!open) return;
        items()[0]?.focus();
        function onPointerDown(event: PointerEvent) {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        }
        function onKeyDown(event: globalThis.KeyboardEvent) {
            if (event.key === "Escape") {
                setOpen(false);
                buttonRef.current?.focus();
            }
        }
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const list = items();
        const current = list.indexOf(document.activeElement as HTMLElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? list.length - 1
            : (current + (event.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
        list[next]?.focus();
    }

    const waiting = attention.loans || attention.communities || attention.reports;
    const groups = menuGroups({ isAdmin, managesLibraries: attention.managesLibraries, loansHref: attention.loansHref });

    return (
        <div ref={rootRef} className="relative">
            <button
                ref={buttonRef}
                type="button"
                data-tour="account-menu"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={menuId}
                aria-label={`Menu akun ${displayName}${waiting ? ", ada yang perlu tindakan" : ""}`}
                onClick={() => setOpen((value) => !value)}
                className="relative flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
                {initials}
                {waiting && <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-destructive ring-2 ring-background" />}
            </button>
            {open && (
                <div ref={menuRef} id={menuId} role="menu" aria-label="Menu akun" onKeyDown={onMenuKeyDown}
                    className="absolute right-0 z-50 mt-2 max-h-[calc(100vh-6rem)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-[0_6px_20px_rgba(31,41,36,0.12)]">
                    <Link href="/profile" role="menuitem" className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e7efe8] text-sm font-semibold text-primary">{initials}</span>
                        <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{displayName}</span>
                            <span className="block text-xs text-muted-foreground">{isAdmin ? "Admin" : "Anggota"} · Lihat profil</span>
                        </span>
                    </Link>
                    <Link href="/dashboard" role="menuitem" className={itemClass}>
                        <LayoutDashboard aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">Dashboard</span>
                            <span className="block text-xs text-muted-foreground">Ringkasan aktivitasmu</span>
                        </span>
                    </Link>
                    {groups.map((group) => (
                        <div key={group.title} role="group" aria-label={group.title} className="mt-1 border-t border-border pt-1">
                            <p aria-hidden="true" className="px-3 pt-1.5 pb-0.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{group.title}</p>
                            {group.items.map(({ href, label, hint, icon: Icon, attention: key }) => {
                                const marked = key ? attention[key] : false;
                                return (
                                    <Link key={href} href={href} role="menuitem" aria-current={pathname === href ? "page" : undefined} className={itemClass}>
                                        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-medium">{label}</span>
                                            <span className="block text-xs text-muted-foreground">{hint}</span>
                                        </span>
                                        {marked && (
                                            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-destructive">
                                                <span className="sr-only">Perlu tindakan</span>
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                    <div className="mt-1 border-t border-border pt-1">
                        <button type="button" role="menuitem" onClick={() => { setOpen(false); buttonRef.current?.focus(); openTour(); }} className={itemClass}>
                            <CircleHelp aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                            <span className="block text-sm font-medium">Panduan TemuBaca</span>
                        </button>
                        {/* Confirm first on /logout (Figma "Keluar Akun" 58:21897). */}
                        <Link href="/logout" role="menuitem" className={`${itemClass} text-destructive`}>
                            <LogOut aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                            <span className="block text-sm font-medium">Keluar</span>
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
