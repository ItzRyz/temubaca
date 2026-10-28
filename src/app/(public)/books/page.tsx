import { PlusCircle, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BookResultCard } from "@/features/books/components/book-result-card";
import { availabilityOptions, catalogHref, catalogParams, type CatalogState } from "@/features/books/catalog-url";
import { CatalogFilterBar } from "@/features/books/components/catalog-filter-bar";
import { CatalogPagination } from "@/features/books/components/catalog-pagination";
import { ExternalResultsSkeleton } from "@/features/catalog/components/external-results";
import { ExternalResultsSection } from "@/features/catalog/components/external-results-section";
import { getCurrentUser } from "@/lib/auth";
import { browseBooks, listBookFacets, listGenreFacets } from "@/lib/db/queries/books";
import { genreBySlug } from "@/features/books/genres";
import { languageLabel } from "@/lib/external/books/language";
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

/** Records keep a label ("Indonesia"); a few (seed data, old imports) keep an ISO code ("id"). */
function languageName(value: string) {
    return value.length <= 3 ? languageLabel(value) ?? value : value;
}

function singleValue(value: string | string[] | undefined) {
    return typeof value === "string" ? value : undefined;
}

export default async function BooksPage({ searchParams }: BooksPageProps) {
    const params = await searchParams;
    const parsed = bookBrowseQuerySchema.safeParse({
        q: singleValue(params.q),
        category: singleValue(params.category),
        language: singleValue(params.language),
        availability: singleValue(params.availability),
        sort: singleValue(params.sort),
        page: singleValue(params.page),
    });
    const filters = parsed.success ? parsed.data : { page: 1, q: undefined, category: undefined, language: undefined, availability: undefined, sort: undefined };
    const state: CatalogState = filters;
    const [{ items, total }, facets, genreFacets, user] = await Promise.all([
        browseBooks(filters, PAGE_SIZE, (filters.page - 1) * PAGE_SIZE),
        listBookFacets(),
        listGenreFacets(),
        getCurrentUser(),
    ]);
    const categoryLabel = genreBySlug(filters.category)?.label ?? filters.category;
    const languageText = filters.language ? languageName(filters.language) : undefined;
    const availabilityLabel = availabilityOptions.find((option) => option.value === filters.availability)?.label;
    // Open catalogs are searched on the first page of a text query only, to save provider quota.
    const externalQuery = filters.q && filters.q.trim().length >= 2 && filters.page === 1 ? filters.q.trim() : null;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const hrefFor = (page: number) => catalogHref(state, { page });

    return (
        <main className="mx-auto w-full max-w-[1256px] px-4 py-8 sm:px-6">
            <h1 className="sr-only">Jelajahi buku</h1>
            <form action="/books" method="get" role="search" className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 sm:flex-row">
                <label className="flex h-12 min-w-0 flex-none items-center gap-2 rounded-lg bg-[#f1f0ea] px-4 focus-within:ring-2 focus-within:ring-ring sm:flex-1">
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
                {/* A new search keeps the filters and order, and starts from the first page. */}
                {[...catalogParams(state, { q: undefined })].map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
                <button type="submit" className="flex h-12 items-center justify-center gap-1.5 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    <Search aria-hidden="true" className="size-4" /> Cari
                </button>
            </form>
            {!parsed.success && (
                <p role="alert" className="mt-3 text-sm text-destructive">Parameter pencarian tidak valid; menampilkan katalog tanpa filter.</p>
            )}

            <CatalogFilterBar state={state} categories={genreFacets} languages={facets.languages.map((facet) => ({ ...facet, label: languageName(facet.value) }))} />

            <div aria-live="polite" className="mt-5 rounded-xl bg-[#f1f0ea] px-4 py-3 text-sm">
                <span className="font-semibold text-primary">{total} {filters.q ? "hasil" : "buku"}</span>{" "}
                {filters.q ? <>untuk <span className="font-heading text-base font-semibold">&ldquo;{filters.q}&rdquo;</span></> : "di katalog TemuBaca"}
                {(filters.category || filters.language || availabilityLabel) && (
                    <span className="text-muted-foreground"> · {[categoryLabel, languageText, availabilityLabel].filter(Boolean).join(" · ")}</span>
                )}
            </div>

            <div className="mt-5">
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

            {externalQuery && (
                <Suspense fallback={<ExternalResultsSkeleton />}>
                    <ExternalResultsSection query={externalQuery} isAuthenticated={user !== null} returnTo={hrefFor(1)} />
                </Suspense>
            )}

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
