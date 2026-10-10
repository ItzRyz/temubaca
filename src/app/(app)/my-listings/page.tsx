import { BookOpen, EyeOff, Library, Lock, MapPin, Plus, Search, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BookListingAvailability } from "@/features/book-listings/components/book-listing-availability";
import { BookListingEditor } from "@/features/book-listings/components/book-listing-editor";
import { getCurrentUser } from "@/lib/auth";
import { listUserBookListings } from "@/lib/db/queries/books";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Buku saya" };

type MyListingsPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const conditionLabels: Record<string, string> = {
    NEW: "Baru",
    LIKE_NEW: "Seperti baru",
    GOOD: "Baik",
    FAIR: "Cukup baik",
    POOR: "Perlu perhatian",
};

const statusBadge = {
    AVAILABLE: { label: "Tersedia", note: "Siap dipinjam kawan", className: "bg-[#c9ecd6] text-primary" },
    RESERVED: { label: "Dipesan", note: "Sedang dipesan peminjam", className: "bg-[#fbe7c6] text-[#7a4b00]" },
    UNAVAILABLE: { label: "Tidak Ditawarkan", note: "Tidak muncul di halaman buku publik", className: "bg-[#f1f0ea] text-foreground/80" },
} as const;

const filters = [
    { value: "all", label: "Semua" },
    { value: "AVAILABLE", label: "Tersedia" },
    { value: "UNAVAILABLE", label: "Tidak Ditawarkan" },
] as const;
type Filter = (typeof filters)[number]["value"];

function single(value: string | string[] | undefined) {
    return typeof value === "string" ? value : undefined;
}

export default async function MyListingsPage({ searchParams }: MyListingsPageProps) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    const params = await searchParams;
    const filter: Filter = filters.some((item) => item.value === params.filter) ? (params.filter as Filter) : "all";
    const query = (single(params.q) ?? "").trim().slice(0, 100);
    const needle = query.toLocaleLowerCase("id-ID");

    const listings = await listUserBookListings(user.id);
    const counts = {
        all: listings.length,
        AVAILABLE: listings.filter((listing) => listing.availability === "AVAILABLE").length,
        RESERVED: listings.filter((listing) => listing.availability === "RESERVED").length,
        UNAVAILABLE: listings.filter((listing) => listing.availability === "UNAVAILABLE").length,
    };
    const visible = listings.filter((listing) =>
        (filter === "all" || listing.availability === filter) &&
        (!needle || listing.book.title.toLocaleLowerCase("id-ID").includes(needle) || listing.book.authors.some((author) => author.toLocaleLowerCase("id-ID").includes(needle))),
    );

    const hrefFor = (nextFilter: Filter) => {
        const search = new URLSearchParams();
        if (nextFilter !== "all") search.set("filter", nextFilter);
        if (query) search.set("q", query);
        const value = search.toString();
        return value ? `/my-listings?${value}` : "/my-listings";
    };

    const stats = [
        { icon: BookOpen, value: counts.all, unit: "Buku", label: "Buku Terdaftar", tone: "bg-[#e7efe8] text-primary" },
        { icon: Library, value: counts.AVAILABLE, unit: "Buku", label: "Tersedia", tone: "bg-[#c9ecd6] text-primary" },
        { icon: Lock, value: counts.RESERVED, unit: "Buku", label: "Dipesan", tone: "bg-[#fbe7c6] text-[#7a4b00]" },
        { icon: EyeOff, value: counts.UNAVAILABLE, unit: "Buku", label: "Tidak Ditawarkan", tone: "bg-[#f1f0ea] text-foreground" },
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
                <Link href="/books" className="flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                    <Plus aria-hidden="true" className="size-4" /> Tambah Buku
                </Link>
            </header>

            <dl className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {stats.map(({ icon: Icon, value, unit, label, tone }) => (
                    <div key={label} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
                        <span aria-hidden="true" className={`flex size-10 items-center justify-center rounded-lg ${tone}`}><Icon className="size-5" /></span>
                        <div className="flex flex-col-reverse">
                            <dt className="text-sm">{label}</dt>
                            <dd><span className="font-heading text-xl font-semibold">{value}</span> <span className="text-xs text-muted-foreground">{unit}</span></dd>
                        </div>
                    </div>
                ))}
            </dl>

            <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                    {filters.map((item) => (
                        <Link
                            key={item.value}
                            href={hrefFor(item.value)}
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
                <form action="/my-listings" method="get" role="search" className="flex md:w-72">
                    {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
                    <label className="flex h-10 w-full items-center gap-2 rounded-lg border border-input px-3 focus-within:ring-2 focus-within:ring-ring/30">
                        <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        <span className="sr-only">Cari judul atau penulis</span>
                        <input name="q" type="search" maxLength={100} defaultValue={query} placeholder="Cari judul atau penulis..." className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                    </label>
                </form>
            </div>

            {visible.length > 0 ? (
                <ul className="mt-4 flex list-none flex-col gap-4 p-0">
                    {visible.map((listing) => {
                        const status = statusBadge[listing.availability];
                        return (
                            <li key={listing.id} className="rounded-xl border border-border bg-card p-4">
                                <div className="grid gap-4 sm:grid-cols-[64px_1fr] lg:grid-cols-[64px_1fr_240px_auto] lg:items-center">
                                    <span aria-hidden="true" className="flex h-20 w-16 items-center justify-center overflow-hidden rounded bg-primary text-primary-foreground">
                                        {listing.book.coverUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={listing.book.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
                                        ) : <BookOpen className="size-5 opacity-70" />}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            {listing.book.categories[0] && <span className="rounded bg-[#f1f0ea] px-2 py-0.5 font-semibold text-foreground/80">{listing.book.categories[0]}</span>}
                                            {listing.book.publishedAt}
                                        </p>
                                        <h2 className="mt-1 font-heading text-lg font-semibold">
                                            <Link href={`/books/${listing.book.id}`} className="hover:underline">{listing.book.title}</Link>
                                        </h2>
                                        <p className="text-sm text-muted-foreground">{listing.book.authors.join(", ") || "Penulis belum tercatat"}</p>
                                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                            {listing.availability === "UNAVAILABLE" ? (
                                                <><EyeOff aria-hidden="true" className="size-3.5" /> Tidak muncul di halaman buku publik</>
                                            ) : (
                                                <><MapPin aria-hidden="true" className="size-3.5" /> {listing.publicLocation ? `Titik temu: ${listing.publicLocation}` : "Lokasi publik belum diisi"}</>
                                            )}
                                        </p>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        <p className="flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full px-2.5 py-0.5 font-semibold ${status.className}`}>{status.label}</span>
                                            {status.note}
                                        </p>
                                        <p className="mt-1">Kondisi: {conditionLabels[listing.condition] ?? listing.condition}</p>
                                    </div>
                                    <BookListingAvailability listingId={listing.id} initialAvailability={listing.availability} />
                                </div>
                                <BookListingEditor
                                    listingId={listing.id}
                                    initialCondition={listing.condition}
                                    initialLocation={listing.publicLocation}
                                    initialRules={listing.borrowingRules}
                                />
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <section className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
                    <h2 className="font-heading text-xl font-semibold">{listings.length > 0 ? "Tidak ada buku yang cocok" : "Belum ada buku yang kamu bagikan"}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {listings.length > 0 ? "Ubah filter atau kata kunci pencarian." : "Pilih buku dari katalog, lalu tawarkan salinan yang kamu miliki dari halaman detailnya."}
                    </p>
                    {listings.length === 0 && (
                        <Link href="/books" className="mt-5 inline-flex rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Cari buku</Link>
                    )}
                </section>
            )}

            <section className="mt-8 flex gap-4 rounded-xl bg-[#e7efe8] p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-card text-primary"><ShieldCheck aria-hidden="true" className="size-5" /></span>
                <div>
                    <h2 className="font-heading text-lg font-semibold">Keamanan &amp; Etika Pinjam Buku</h2>
                    <p className="text-sm text-foreground/80">Cantumkan hanya lokasi publik umum, jangan alamat rumah. Lakukan serah terima di titik temu yang ramai.</p>
                </div>
            </section>
        </main>
    );
}
