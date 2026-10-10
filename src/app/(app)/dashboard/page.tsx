import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { countUserBookmarks } from "@/lib/db/queries/bookmarks";
import { countUserBookListings } from "@/lib/db/queries/books";
import { countUserInterests } from "@/lib/db/queries/interests";

export default async function DashboardPage() {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    const [bookmarks, listings, interests] = await Promise.all([
        countUserBookmarks(user.id),
        countUserBookListings(user.id),
        countUserInterests(user.id),
    ]);

    const sections = [
        { href: "/bookmarks", label: "Buku tersimpan", count: bookmarks, description: "Lanjutkan dari buku yang kamu tandai." },
        { href: "/my-listings", label: "Listing buku", count: listings, description: "Kelola salinan yang kamu tawarkan." },
        { href: "/recommendations", label: "Minat bacaan", count: interests, description: "Atur minat untuk rekomendasi buku." },
    ];

    return (
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 sm:px-8 sm:py-16">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Ruang pembaca</p>
            <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">Selamat datang, {user.displayName}</h1>
            <p className="mt-3 text-sm text-muted-foreground">Ringkasan aktivitas dan pintasan ke ruang bacamu.</p>
            <ul className="mt-8 grid list-none gap-4 p-0 sm:grid-cols-3">
                {sections.map((section) => (
                    <li key={section.href}>
                        <Link href={section.href} className="block h-full rounded-2xl border border-border/70 bg-card p-6 transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-ring">
                            <p className="text-sm font-medium text-muted-foreground">{section.label}</p>
                            <p className="mt-2 font-heading text-3xl font-semibold">{section.count}</p>
                            <p className="mt-3 text-sm text-muted-foreground">{section.description}</p>
                        </Link>
                    </li>
                ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/books" className="min-h-11 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Jelajahi buku</Link>
                <Link href="/settings" className="min-h-11 rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-muted">Pengaturan profil</Link>
            </div>
        </main>
    );
}
