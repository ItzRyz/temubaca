import { BookOpen, CircleCheck, Settings2, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";

type NavItem = { href: string | null; label: string; icon: LucideIcon; badge?: number };

function initialsOf(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "TB";
}

/** Admin portal navigation (Figma "Peninjauan" 143:807). Items without a page yet are shown as unavailable. */
export function AdminSidebar({ displayName, pendingCount }: { displayName: string; pendingCount: number }) {
    const items: NavItem[] = [
        { href: "/moderation/reports", label: "Peninjauan", icon: CircleCheck, badge: pendingCount },
        { href: null, label: "Data Komunitas", icon: UsersRound },
        { href: null, label: "Data Buku", icon: BookOpen },
        { href: null, label: "Data Pengguna", icon: UserRound },
        { href: null, label: "Pengaturan", icon: Settings2 },
    ];

    return (
        <aside className="flex flex-col gap-4 border-b border-border bg-[#fcfbf7] p-4 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
            <Link href="/" className="font-heading text-[26px] leading-none text-[#21523d] lowercase">temubaca.</Link>
            <nav aria-label="Portal administrator">
                <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Portal Administrator</p>
                <ul className="flex list-none gap-1 overflow-x-auto p-0 [scrollbar-width:none] lg:flex-col">
                    {items.map(({ href, label, icon: Icon, badge }) => (
                        <li key={label} className="shrink-0">
                            {href ? (
                                <Link href={href} aria-current="page" className="flex h-10 items-center gap-2.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
                                    <Icon aria-hidden="true" className="size-4" />
                                    <span className="flex-1">{label}</span>
                                    {badge !== undefined && badge > 0 && (
                                        <span className="rounded-full bg-[#c9ecd6] px-2 text-xs text-primary">
                                            {badge}<span className="sr-only"> menunggu</span>
                                        </span>
                                    )}
                                </Link>
                            ) : (
                                <span aria-disabled="true" title="Belum tersedia" className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm text-muted-foreground">
                                    <Icon aria-hidden="true" className="size-4" />
                                    <span className="flex-1">{label}</span>
                                    <span className="text-[10px] tracking-wide uppercase">Segera</span>
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            </nav>
            <div className="mt-auto hidden items-center gap-3 rounded-lg bg-[#f1f0ea] p-3 lg:flex">
                <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{initialsOf(displayName)}</span>
                <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{displayName}</span>
                    <span className="block text-xs text-muted-foreground">Admin Moderator</span>
                </span>
            </div>
            <Link href="/dashboard" className="hidden text-xs font-semibold text-primary hover:underline lg:block">← Kembali ke ruang pembaca</Link>
        </aside>
    );
}
