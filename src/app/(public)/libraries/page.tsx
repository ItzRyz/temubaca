import { BookOpen, Library, MapPin, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { provinceOptions, regionByCode } from "@/features/regions/regions";
import { listLibraries } from "@/lib/db/queries/libraries";
import { listingRobots, pageMetadata } from "@/config/site";
import { LIBRARY_ACCESS_REQUESTS_OPEN } from "@/features/libraries/access";

/** Canonical without a query; searches, filters and later pages stay out of the index (SEO, 29 Okt 2026). */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
    return { ...pageMetadata({ title: "Perpustakaan", description: "Perpustakaan di TemuBaca, koleksi yang tercatat, dan cara mengajukan akses buku.", path: "/libraries" }), robots: listingRobots(await searchParams) };
}
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Libraries readers can find books at (TB-023). Collections are labelled by how they are known (DEC-13). */
export default async function LibrariesPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
    const provinces = provinceOptions();
    const province = typeof params.provinsi === "string" && provinces.some((item) => item.code === params.provinsi) ? params.provinsi : "";
    const libraries = await listLibraries({ q: q || undefined, region: province || undefined });

    return (
        <main className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6 sm:py-10">
            <header>
                <p className="text-sm font-semibold tracking-[0.16em] text-primary uppercase">Akses buku</p>
                <h1 className="mt-2 font-heading text-[32px] leading-tight font-semibold text-primary">Perpustakaan</h1>
                <p className="mt-2 max-w-2xl text-base text-muted-foreground">
                    Lihat buku yang tercatat di koleksi perpustakaan, lalu datang langsung ke perpustakaannya; TemuBaca tidak melayani peminjaman dari perpustakaan.
                    &quot;Tercatat di koleksi&quot; berarti buku pernah dicatat, belum tentu sedang ada di rak; status &quot;Tersedia&quot; hanya dari pengelola perpustakaan.
                </p>
            </header>

            <form action="/libraries" method="get" role="search" className="mt-6 flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row">
                <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input px-3 focus-within:ring-2 focus-within:ring-ring">
                    <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    <span className="sr-only">Cari nama atau alamat</span>
                    <input name="q" type="search" maxLength={100} defaultValue={q} placeholder="Cari nama atau alamat perpustakaan" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                </label>
                <label className="sr-only" htmlFor="provinsi">Provinsi</label>
                <select id="provinsi" name="provinsi" defaultValue={province} className="h-11 rounded-lg border border-input bg-transparent px-3 text-sm sm:w-56">
                    <option value="">Semua provinsi</option>
                    {provinces.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                </select>
                <button type="submit" className="h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Cari</button>
            </form>

            {libraries.length === 0 ? (
                <p className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    {q || province ? "Tidak ada perpustakaan yang cocok." : "Belum ada perpustakaan terdaftar."}
                </p>
            ) : (
                <ul className="mt-6 grid list-none gap-4 p-0 md:grid-cols-2">
                    {libraries.map((library) => (
                        <li key={library.id} className="flex flex-col rounded-xl border border-border bg-card p-5">
                            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <Library aria-hidden="true" className="size-3.5" /> {regionByCode(library.regionCode)?.name ?? "Wilayah belum tercatat"}
                                {LIBRARY_ACCESS_REQUESTS_OPEN && library.accessEnabled && <span className="rounded-full bg-[#c9ecd6] px-2 py-0.5 font-semibold text-primary">Menerima pengajuan</span>}
                            </p>
                            <h2 className="mt-1.5 font-heading text-lg font-semibold">
                                <Link href={`/libraries/${library.id}`} className="hover:underline">{library.name}</Link>
                            </h2>
                            {library.publicLocation && <p className="text-sm text-muted-foreground">{library.publicLocation}</p>}
                            <p className="mt-3 flex items-center gap-1.5 text-sm"><BookOpen aria-hidden="true" className="size-4" /> {library.holdings} judul tercatat di TemuBaca</p>
                            <div className="mt-auto flex flex-wrap gap-3 pt-4 text-sm font-semibold">
                                <Link href={`/libraries/${library.id}`} className="text-primary hover:underline">Lihat koleksi</Link>
                                {library.placeId && <Link href={`/map?tempat=${library.placeId}`} className="flex items-center gap-1 text-primary hover:underline"><MapPin aria-hidden="true" className="size-3.5" /> Lihat di Peta Literasi</Link>}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}
