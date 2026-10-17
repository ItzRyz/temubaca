import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CatalogSettingsForm } from "@/features/settings/components/catalog-settings-form";
import { getCatalogSettings } from "@/lib/db/queries/settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pengaturan" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Sections from Figma 161:859. Only "Katalog Buku" has settings the app actually uses today. */
const sections = {
    catalog: { label: "Katalog Buku", pending: null },
    map: { label: "Peta & Lokasi", pending: "Penyedia peta, geocoding, dan kebijakan lokasi menunggu keputusan DEC-07." },
    moderation: { label: "Moderasi & Publikasi", pending: "Belum ada aturan moderasi yang dapat diatur. Keputusan tinjauan saat ini selalu dilakukan manual oleh admin di menu Peninjauan." },
    borrowing: { label: "Aturan Pinjam", pending: "Aturan pinjam mengikuti DEC-02 dan belum dapat diubah dari sini: lama pinjam 7/14/21/30 hari sesuai batas pemilik, konfirmasi serah terima dan pengembalian oleh kedua pihak, pengingat sekali per 24 jam, tanpa denda. Perpanjangan belum diputuskan." },
    retention: { label: "Retensi & Data", pending: "Retensi data, penghapusan akun, dan backup menunggu keputusan DEC-11." },
} as const;
type Section = keyof typeof sections;

const dateTime = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

export default async function AdminSettingsPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const requested = typeof params.section === "string" ? params.section : undefined;
    const section: Section = requested && requested in sections ? requested as Section : "catalog";
    const { settings, updatedAt, updatedByName } = await getCatalogSettings();
    const current = sections[section];

    return (
        <main className="px-4 py-8 sm:px-8 sm:py-10">
            <header>
                <h1 className="font-heading text-[28px] leading-tight font-semibold text-primary sm:text-[34px]">Pengaturan</h1>
                <p className="mt-2 max-w-2xl text-base text-muted-foreground">Atur sumber data, aturan platform, dan kebijakan moderasi. Setiap perubahan tercatat di jejak audit.</p>
            </header>

            <div className="mt-6 grid gap-6 lg:grid-cols-[232px_1fr]">
                <nav aria-label="Bagian pengaturan" className="h-fit min-w-0 rounded-xl border border-border bg-card p-3">
                    <ul className="flex list-none gap-1 overflow-x-auto p-0 [scrollbar-width:none] lg:flex-col">
                        {(Object.keys(sections) as Section[]).map((key) => (
                            <li key={key} className="shrink-0">
                                <Link href={key === "catalog" ? "/admin/settings" : `/admin/settings?section=${key}`} aria-current={section === key ? "page" : undefined}
                                    className={cn("flex h-10 items-center rounded-lg px-3 text-sm", section === key ? "bg-[#e7efe8] font-semibold text-primary" : "text-foreground hover:bg-muted")}>
                                    {sections[key].label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="min-w-0">
                    {current.pending ? (
                        <section aria-labelledby="section-title" className="rounded-xl border border-border bg-card p-6">
                            <h2 id="section-title" className="font-heading text-xl font-semibold">{current.label}</h2>
                            <p className="mt-3 flex gap-2 rounded-lg bg-[#f1f0ea] p-4 text-sm leading-6 text-muted-foreground">
                                <Info aria-hidden="true" className="mt-1 size-4 shrink-0" /> {current.pending}
                            </p>
                        </section>
                    ) : (
                        <>
                            <p className="mb-4 flex gap-2 rounded-lg bg-[#f1f0ea] px-4 py-3 text-sm text-muted-foreground">
                                <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                                Perubahan berlaku untuk seluruh pengguna setelah disimpan.
                                {updatedAt ? ` Terakhir diubah oleh ${updatedByName ?? "admin"} • ${dateTime.format(updatedAt)}.` : " Saat ini memakai pengaturan bawaan."}
                            </p>
                            <CatalogSettingsForm key={updatedAt?.toISOString() ?? "default"} initial={settings} />
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}
