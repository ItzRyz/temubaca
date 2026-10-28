"use client";

import { ArrowLeftRight, Bookmark, BookOpen, LayoutDashboard, LogOut, ShieldCheck, Sparkles, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

type MenuLink = { href: string; label: string; icon: LucideIcon };

const LOANS_HREF = "/my-listings?tab=peminjaman";

const memberLinks: MenuLink[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/profile", label: "Profil", icon: UserRound },
    { href: "/my-listings", label: "Buku Saya", icon: BookOpen },
    { href: LOANS_HREF, label: "Minta & Pinjam", icon: ArrowLeftRight },
    { href: "/communities/mine", label: "Komunitas Saya", icon: UsersRound },
    { href: "/bookmarks", label: "Bookmark & Minat", icon: Bookmark },
    { href: "/recommendations", label: "Rekomendasi", icon: Sparkles },
];

const adminLinks: MenuLink[] = [
    { href: "/admin", label: "Admin", icon: ShieldCheck },
];

const itemClass = "flex h-10 w-full items-center gap-2.5 rounded px-3 text-left text-sm font-medium text-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

/**
 * Avatar button with the account menu (Figma "Profile Dropdown" 135:862). A dot on the avatar and a
 * count on "Minta & Pinjam" show loans waiting for this user ("Perlu Tindakan").
 */
export function ProfileMenu({ initials, displayName, isAdmin, attention }: { initials: string; displayName: string; isAdmin: boolean; attention: number }) {
    const [open, setOpen] = useState(false);
    const menuId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const pathname = usePathname();

    // Close whenever navigation happens.
    const [lastPath, setLastPath] = useState(pathname);
    if (pathname !== lastPath) {
        setLastPath(pathname);
        setOpen(false);
    }

    useEffect(() => {
        if (!open) return;
        function onPointerDown(event: PointerEvent) {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        }
        function onKeyDown(event: KeyboardEvent) {
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

    const links = isAdmin ? [...memberLinks, ...adminLinks] : memberLinks;

    return (
        <div ref={rootRef} className="relative">
            <button
                ref={buttonRef}
                type="button"
                aria-haspopup="true"
                aria-expanded={open}
                aria-controls={menuId}
                aria-label={`Menu akun ${displayName}${attention ? `, ${attention} pinjaman perlu tindakan` : ""}`}
                onClick={() => setOpen((value) => !value)}
                className="relative flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
                {initials}
                {attention > 0 && <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-destructive ring-2 ring-background" />}
            </button>
            {open && (
                <div id={menuId} className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-[0_6px_20px_rgba(31,41,36,0.08)]">
                    <p className="truncate px-3 pt-2 pb-1 text-xs text-muted-foreground">{displayName}</p>
                    <ul className="list-none p-0">
                        {links.map(({ href, label, icon: Icon }) => (
                            <li key={href}>
                                <Link href={href} aria-current={pathname === href ? "page" : undefined} className={itemClass}>
                                    <Icon aria-hidden="true" className="size-4" /> {label}
                                    {href === LOANS_HREF && attention > 0 && (
                                        <span className="ml-auto rounded-full bg-destructive px-1.5 text-xs font-semibold text-white tabular-nums">
                                            {attention}<span className="sr-only"> perlu tindakan</span>
                                        </span>
                                    )}
                                </Link>
                            </li>
                        ))}
                    </ul>
                    <div aria-hidden="true" className="my-1 h-px bg-border" />
                    {/* Confirm first on /logout (Figma "Keluar Akun" 58:21897). */}
                    <Link href="/logout" className={`${itemClass} text-destructive`}>
                        <LogOut aria-hidden="true" className="size-4" /> Keluar
                    </Link>
                </div>
            )}
        </div>
    );
}
