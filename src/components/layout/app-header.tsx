import Link from "next/link";

import { appConfig } from "@/config/app";
import { signOut } from "@/features/auth/actions";

const navigation = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/books", label: "Jelajahi buku" },
    { href: "/bookmarks", label: "Tersimpan" },
    { href: "/my-listings", label: "Listing saya" },
    { href: "/recommendations", label: "Rekomendasi" },
    { href: "/profile", label: "Profil" },
];

export function AppHeader({ displayName, isAdmin }: { displayName: string; isAdmin: boolean }) {
    return (
        <header className="border-b border-border/70 bg-card/90">
            <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-4 sm:px-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link href="/dashboard" className="font-heading text-xl font-semibold tracking-tight text-primary">{appConfig.name}</Link>
                    <div className="flex items-center gap-3 text-sm">
                        <span className="max-w-40 truncate text-muted-foreground">{displayName}</span>
                        <form action={signOut}>
                            <button type="submit" className="min-h-10 rounded-lg border border-border px-3 py-2 font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">Keluar</button>
                        </form>
                    </div>
                </div>
                <nav aria-label="Navigasi akun" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    {navigation.map((item) => <Link key={item.href} href={item.href} className="text-foreground hover:text-primary focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring">{item.label}</Link>)}
                    {isAdmin && <Link href="/admin" className="text-foreground hover:text-primary focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring">Admin</Link>}
                    {isAdmin && <Link href="/moderation/reports" className="text-foreground hover:text-primary focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring">Moderasi</Link>}
                </nav>
            </div>
        </header>
    );
}
