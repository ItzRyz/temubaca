import { ArrowRight, Bookmark, BookOpen, Info, Library, Search, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/login-redirect";
import { listSavedBooks } from "@/lib/db/queries/bookmarks";
import { listGenreFacets } from "@/lib/db/queries/books";
import { listUserInterests } from "@/lib/db/queries/interests";
import { getBookRecommendations } from "@/features/recommendations/queries";
import { BookmarkButton } from "@/features/bookmarks/components/bookmark-button";
import { ClearDataDialog } from "@/features/bookmarks/components/clear-data-dialog";
import { DeleteAccountDialog } from "@/features/account-deletion/components/delete-account-dialog";
import { getDeletionOverview } from "@/lib/db/queries/account-deletion";
import { InterestManager } from "@/features/recommendations/components/interest-manager";
import { cn } from "@/lib/utils";
import { primaryGenreLabel } from "@/features/books/genres";

export const metadata: Metadata = { title: "Bookmark & minat baca" };

type BookmarksPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const tabs = [
    { value: "saved", label: "Buku Disimpan" },
    { value: "interests", label: "Minat & Preferensi" },
    { value: "data", label: "Kendali Data Saya" },
] as const;
type Tab = (typeof tabs)[number]["value"];

const savedFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" });

function single(value: string | string[] | undefined) {
    return typeof value === "string" ? value : undefined;
}

export default async function BookmarksPage({ searchParams }: BookmarksPageProps) {
    const user = await getCurrentUser();
    if (!user) return redirectToLogin();

    const params = await searchParams;
    const tab: Tab = tabs.some((item) => item.value === params.tab) ? (params.tab as Tab) : "saved";
    const availableOnly = single(params.filter) === "available";
    const query = (single(params.q) ?? "").trim().slice(0, 100);

    const [saved, interests] = await Promise.all([listSavedBooks(user.id), listUserInterests(user.id)]);
    // Only the Minat tab needs catalog categories and recommendations.
    const deletion = tab === "data" ? await getDeletionOverview(user.id) : null;
    const [facets, recommendations] = tab === "interests"
        ? await Promise.all([listGenreFacets(), getBookRecommendations(user.id)])
        : [null, null];
    const availableCount = saved.filter((book) => book.availableCopies > 0).length;
    const needle = query.toLocaleLowerCase("id-ID");
    const visible = saved.filter((book) =>
        (!availableOnly || book.availableCopies > 0) &&
        (!needle || book.title.toLocaleLowerCase("id-ID").includes(needle) || book.authors.some((author) => author.toLocaleLowerCase("id-ID").includes(needle))),
    );

    const hrefFor = (next: { tab?: Tab; filter?: string }) => {
        const search = new URLSearchParams();
        const nextTab = next.tab ?? tab;
        if (nextTab !== "saved") search.set("tab", nextTab);
        if (nextTab === "saved" && next.filter) search.set("filter", next.filter);
        if (nextTab === "saved" && query) search.set("q", query);
        const value = search.toString();
        return value ? `/bookmarks?${value}` : "/bookmarks";
    };

    const stats = [
        { icon: Bookmark, value: saved.length, unit: "Buku", label: "Buku Disimpan", tone: "bg-[#e7efe8] text-primary" },
        { icon: Library, value: availableCount, unit: "Buku", label: "Ada salinan warga", tone: "bg-[#c9ecd6] text-primary" },
        { icon: Sparkles, value: interests.length, unit: "Minat", label: "Minat Terpilih", tone: "bg-[#f1f0ea] text-foreground" },
    ];

    return (
        <main className="mx-auto w-full max-w-[1256px] px-4 py-8 sm:px-6 sm:py-10">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="font-heading text-[32px] leading-tight font-semibold text-primary">Bookmark &amp; Minat Baca</h1>
                    <p className="mt-1 text-base text-muted-foreground">Kelola buku yang kamu simpan dan atur minat bacaan agar rekomendasi makin pas.</p>
                </div>
                <Link href="/books" className="flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                    <Search aria-hidden="true" className="size-4" /> Cari Buku
                </Link>
            </header>

            <nav aria-label="Bagian bookmark" className="mt-8 flex gap-6 overflow-x-auto border-b border-border [scrollbar-width:none]">
                {tabs.map((item) => (
                    <Link
                        key={item.value}
                        href={hrefFor({ tab: item.value })}
                        aria-current={tab === item.value ? "page" : undefined}
                        className={cn(
                            "-mb-px border-b-2 px-0.5 pb-3 text-sm font-semibold whitespace-nowrap",
                            tab === item.value ? "border-primary text-primary" : "border-transparent text-foreground/80 hover:text-foreground",
                        )}
                    >
                        {item.label}
                    </Link>
                ))}
            </nav>

            <dl className="mt-8 grid gap-4 sm:grid-cols-3">
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

            {tab === "saved" && (
                <section aria-label="Buku disimpan" className="mt-6">
                    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex gap-2">
                            {[
                                { filter: undefined, label: `Semua (${saved.length})`, active: !availableOnly },
                                { filter: "available", label: `Ada salinan (${availableCount})`, active: availableOnly },
                            ].map((chip) => (
                                <Link
                                    key={chip.label}
                                    href={hrefFor({ filter: chip.filter })}
                                    aria-current={chip.active ? "true" : undefined}
                                    className={cn(
                                        "rounded-lg border px-4 py-2 text-sm font-semibold",
                                        chip.active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
                                    )}
                                >
                                    {chip.label}
                                </Link>
                            ))}
                        </div>
                        <form action="/bookmarks" method="get" role="search" className="flex md:w-72">
                            {availableOnly && <input type="hidden" name="filter" value="available" />}
                            <label className="flex h-11 w-full items-center gap-2 rounded-lg border border-input px-3 focus-within:ring-2 focus-within:ring-ring/30">
                                <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                                <span className="sr-only">Cari judul atau penulis</span>
                                <input name="q" type="search" maxLength={100} defaultValue={query} placeholder="Cari judul atau penulis..." className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                            </label>
                        </form>
                    </div>

                    {visible.length > 0 ? (
                        <ul className="mt-4 flex list-none flex-col gap-4 p-0">
                            {visible.map((book) => (
                                <li key={book.bookmarkId} className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-[64px_1fr] md:grid-cols-[64px_1fr_220px_auto] md:items-center">
                                    <div aria-hidden="true" className="flex h-20 w-16 items-center justify-center overflow-hidden rounded bg-primary text-primary-foreground">
                                        {book.coverUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={book.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
                                        ) : (
                                            <BookOpen className="size-5 opacity-70" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            {primaryGenreLabel(book.categories) && <span className="rounded bg-[#f1f0ea] px-2 py-0.5 font-semibold text-foreground/80">{primaryGenreLabel(book.categories)}</span>}
                                            {book.publisher && <span>{book.publisher}</span>}
                                        </div>
                                        <h2 className="mt-1 font-heading text-lg font-semibold">
                                            <Link href={`/books/${book.id}`} className="hover:underline">{book.title}</Link>
                                        </h2>
                                        <p className="text-sm text-muted-foreground">{book.authors.join(", ") || "Penulis belum tercatat"}</p>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {book.availableCopies > 0 ? (
                                            <p className="inline-flex rounded-full bg-[#c9ecd6] px-2.5 py-0.5 font-semibold text-primary">{book.availableCopies} salinan warga</p>
                                        ) : (
                                            <p className="inline-flex items-center gap-1"><Info aria-hidden="true" className="size-3.5" /> Belum ada salinan warga</p>
                                        )}
                                        <p className="mt-1">Disimpan {savedFormatter.format(book.savedAt)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link href={`/books/${book.id}`} className={cn(
                                            "flex h-10 items-center rounded-lg px-4 text-sm font-semibold",
                                            book.availableCopies > 0 ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border hover:bg-muted",
                                        )}>
                                            {book.availableCopies > 0 ? "Lihat Akses" : "Lihat Detail"}
                                        </Link>
                                        <BookmarkButton
                                            bookId={book.id}
                                            isAuthenticated
                                            initiallyBookmarked
                                            className="flex h-10 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
                            <h2 className="font-heading text-lg font-semibold">{saved.length > 0 ? "Tidak ada buku yang cocok" : "Belum ada buku tersimpan"}</h2>
                            <p className="mt-2 text-sm text-muted-foreground">{saved.length > 0 ? "Ubah filter atau kata kunci pencarian." : "Simpan buku dari halaman detail untuk menemukannya kembali di sini."}</p>
                        </div>
                    )}
                </section>
            )}

            {tab === "interests" && (
                <section aria-label="Minat dan preferensi">
                    <InterestManager
                        interests={interests.map(({ id, subject }) => ({ id, subject }))}
                        suggestions={(facets ?? []).map((facet) => ({ slug: facet.value, label: facet.label }))}
                    />

                    <section aria-labelledby="prefs-title" className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
                        <h2 id="prefs-title" className="font-heading text-xl font-semibold">Preferensi Rekomendasi</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Cara TemuBaca memakai data Anda saat ini.</p>
                        <ul className="mt-4 flex list-none flex-col divide-y divide-border border-t border-border p-0 text-sm">
                            <li className="flex gap-3 py-3"><Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><span><span className="block font-medium">Minat dicocokkan dengan genre buku</span><span className="text-xs text-muted-foreground">Buku yang cocok dengan lebih banyak minat Anda diurutkan lebih dulu.</span></span></li>
                            <li className="flex gap-3 py-3"><Bookmark aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><span><span className="block font-medium">Buku yang sudah disimpan tidak direkomendasikan ulang</span><span className="text-xs text-muted-foreground">Pengaturan memakai bookmark sebagai sinyal rekomendasi belum tersedia.</span></span></li>
                            <li className="flex gap-3 py-3"><Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span><span className="block font-medium">Lokasi tidak dipakai</span><span className="text-xs text-muted-foreground">Rekomendasi berbasis lokasi umum menunggu kebijakan lokasi (DEC-07).</span></span></li>
                        </ul>
                    </section>

                    <section aria-labelledby="recs-title" className="mt-8">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div>
                                <h2 id="recs-title" className="font-heading text-xl font-semibold">Rekomendasi untuk Anda</h2>
                                <p className="text-sm text-muted-foreground">{recommendations?.fallback ? "Belum ada buku yang cocok dengan minat Anda; berikut pilihan dari katalog." : "Beginilah minat Anda dipakai."}</p>
                            </div>
                            <Link href="/recommendations" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary hover:underline">
                                Lihat semua rekomendasi <ArrowRight aria-hidden="true" className="size-3.5" />
                            </Link>
                        </div>
                        {recommendations && recommendations.items.length > 0 ? (
                            <ul className="mt-4 grid list-none gap-4 p-0 md:grid-cols-3">
                                {recommendations.items.slice(0, 3).map((book) => (
                                    <li key={book.id} className="flex flex-col rounded-2xl border border-border bg-card p-4">
                                        <div className="flex gap-4">
                                            <span aria-hidden="true" className="flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-[#f1f0ea] text-primary">
                                                {book.coverUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={book.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
                                                ) : <BookOpen className="size-5" />}
                                            </span>
                                            <div className="min-w-0">
                                                <h3 className="line-clamp-2 font-heading text-base font-semibold">{book.title}</h3>
                                                <p className="truncate text-sm text-muted-foreground">{book.authors.join(", ") || "Penulis belum tercatat"}</p>
                                                {!recommendations.fallback && book.matched[0] && (
                                                    <p className="mt-1 inline-flex rounded bg-[#ebe9e1] px-2 py-0.5 text-[11px] font-semibold">Karena minat: {book.matched[0]}</p>
                                                )}
                                            </div>
                                        </div>
                                        <Link href={`/books/${book.id}`} className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                                            Lihat Buku<span className="sr-only">: {book.title}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">Katalog belum berisi buku untuk direkomendasikan.</p>
                        )}
                    </section>
                </section>
            )}

            {tab === "data" && (
                <section aria-labelledby="data-title" className="mt-6 rounded-xl border border-border bg-card p-6">
                    <h2 id="data-title" className="font-heading text-xl font-semibold">Kendali Data Saya</h2>
                    <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-foreground/85">
                        <li>Bookmark dan minat hanya terlihat olehmu dan dipakai untuk rekomendasi dasar di TemuBaca.</li>
                        <li>Hapus satu bookmark lewat tab Buku Disimpan dan satu minat lewat tab Minat &amp; Preferensi, atau hapus semuanya sekaligus di bawah ini.</li>
                        <li>Hapus akun menonaktifkan akun selama 14 hari (bisa dibatalkan), lalu menghapus data pribadi. Riwayat pinjam dan laporan yang menyangkut orang lain disimpan dengan nama &quot;Akun dihapus&quot;.</li>
                    </ul>
                    <ClearDataDialog bookmarkCount={saved.length} interestCount={interests.length} />
                    {deletion && (
                        <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5">
                            <h3 className="font-heading text-base font-semibold">Akun dan salinan data</h3>
                            <div className="flex flex-wrap gap-2">
                                <a href="/api/me/export" download className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted">Unduh salinan data saya</a>
                                {!user.deletionRequestedAt && <DeleteAccountDialog bookmarks={deletion.bookmarks} interests={deletion.interests} listings={deletion.listings} blockers={deletion.blockers} />}
                            </div>
                        </div>
                    )}
                </section>
            )}

            <section className="mt-10 flex flex-col gap-4 rounded-xl bg-[#e7efe8] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-card text-primary"><ShieldCheck aria-hidden="true" className="size-5" /></span>
                    <div>
                        <h2 className="font-heading text-lg font-semibold">Bookmark dan minatmu bersifat pribadi</h2>
                        <p className="text-sm text-foreground/80">Hanya kamu yang bisa melihat daftar ini. Datanya dipakai untuk rekomendasi dan bisa dihapus kapan saja.</p>
                    </div>
                </div>
                {tab !== "data" && (
                    <Link href={hrefFor({ tab: "data" })} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline">
                        Kendali Data Saya <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                )}
            </section>
        </main>
    );
}
