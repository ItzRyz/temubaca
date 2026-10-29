import { ExternalLink, MapPin, Search, Settings2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { mergeHoldings } from "@/features/libraries/access";
import { HoldingBadge } from "@/features/libraries/components/holding-badge";
import { regionByCode } from "@/features/regions/regions";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata, siteUrl } from "@/config/site";
import { getCurrentUser } from "@/lib/auth";
import { findLibrary, isLibraryManager, listHoldingsForLibrary } from "@/lib/db/queries/libraries";
import { libraryIdParamSchema } from "@/lib/validation/schemas/library.schema";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ libraryId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function libraryFrom(params: PageProps["params"]) {
    const parsed = libraryIdParamSchema.safeParse(await params);
    return parsed.success ? findLibrary(parsed.data.libraryId) : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const library = await libraryFrom(params);
    if (!library) return { title: "Perpustakaan" };
    return pageMetadata({
        title: library.name,
        description: `Koleksi ${library.name}${library.publicLocation ? `, ${library.publicLocation}` : ""}, yang tercatat di TemuBaca, dan cara meminta akses buku.`,
        path: `/libraries/${library.id}`,
    });
}

/** One library: details, how to ask for access, and its collection (TB-023). */
export default async function LibraryPage({ params, searchParams }: PageProps) {
    const library = await libraryFrom(params);
    if (!library) notFound();
    const query = await searchParams;
    const q = typeof query.q === "string" ? query.q.trim().slice(0, 100) : "";
    const [user, rows] = await Promise.all([getCurrentUser(), listHoldingsForLibrary(library.id, q || undefined)]);
    const manages = user ? await isLibraryManager(user.id, library.id) : false;
    const now = new Date();
    // One row per book: the same merge as on the book page, keyed by book instead of library.
    const holdings = mergeHoldings(rows.map((row) => ({ ...row, libraryId: row.bookId })));

    return (
        <main className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6 sm:py-10">
            <JsonLd data={{
                "@context": "https://schema.org",
                "@type": "Library",
                name: library.name,
                url: new URL(`/libraries/${library.id}`, siteUrl).toString(),
                ...(library.publicLocation ? { address: library.publicLocation } : {}),
                ...(library.websiteUrl ? { sameAs: [library.websiteUrl] } : {}),
            }} />
            <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground"><Link href="/libraries" className="hover:underline">Perpustakaan</Link> / {library.name}</nav>
            <header className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="font-heading text-[30px] leading-tight font-semibold text-primary">{library.name}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">{[library.publicLocation, regionByCode(library.regionCode)?.name].filter(Boolean).join(" · ")}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
                        {library.placeId && <Link href={`/map?tempat=${library.placeId}`} className="flex items-center gap-1 text-primary hover:underline"><MapPin aria-hidden="true" className="size-4" /> Lihat di Peta Literasi</Link>}
                        {library.catalogUrl && <a href={library.catalogUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">Katalog resmi <ExternalLink aria-hidden="true" className="size-3.5" /><span className="sr-only"> (tab baru)</span></a>}
                        {library.websiteUrl && <a href={library.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">Situs web <ExternalLink aria-hidden="true" className="size-3.5" /><span className="sr-only"> (tab baru)</span></a>}
                    </div>
                </div>
                {manages && <Link href={`/libraries/${library.id}/manage`} className="flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted"><Settings2 aria-hidden="true" className="size-4" /> Kelola perpustakaan</Link>}
            </header>

            <section aria-labelledby="access-title" className="mt-6 rounded-xl border border-border bg-card p-5">
                <h2 id="access-title" className="font-heading text-lg font-semibold">Cara mengakses</h2>
                {library.accessEnabled ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                        Buka buku dari koleksi di bawah, lalu tekan <strong>Ajukan Akses</strong>. Bila diterima, ambil buku dalam {library.pickupDays} hari.
                        {library.accessRules ? ` Aturan perpustakaan: ${library.accessRules}` : ""}
                    </p>
                ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Perpustakaan ini belum menerima pengajuan lewat TemuBaca. Datang langsung atau periksa katalog resminya.</p>
                )}
            </section>

            <section aria-labelledby="collection-title" className="mt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 id="collection-title" className="font-heading text-xl font-semibold">Koleksi yang tercatat</h2>
                    <form action={`/libraries/${library.id}`} method="get" role="search" className="flex gap-2 sm:w-96">
                        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input px-3 focus-within:ring-2 focus-within:ring-ring">
                            <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                            <span className="sr-only">Cari judul atau penulis</span>
                            <input name="q" type="search" maxLength={100} defaultValue={q} placeholder="Cari judul atau penulis" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" />
                        </label>
                        <button type="submit" className="h-11 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/5">Cari</button>
                    </form>
                </div>
                {holdings.length === 0 ? (
                    <p className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                        {q ? "Tidak ada buku yang cocok." : "Belum ada buku yang tercatat untuk perpustakaan ini di TemuBaca."}
                    </p>
                ) : (
                    <ul className="mt-4 flex list-none flex-col gap-3 p-0">
                        {holdings.map((holding) => (
                            <li key={holding.bookId} className="rounded-xl border border-border bg-card p-4">
                                <Link href={`/books/${holding.book.id}`} className="font-semibold hover:underline">{holding.book.title}</Link>
                                <p className="text-sm text-muted-foreground">{holding.book.authors.join(", ")}{holding.callNumber ? ` · ${holding.callNumber}` : ""}</p>
                                <div className="mt-2"><HoldingBadge holding={holding} now={now} /></div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </main>
    );
}
