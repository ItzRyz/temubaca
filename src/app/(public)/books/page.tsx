import { PlusCircle, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BookResultCard } from "@/features/books/components/book-result-card";
import { CatalogFilters } from "@/features/books/components/catalog-filters";
import { CatalogPagination } from "@/features/books/components/catalog-pagination";
import { browseBooks, listBookFacets } from "@/lib/db/queries/books";
import { bookBrowseQuerySchema } from "@/lib/validation/schemas/book.schema";

export const metadata: Metadata = {
    title: "Jelajahi buku",
    description: "Cari buku berdasarkan judul, penulis, ISBN, atau kategori dan lihat salinan yang dibagikan warga.",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type BooksPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleValue(value: string | string[] | undefined) {
    return typeof value === "string" ? value : undefined;
}

export default async function BooksPage({ searchParams }: BooksPageProps) {
    const params = await searchParams;
    const parsed = bookBrowseQuerySchema.safeParse({
        q: singleValue(params.q),
        category: singleValue(params.category),
        language: singleValue(params.language),
        page: singleValue(params.page),
    });
    const filters = parsed.success ? parsed.data : { page: 1, q: undefined, category: undefined, language: undefined };
    const [{ items, total }, facets] = await Promise.all([
        browseBooks(filters, PAGE_SIZE, (filters.page - 1) * PAGE_SIZE),
        listBookFacets(),
    ]);
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const hrefFor = (page: number) => {
        const search = new URLSearchParams();
        if (filters.q) search.set("q", filters.q);
        if (filters.category) search.set("category", filters.category);
        if (filters.language) search.set("language", filters.language);
        if (page > 1) search.set("page", String(page));
        const query = search.toString();
        return query ? `/books?${query}` : "/books";
    };

    return (
        <main className="mx-auto w-full max-w-[1256px] px-4 py-8 sm:px-6">
            <h1 className="sr-only">Jelajahi buku</h1>
            <form action="/books" method="get" role="search" className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 sm:flex-row">
                <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-lg bg-[#f1f0ea] px-4 focus-within:ring-2 focus-within:ring-ring/30">
                    <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    <span className="sr-only">Judul, penulis, ISBN, atau kategori</span>
                    <input
                        name="q"
                        type="search"
                        defaultValue={filters.q ?? ""}
                        placeholder="Cari judul, penulis, atau ISBN..."
                        maxLength={200}
                        className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                </label>
                {filters.category && <input type="hidden" name="category" value={filters.category} />}
                {filters.language && <input type="hidden" name="language" value={filters.language} />}
                <button type="submit" className="flex h-12 items-center justify-center gap-1.5 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    <Search aria-hidden="true" className="size-4" /> Cari
                </button>
            </form>
            {!parsed.success && (
                <p role="alert" className="mt-3 text-sm text-destructive">Parameter pencarian tidak valid; menampilkan katalog tanpa filter.</p>
            )}

            <div aria-live="polite" className="mt-5 rounded-xl bg-[#f1f0ea] px-4 py-3 text-sm">
                <span className="font-semibold text-primary">{total} {filters.q ? "hasil" : "buku"}</span>{" "}
                {filters.q ? <>untuk <span className="font-heading text-base font-semibold">&ldquo;{filters.q}&rdquo;</span></> : "di katalog TemuBaca"}
                {(filters.category || filters.language) && (
                    <span className="text-muted-foreground"> · {[filters.category, filters.language].filter(Boolean).join(" · ")}</span>
                )}
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[245px_1fr]">
                <CatalogFilters
                    q={filters.q}
                    category={filters.category}
                    language={filters.language}
                    categories={facets.categories}
                    languages={facets.languages}
                />
                <section aria-label="Hasil katalog" className="flex flex-col gap-4">
                    {items.length > 0 ? (
                        <ul className="flex list-none flex-col gap-4 p-0">
                            {items.map((book) => (
                                <li key={book.id}><BookResultCard book={book} /></li>
                            ))}
                        </ul>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
                            <h2 className="font-heading text-lg font-semibold">Belum ada buku yang cocok</h2>
                            <p className="mt-2 text-sm text-muted-foreground">Coba judul, nama penulis, atau filter lain.</p>
                        </div>
                    )}
                    <CatalogPagination page={filters.page} totalPages={totalPages} hrefFor={hrefFor} />
                </section>
            </div>

            <section className="mt-12 flex flex-col gap-6 rounded-3xl bg-primary p-6 text-primary-foreground sm:p-8 md:flex-row md:items-center md:justify-between">
                <div className="max-w-2xl">
                    <h2 className="font-heading text-2xl leading-tight font-bold sm:text-[32px]">Tidak menemukan bukumu? Katalog kami belum lengkap untuk buku Indonesia.</h2>
                    <p className="mt-3 text-sm text-primary-foreground/80">Kamu bisa mendaftarkan salinan koleksimu pada halaman buku agar dapat dipinjam warga.</p>
                </div>
                <Link href="/my-listings" className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-card px-5 py-3 text-sm font-semibold text-primary hover:bg-card/90">
                    <PlusCircle aria-hidden="true" className="size-4" /> Bagikan bukumu
                </Link>
            </section>
        </main>
    );
}
