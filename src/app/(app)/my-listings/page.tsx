import { AlertTriangle, ArrowLeftRight, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, HandHeart, Hourglass, Lock, Search, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AddBookDialog } from "@/features/book-listings/components/add-book-dialog";
import { ManagedListingItem } from "@/features/book-listings/components/managed-listing-item";
import { LoansPanel, loanStats, type LoanFilter, type LoanView } from "@/features/borrowing/components/loans-panel";
import { loanGroup } from "@/features/borrowing/lifecycle";
import { getCurrentUser } from "@/lib/auth";
import { MarkLoansSeen } from "@/features/borrowing/components/mark-loans-seen";
import { loansSeenAt } from "@/lib/db/queries/users";
import { redirectToLogin } from "@/lib/auth/login-redirect";
import { countLoanUpdatesSince, listingLoanStates, listLoansForUser } from "@/lib/db/queries/borrowing";
import { latestAppealsForListings } from "@/lib/db/queries/listing-appeals";
import { listUserBookListings } from "@/lib/db/queries/books";
import { cn } from "@/lib/utils";
import { getSettings } from "@/lib/db/queries/settings";

export const metadata: Metadata = { title: "Buku saya" };

type MyListingsPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const filters = [
    { value: "all", label: "Semua" },
    { value: "AVAILABLE", label: "Tersedia" },
    { value: "RESERVED", label: "Dipesan & Dipinjam" },
    { value: "UNAVAILABLE", label: "Tidak Ditawarkan" },
    { value: "HIDDEN", label: "Disembunyikan" },
] as const;
type Filter = (typeof filters)[number]["value"];
const sorts = { newest: "Terbaru", title: "Judul A–Z" } as const;
type Sort = keyof typeof sorts;
const PAGE_SIZE = 10;

function single(value: string | string[] | undefined) {
    return typeof value === "string" ? value : undefined;
}

export default async function MyListingsPage({ searchParams }: MyListingsPageProps) {
    const user = await getCurrentUser();
    if (!user) return redirectToLogin();

    const params = await searchParams;
    const filter: Filter = filters.some((item) => item.value === params.filter) ? (params.filter as Filter) : "all";
    const query = (single(params.q) ?? "").trim().slice(0, 100);
    const needle = query.toLocaleLowerCase("id-ID");
    const sort: Sort = single(params.sort) === "title" ? "title" : "newest";
    const requestedPage = Number.parseInt(single(params.page) ?? "1", 10);

    const tab = single(params.tab) === "peminjaman" ? "peminjaman" : "koleksi";
    const requestedView = single(params.view);
    // "perpustakaan" (library requests) closed on 30 Okt 2026; old links land on lending.
    const loanView: LoanView = requestedView === "pinjam" ? "pinjam" : "pinjamkan";
    const loanFilters: LoanFilter[] = ["all", "action", "ongoing", "history"];
    const loanFilter = loanFilters.find((value) => value === params.filter) ?? "all";
    const now = new Date();
    const { settings: borrowingRules } = await getSettings("borrowing");

    const [listings, loans, loanNews] = await Promise.all([
        listUserBookListings(user.id),
        listLoansForUser(user.id, now),
        countLoanUpdatesSince(user.id, loansSeenAt(user.preferences, now)),
    ]);
    const [appeals, loanStates] = await Promise.all([
        latestAppealsForListings(listings.filter((listing) => listing.hiddenAt).map((listing) => listing.id)),
        listingLoanStates(listings.filter((listing) => listing.availability === "RESERVED").map((listing) => listing.id)),
    ]);
    // Dots per side of Peminjaman (30 Okt 2026): something to do, or an answer the borrower has not seen yet.
    const needsAction = (role: "owner" | "requester") => loans.some((loan) => loan.role === role && loanGroup(loan.snapshot, loan.role, now) === "action");
    const loanAttention = { pinjamkan: needsAction("owner"), pinjam: needsAction("requester") || loanNews > 0 };
    const statusOf = (listing: (typeof listings)[number]) => (listing.hiddenAt ? "HIDDEN" : listing.availability);
    const counts: Record<Filter, number> = {
        all: listings.length,
        AVAILABLE: listings.filter((listing) => statusOf(listing) === "AVAILABLE").length,
        RESERVED: listings.filter((listing) => statusOf(listing) === "RESERVED").length,
        UNAVAILABLE: listings.filter((listing) => statusOf(listing) === "UNAVAILABLE").length,
        HIDDEN: listings.filter((listing) => statusOf(listing) === "HIDDEN").length,
    };
    const matching = listings
        .filter((listing) =>
            (filter === "all" || statusOf(listing) === filter) &&
            (!needle || listing.book.title.toLocaleLowerCase("id-ID").includes(needle) || listing.book.authors.some((author) => author.toLocaleLowerCase("id-ID").includes(needle))),
        )
        .sort((a, b) => (sort === "title" ? a.book.title.localeCompare(b.book.title, "id-ID") : b.createdAt.getTime() - a.createdAt.getTime()));
    const totalPages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
    const page = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;
    const visible = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const hrefFor = (next: { filter?: Filter; page?: number }) => {
        const search = new URLSearchParams();
        const nextFilter = next.filter ?? filter;
        if (nextFilter !== "all") search.set("filter", nextFilter);
        if (query) search.set("q", query);
        if (sort !== "newest") search.set("sort", sort);
        if ((next.page ?? 1) > 1) search.set("page", String(next.page));
        const value = search.toString();
        return value ? `/my-listings?${value}` : "/my-listings";
    };

    const loanCounts = loanStats(loans, loanView, now);
    const stats = tab === "peminjaman" ? [
        { icon: AlertTriangle, value: loanCounts.action, unit: "Item", label: "Perlu Tindakan", tone: "bg-[#fbecc4] text-[#5c3d00]" },
        { icon: Hourglass, value: loanCounts.pending, unit: "Permintaan", label: loanView === "pinjamkan" ? "Permintaan Baru" : "Menunggu Jawaban", tone: "bg-[#dbe2dc] text-primary" },
        { icon: ArrowLeftRight, value: loanCounts.ongoing, unit: loanView === "pinjamkan" ? "Pinjaman" : "Buku", label: loanView === "pinjamkan" ? "Sedang Dipinjam" : "Sedang Saya Pinjam", tone: "bg-[#ffdbd1] text-[#5c1a0a]" },
        { icon: CheckCircle2, value: loanCounts.returned, unit: "Buku", label: "Sudah Dikembalikan", tone: "bg-[#c9ecd6] text-primary" },
    ] : [
        { icon: BookOpen, value: counts.all, unit: "Buku", label: "Buku Terdaftar", tone: "bg-[#e7efe8] text-primary" },
        { icon: HandHeart, value: counts.AVAILABLE, unit: "Buku", label: "Tersedia", tone: "bg-[#c9ecd6] text-primary" },
        { icon: ArrowLeftRight, value: counts.RESERVED, unit: "Buku", label: "Dipesan & Dipinjam", tone: "bg-[#fbe7c6] text-[#7a4b00]" },
        { icon: Lock, value: counts.UNAVAILABLE, unit: "Arsip", label: "Disimpan Pribadi", tone: "bg-[#f1f0ea] text-foreground" },
    ];

    return (
        <main className="mx-auto w-full max-w-[1256px] px-4 py-8 sm:px-6 sm:py-10">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="font-heading text-[32px] leading-tight font-semibold text-primary">Buku Saya</h1>
                    <p className="mt-1 max-w-2xl text-base text-muted-foreground">
                        Kelola koleksi buku fisik yang kamu bagikan dengan kawan pembaca di titik temu publik yang disepakati.
                    </p>
                </div>
                <AddBookDialog defaultLoanDays={borrowingRules.defaultLoanDays} mapOnlyMeetingPoints={borrowingRules.meetingPointsFromMapOnly} />
            </header>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {stats.map(({ icon: Icon, value, unit, label, tone }) => (
                    <div key={label} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
                        <span aria-hidden="true" className={`flex size-10 items-center justify-center rounded-lg ${tone}`}><Icon className="size-5" /></span>
                        <dl className="flex flex-col-reverse">
                            <dt className="text-sm">{label}</dt>
                            <dd><span className="font-heading text-xl font-semibold">{value}</span> <span className="text-xs text-muted-foreground">{unit}</span></dd>
                        </dl>
                    </div>
                ))}
            </div>

            <nav aria-label="Bagian Buku Saya" className="mt-6 flex w-fit gap-1 rounded-xl border border-border bg-[#f1f0ea] p-1">
                <Link href="/my-listings" aria-current={tab === "koleksi" ? "page" : undefined}
                    className={cn("flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm", tab === "koleksi" ? "bg-card font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    Koleksi
                </Link>
                <Link href="/my-listings?tab=peminjaman" aria-current={tab === "peminjaman" ? "page" : undefined}
                    className={cn("flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm", tab === "peminjaman" ? "bg-card font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    Peminjaman
                    {(loanAttention.pinjamkan || loanAttention.pinjam) && <span className="size-2 rounded-full bg-destructive"><span className="sr-only">Perlu tindakan</span></span>}
                </Link>
            </nav>

            {tab === "peminjaman" ? (
                <>
                    {/* What the reader borrows: answers newer than their last visit are marked, then the dot clears. */}
                    {loanView === "pinjam" && <MarkLoansSeen />}
                    <LoansPanel loans={loans} view={loanView} filter={loanFilter} query={query} now={now} attention={loanAttention}
                        newSince={loanView === "pinjam" ? loansSeenAt(user.preferences, now) : undefined} />
                </>
            ) : (
                <>
                    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap gap-2">
                            {filters.map((item) => (
                                <Link
                                    key={item.value}
                                    href={hrefFor({ filter: item.value })}
                                    aria-current={filter === item.value ? "true" : undefined}
                                    className={cn(
                                        "rounded-lg border px-4 py-2 text-sm font-semibold",
                                        filter === item.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
                                    )}
                                >
                                    {item.label} ({counts[item.value]})
                                </Link>
                            ))}
                        </div>
                        <form action="/my-listings" method="get" role="search" className="flex flex-col gap-2 sm:flex-row lg:w-[420px]">
                            {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
                            <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input px-3 focus-within:ring-2 focus-within:ring-ring">
                                <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                                <span className="sr-only">Cari judul atau penulis</span>
                                <input name="q" type="search" maxLength={100} defaultValue={query} placeholder="Cari judul atau penulis..." className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                            </label>
                            <label className="sr-only" htmlFor="listing-sort">Urutkan</label>
                            <select id="listing-sort" name="sort" defaultValue={sort} className="h-11 rounded-lg border border-input bg-card px-3 text-sm">
                                {(Object.keys(sorts) as Sort[]).map((value) => <option key={value} value={value}>{sorts[value]}</option>)}
                            </select>
                            <button type="submit" className="h-11 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/5">Terapkan</button>
                        </form>
                    </div>

                    {visible.length > 0 ? (
                        <ul className="mt-4 flex list-none flex-col gap-4 p-0">
                            {visible.map((listing) => <ManagedListingItem key={listing.id} listing={listing} appeal={appeals.get(listing.id)} now={now} loanState={loanStates.get(listing.id)} />)}
                        </ul>
                    ) : (
                        <section className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
                            <h2 className="font-heading text-xl font-semibold">{listings.length > 0 ? "Tidak ada buku yang cocok" : "Belum ada buku yang kamu bagikan"}</h2>
                            <p className="mt-2 text-sm text-muted-foreground">
                                {listings.length > 0 ? "Ubah filter atau kata kunci pencarian." : "Tekan Tambah Buku untuk mencari buku di katalog atau mengisi datanya sendiri."}
                            </p>
                        </section>
                    )}

                    {totalPages > 1 && (
                        <nav aria-label="Halaman" className="mt-4 flex items-center justify-end gap-2">
                            <Link aria-label="Halaman sebelumnya" aria-disabled={page === 1} href={hrefFor({ page: page - 1 })} className={cn("flex size-10 items-center justify-center rounded-lg border border-border bg-card", page === 1 && "pointer-events-none opacity-40")}><ChevronLeft aria-hidden="true" className="size-4" /></Link>
                            {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
                                <Link key={number} href={hrefFor({ page: number })} aria-current={number === page ? "page" : undefined}
                                    className={cn("flex size-10 items-center justify-center rounded-lg border text-sm font-semibold", number === page ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted")}>
                                    {number}
                                </Link>
                            ))}
                            <Link aria-label="Halaman berikutnya" aria-disabled={page === totalPages} href={hrefFor({ page: page + 1 })} className={cn("flex size-10 items-center justify-center rounded-lg border border-border bg-card", page === totalPages && "pointer-events-none opacity-40")}><ChevronRight aria-hidden="true" className="size-4" /></Link>
                        </nav>
                    )}
                </>
            )}

            <section className="mt-8 flex flex-col gap-3 rounded-xl bg-[#e7efe8] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-card text-primary"><ShieldCheck aria-hidden="true" className="size-5" /></span>
                    <div>
                        <h2 className="font-heading text-lg font-semibold">Keamanan &amp; Etika Pinjam Buku di TemuBaca</h2>
                        <p className="text-sm text-foreground/80">Cantumkan hanya lokasi publik umum, jangan alamat rumah. Lakukan serah terima di titik temu yang ramai, dan laporkan akun yang mencurigakan.</p>
                    </div>
                </div>
                <Link href="/about" className="inline-flex min-h-10 shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline">Baca tentang TemuBaca <ChevronRight aria-hidden="true" className="size-4" /></Link>
            </section>
        </main>
    );
}
