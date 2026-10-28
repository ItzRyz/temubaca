import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CreateLibraryForm, LibraryEditForm, LibraryManagersForm } from "@/features/libraries/components/admin-library-forms";
import { HoldingBadge } from "@/features/libraries/components/holding-badge";
import { HoldingForm } from "@/features/libraries/components/holding-form";
import { RemoveHoldingButton } from "@/features/libraries/components/remove-holding-button";
import { regionByCode } from "@/features/regions/regions";
import { listHoldingsForLibrary, listLibrariesForAdmin, listLibraryPlacesWithoutLibrary } from "@/lib/db/queries/libraries";
import { isOneSearchEnabled } from "@/lib/external/libraries/onesearch";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Perpustakaan" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** TB-023 / DEC-13: libraries, their managers, curated holdings, and the OneSearch switch. */
export default async function AdminLibrariesPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const [libraries, places] = await Promise.all([listLibrariesForAdmin(), listLibraryPlacesWithoutLibrary()]);
    const selected = libraries.find((library) => library.id === params.edit) ?? null;
    const curated = selected ? (await listHoldingsForLibrary(selected.id)).filter((holding) => holding.source === "CURATED") : [];
    const now = new Date();

    return (
        <main className="px-4 py-8 sm:px-8 sm:py-10">
            <header>
                <h1 className="font-heading text-[28px] leading-tight font-semibold text-primary sm:text-[34px]">Perpustakaan</h1>
                <p className="mt-2 max-w-3xl text-base text-muted-foreground">
                    Perpustakaan yang tampil di TemuBaca, pengelolanya, dan koleksi yang dicatat admin. Koleksi juga datang dari pengelola perpustakaan dan, bila diaktifkan, Indonesia OneSearch. Setiap perubahan tercatat di jejak audit.
                </p>
            </header>
            <p className="mt-4 flex gap-2 rounded-lg bg-[#f1f0ea] px-4 py-3 text-sm text-muted-foreground">
                <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {isOneSearchEnabled()
                    ? "OneSearch aktif: halaman buku mengecek OneSearch paling sering sekali per 30 hari per buku, untuk perpustakaan yang nama institusinya diisi."
                    : "OneSearch belum aktif (ONESEARCH_ENABLED). Aktifkan hanya setelah ada izin tertulis Perpusnas."}
            </p>

            <section aria-labelledby="create-title" className="mt-6 rounded-xl border border-border bg-card p-6">
                <h2 id="create-title" className="font-heading text-xl font-semibold">Tambah dari Peta Literasi</h2>
                <div className="mt-3"><CreateLibraryForm places={places} /></div>
            </section>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <section aria-labelledby="list-title">
                    <h2 id="list-title" className="font-heading text-xl font-semibold">Semua perpustakaan ({libraries.length})</h2>
                    <ul className="mt-4 flex list-none flex-col gap-3 p-0">
                        {libraries.map((library) => (
                            <li key={library.id} className={cn("rounded-xl border bg-card p-4", selected?.id === library.id ? "border-primary" : "border-border")}>
                                <p className="text-xs font-semibold text-muted-foreground">
                                    {library.hiddenAt ? "Disembunyikan" : library.accessEnabled ? "Menerima pengajuan" : "Belum menerima pengajuan"} · {regionByCode(library.regionCode)?.name ?? "Wilayah belum tercatat"}
                                </p>
                                <p className="mt-1 font-semibold">{library.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {library.holdings} catatan koleksi · {library.openRequests} pengajuan berjalan · Pengelola: {library.managers.map((manager) => manager.displayName).join(", ") || "belum ada"}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold">
                                    <Link href={`/admin/libraries?edit=${library.id}`} className="text-primary hover:underline">Ubah<span className="sr-only">: {library.name}</span></Link>
                                    <Link href={`/libraries/${library.id}`} className="text-primary hover:underline">Halaman publik</Link>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>

                {selected ? (
                    <section aria-labelledby="edit-title" className="flex h-fit flex-col gap-6 rounded-xl border border-border bg-card p-6">
                        <div>
                            <h2 id="edit-title" className="font-heading text-xl font-semibold">Ubah {selected.name}</h2>
                            <Link href="/admin/libraries" className="text-sm font-semibold text-primary hover:underline">Tutup</Link>
                            <div className="mt-4"><LibraryEditForm key={selected.id} library={selected} /></div>
                        </div>
                        <div>
                            <h3 className="font-heading text-base font-semibold">Pengelola</h3>
                            <p className="mt-1 text-xs text-muted-foreground">Pengelola menjawab pengajuan, mencatat koleksi, dan mengatur akses. Akun yang ditangguhkan tidak dapat ditunjuk.</p>
                            <div className="mt-3"><LibraryManagersForm libraryId={selected.id} managers={selected.managers} /></div>
                        </div>
                        <div>
                            <h3 className="font-heading text-base font-semibold">Koleksi dicatat admin</h3>
                            <p className="mt-1 text-xs text-muted-foreground">Hanya &quot;tercatat di koleksi&quot;: admin tidak melihat rak, jadi status eksemplar dicatat pengelola.</p>
                            <div className="mt-3"><HoldingForm endpoint={`/api/admin/libraries/${selected.id}/holdings`} kind="curated" /></div>
                            <ul className="mt-4 flex list-none flex-col gap-2 p-0">
                                {curated.map((holding) => (
                                    <li key={holding.bookId} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold">{holding.book.title}</p>
                                            <HoldingBadge holding={holding} now={now} />
                                        </div>
                                        <RemoveHoldingButton endpoint={`/api/admin/libraries/${selected.id}/holdings`} bookId={holding.bookId} bookTitle={holding.book.title} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </section>
                ) : (
                    <p className="h-fit rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">Pilih &quot;Ubah&quot; pada perpustakaan untuk mengatur data, pengelola, dan koleksinya.</p>
                )}
            </div>
        </main>
    );
}
