import { Clock, Eye, Pencil, Plus, Search, ShieldCheck, Tag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { MerchandiseRowMenu } from "@/features/community-management/components/row-actions";
import { maskWhatsapp } from "@/features/community-management/rules";
import { loadManageContext } from "@/features/community-management/server";
import { formatMerchandisePrice } from "@/features/merchandise/format";
import { listMerchandiseForManage } from "@/lib/db/queries/community-content";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Merchandise komunitas" };

const filters = { all: "Semua", AVAILABLE: "Tersedia", UNAVAILABLE: "Habis", HIDDEN: "Disembunyikan" } as const;
type Filter = keyof typeof filters;

/** Figma "Kelola Merchandise" (308:2665) with the empty state of 309:2665. */
export default async function ManageMerchandisePage({ params, searchParams }: PageProps<"/communities/[communityId]/manage/merchandise">) {
    const { communityId } = await params;
    const { can, community } = await loadManageContext(communityId);
    const query = await searchParams;
    const filter: Filter = typeof query.status === "string" && query.status in filters ? (query.status as Filter) : "all";
    const needle = (typeof query.q === "string" ? query.q : "").trim().slice(0, 100);
    const base = `/communities/${communityId}/manage/merchandise`;

    if (!can.manageContent) {
        return <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Merchandise dapat ditambahkan setelah komunitas terverifikasi.</p>;
    }

    const items = await listMerchandiseForManage(communityId);
    const stateOf = (item: (typeof items)[number]): Exclude<Filter, "all"> => (item.status !== "PUBLISHED" ? "HIDDEN" : item.availability === "AVAILABLE" ? "AVAILABLE" : "UNAVAILABLE");
    const counts = { all: items.length, AVAILABLE: 0, UNAVAILABLE: 0, HIDDEN: 0 } as Record<Filter, number>;
    for (const item of items) counts[stateOf(item)] += 1;
    const visible = items.filter((item) => (filter === "all" || stateOf(item) === filter) && (!needle || item.title.toLocaleLowerCase("id-ID").includes(needle.toLocaleLowerCase("id-ID"))));
    const contact = community.whatsappNumber ? `WhatsApp ${maskWhatsapp(community.whatsappNumber)}` : community.instagramHandle ? `Instagram @${community.instagramHandle}` : community.contactEmail ? `surel ${community.contactEmail}` : null;
    const hrefFor = (status: Filter) => {
        const search = new URLSearchParams();
        if (status !== "all") search.set("status", status);
        if (needle) search.set("q", needle);
        return search.size ? `${base}?${search}` : base;
    };
    const badge = { AVAILABLE: ["Tersedia", "bg-[#c9ecd6] text-primary"], UNAVAILABLE: ["Habis", "bg-[#e8ecf5] text-[#24365c]"], HIDDEN: ["Disembunyikan", "bg-[#ebe9e1] text-foreground/70"] } as const;

    return (
        <div className="flex flex-col gap-4">
            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h2 className="font-heading text-xl font-semibold text-primary">Merchandise Komunitas</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Item berstatus Tersedia atau Habis tampil di halaman komunitas dan daftar Merchandise Komunitas.</p>
                    </div>
                    <Link href={`${base}/new`} className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                        <Plus aria-hidden="true" className="size-4" /> Tambah Merchandise
                    </Link>
                </div>
                {items.length > 0 && (
                    <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap gap-2">
                            {(Object.keys(filters) as Filter[]).map((key) => (
                                <Link key={key} href={hrefFor(key)} aria-current={filter === key ? "true" : undefined}
                                    className={cn("rounded-lg border px-3 py-1.5 text-sm font-semibold", filter === key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                                    {filters[key]} ({counts[key]})
                                </Link>
                            ))}
                        </div>
                        <form action={base} method="get" role="search" className="flex gap-2 lg:w-72">
                            {filter !== "all" && <input type="hidden" name="status" value={filter} />}
                            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input px-3 focus-within:ring-2 focus-within:ring-ring/30">
                                <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                                <span className="sr-only">Cari nama merchandise</span>
                                <input name="q" type="search" maxLength={100} defaultValue={needle} placeholder="Cari nama merchandise..." className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" />
                            </label>
                        </form>
                    </div>
                )}
            </section>

            {items.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
                    <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-xl bg-[#e7efe8] text-primary"><Tag className="size-5" /></span>
                    <h3 className="mt-3 font-heading text-lg font-semibold">Belum ada merchandise</h3>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">Tambahkan tote bag, pin, atau zine buatan komunitas. Item akan tampil di halaman komunitas dan di bagian Merchandise Komunitas pada Beranda.</p>
                    <Link href={`${base}/new`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus aria-hidden="true" className="size-4" /> Tambah Merchandise Pertama</Link>
                </div>
            ) : visible.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Tidak ada merchandise yang cocok dengan filter ini.</p>
            ) : (
                <ul className="flex list-none flex-col gap-3 p-0">
                    {visible.map((item) => {
                        const state = stateOf(item);
                        return (
                            <li key={item.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
                                <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-[#f1efe6] text-muted-foreground"><Tag className="size-5" /></span>
                                <div className="min-w-0 flex-1">
                                    <p className="flex flex-wrap items-center gap-2">
                                        <span className="font-heading text-lg font-semibold">{item.title}</span>
                                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", badge[state][1])}>{badge[state][0]}</span>
                                    </p>
                                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                        {item.category && <span className="flex items-center gap-1"><Tag aria-hidden="true" className="size-3.5" /> {item.category}</span>}
                                        <span className="font-semibold text-foreground">{formatMerchandisePrice(item)}</span>
                                        {item.stockNote && <span className="flex items-center gap-1"><Clock aria-hidden="true" className="size-3.5" /> {item.stockNote}</span>}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <Link href={`${base}/${item.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:bg-muted"><Pencil aria-hidden="true" className="size-4" /> Ubah</Link>
                                    {item.status === "PUBLISHED" && (
                                        <Link href={`/merchandise/${item.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:bg-muted"><Eye aria-hidden="true" className="size-4" /> Lihat</Link>
                                    )}
                                    <MerchandiseRowMenu communityId={communityId} itemId={item.id} title={item.title} />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            <section className="flex gap-4 rounded-2xl bg-[#e7efe8] p-5">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary"><ShieldCheck className="size-5" /></span>
                <div>
                    <h2 className="font-heading text-base font-semibold">Transaksi terjadi langsung dengan komunitas</h2>
                    <p className="text-sm text-foreground/80">
                        TemuBaca tidak memproses pembayaran. Pembeli menghubungi Anda lewat kontak pembelian{contact ? ` di profil: ${contact}` : ", yang belum diisi di Profil Komunitas"}. Ubah kontak di Profil Komunitas.
                    </p>
                </div>
            </section>
        </div>
    );
}
