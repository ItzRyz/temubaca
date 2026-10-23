import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/login-redirect";
import { countUserBookmarks } from "@/lib/db/queries/bookmarks";
import { countUserBookListings } from "@/lib/db/queries/books";
import { countUserInterests } from "@/lib/db/queries/interests";
import { listLoansForUser } from "@/lib/db/queries/borrowing";
import { loanGroup } from "@/features/borrowing/lifecycle";
import { CommunityRecommendations } from "@/features/recommendations/components/community-recommendations";
import { getCommunityRecommendations } from "@/features/recommendations/community-queries";

export default async function DashboardPage() {
    const user = await getCurrentUser();
    if (!user) return redirectToLogin();

    const now = new Date();
    const [bookmarks, listings, interests, loans, communityRecommendations] = await Promise.all([
        countUserBookmarks(user.id),
        countUserBookListings(user.id),
        countUserInterests(user.id),
        listLoansForUser(user.id, now),
        getCommunityRecommendations(user.id),
    ]);
    const ongoing = (state: string) => state === "ACTIVE" || state === "OVERDUE" || state === "DISPUTED";
    const needsAction = loans.filter((loan) => loanGroup(loan.snapshot, loan.role, now) === "action");
    const loanStats = [
        { label: "Perlu tindakan", count: needsAction.length, href: "/my-listings?tab=peminjaman&filter=action" },
        { label: "Sedang kupinjamkan", count: loans.filter((loan) => loan.role === "owner" && ongoing(loan.state)).length, href: "/my-listings?tab=peminjaman&filter=ongoing" },
        { label: "Sedang kupinjam", count: loans.filter((loan) => loan.role === "requester" && ongoing(loan.state)).length, href: "/my-listings?tab=peminjaman&view=pinjam&filter=ongoing" },
        { label: "Terlambat", count: loans.filter((loan) => loan.state === "OVERDUE").length, href: "/my-listings?tab=peminjaman&filter=action" },
    ];

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
            <section aria-labelledby="loans-title" className="mt-10">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="loans-title" className="font-heading text-2xl font-semibold">Peminjaman</h2>
                    <Link href="/my-listings?tab=peminjaman" className="text-sm font-semibold text-primary hover:underline">Buka Peminjaman</Link>
                </div>
                <ul className="mt-4 grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-4">
                    {loanStats.map((stat) => (
                        <li key={stat.label}>
                            <Link href={stat.href} className="block h-full rounded-2xl border border-border/70 bg-card p-4 hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-ring">
                                <p className="text-sm text-muted-foreground">{stat.label}</p>
                                <p className={`mt-1 font-heading text-2xl font-semibold ${stat.label === "Terlambat" && stat.count > 0 ? "text-destructive" : ""}`}>{stat.count}</p>
                            </Link>
                        </li>
                    ))}
                </ul>
                {needsAction.length > 0 ? (
                    <ul className="mt-4 flex list-none flex-col divide-y divide-border rounded-2xl border border-border/70 bg-card p-0">
                        {needsAction.slice(0, 3).map((loan) => (
                            <li key={loan.requestId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                                <span>
                                    <span className="font-semibold">{loan.book.title}</span>
                                    <span className="text-muted-foreground"> · {loan.role === "owner" ? `peminjam ${loan.otherParty.displayName}` : `pemilik ${loan.otherParty.displayName}`}</span>
                                </span>
                                <span className="text-xs font-semibold text-[#5c3d00]">
                                    {loan.state === "PENDING" ? "Permintaan baru" : loan.state === "AWAITING_HANDOVER" ? "Konfirmasi serah terima" : loan.state === "OVERDUE" ? "Terlambat" : "Konfirmasi pengembalian"}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="mt-4 text-sm text-muted-foreground">{loans.length > 0 ? "Tidak ada pinjaman yang menunggu tindakanmu." : "Belum ada pinjaman. Ajukan pinjam dari halaman buku, atau tawarkan bukumu di Buku Saya."}</p>
                )}
            </section>

            <div className="mt-10">
                <CommunityRecommendations id="community-recommendations-title" recommendations={communityRecommendations} />
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/books" className="min-h-11 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Jelajahi buku</Link>
                <Link href="/settings" className="min-h-11 rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-muted">Pengaturan profil</Link>
            </div>
        </main>
    );
}
