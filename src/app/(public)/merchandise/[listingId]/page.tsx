import { ArrowLeft, ArrowRight, BadgeCheck, ChevronRight, HandHeart, Info, MapPin, MessageSquareText, ShieldCheck, ShoppingBag, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { getCurrentUser } from "@/lib/auth";
import { findPublicMerchandise, listPublicMerchandise } from "@/lib/db/queries/merchandise";
import { uuidSchema } from "@/lib/validation/common";
import { colorFor, initialsOf } from "@/features/communities/components/community-card";
import { formatMerchandisePrice, merchandiseAvailabilityLabels } from "@/features/merchandise/format";
import { ShareButton } from "@/features/books/components/share-button";
import { ReportForm } from "@/features/reports/components/report-form";

type MerchandisePageProps = {
    params: Promise<{ listingId: string }>;
};

export const dynamic = "force-dynamic";

const availabilityBadge = {
    AVAILABLE: "bg-[#c9ecd6] text-primary",
    RESERVED: "bg-[#fbe7c6] text-[#7a4b00]",
    UNAVAILABLE: "bg-muted text-muted-foreground",
} as const;

const steps = [
    "Buka profil komunitas dan cari agenda terdekat untuk bertemu pengurusnya.",
    "Konfirmasi ketersediaan, harga, dan cara pembayaran langsung dengan pengurus.",
    "Atur serah terima di ruang publik, misalnya saat acara komunitas.",
];

const ethics = [
    { icon: HandHeart, title: "Semangat Kesukarelaan", body: "Pengurus komunitas umumnya relawan. Beri waktu yang wajar untuk membalas pesan." },
    { icon: Wallet, title: "Kejelasan Pembayaran", body: "Pastikan tujuan pembayaran atas nama komunitas, bukan rekening pribadi yang mencurigakan." },
    { icon: MapPin, title: "Bertemu di Ruang Publik", body: "Pilih titik temu yang ramai dan aman untuk serah terima barang." },
];

const findListing = cache(async (listingId: string) => {
    const parsed = uuidSchema.safeParse(listingId);
    return parsed.success ? findPublicMerchandise(parsed.data) : null;
});

export async function generateMetadata({ params }: MerchandisePageProps): Promise<Metadata> {
    const listing = await findListing((await params).listingId);
    return listing ? { title: listing.title, description: listing.description?.slice(0, 160) ?? undefined } : {};
}

export default async function MerchandiseDetailPage({ params }: MerchandisePageProps) {
    const listing = await findListing((await params).listingId);
    if (!listing) notFound();

    const [related, user] = await Promise.all([
        listPublicMerchandise({ communityId: listing.communityId, limit: 4 }),
        getCurrentUser(),
    ]);
    const others = related.filter((item) => item.id !== listing.id).slice(0, 3);
    const communityHref = `/communities/${listing.communityId}`;

    return (
        <main className="mx-auto w-full max-w-[1256px] px-4 pb-8 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2 py-4 text-xs text-muted-foreground">
                <nav aria-label="Breadcrumb">
                    <ol className="flex list-none flex-wrap items-center gap-1 p-0">
                        <li><Link href="/communities" className="hover:text-foreground">Komunitas</Link></li>
                        <li aria-hidden="true"><ChevronRight className="size-3" /></li>
                        <li><Link href={communityHref} className="hover:text-foreground">{listing.communityName}</Link></li>
                        <li aria-hidden="true"><ChevronRight className="size-3" /></li>
                        <li><Link href="/merchandise" className="hover:text-foreground">Merchandise</Link></li>
                        <li aria-hidden="true"><ChevronRight className="size-3" /></li>
                        <li aria-current="page" className="max-w-56 truncate font-semibold text-foreground">{listing.title}</li>
                    </ol>
                </nav>
                <Link href={communityHref} className="flex items-center gap-1 font-semibold text-primary hover:underline">
                    <ArrowLeft aria-hidden="true" className="size-3.5" /> Kembali ke profil komunitas
                </Link>
            </div>

            <div className="mt-2 grid gap-6 lg:grid-cols-[1fr_440px]">
                <div className="flex min-w-0 flex-col gap-6">
                    <div aria-hidden="true" className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-[#f1f0ea] text-primary/40">
                        <ShoppingBag className="size-20" />
                    </div>
                    <p className="-mt-3 text-xs text-muted-foreground">Foto produk belum tersedia di TemuBaca.</p>
                </div>

                <div className="flex flex-col gap-6">
                    <section className="rounded-2xl border border-border bg-card p-5">
                        <Link href={communityHref} className="flex items-center gap-3 hover:underline">
                            <span aria-hidden="true" className={`flex size-10 items-center justify-center rounded-lg font-heading text-sm text-white ${colorFor(listing.communityId)}`}>
                                {initialsOf(listing.communityName)}
                            </span>
                            <span>
                                <span className="flex items-center gap-1.5 text-sm font-semibold">
                                    {listing.communityName}
                                    <BadgeCheck aria-label="Terverifikasi" className="size-4 text-primary" />
                                </span>
                                {listing.communityLocation && (
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin aria-hidden="true" className="size-3" /> {listing.communityLocation}</span>
                                )}
                            </span>
                        </Link>
                        <p className={`mt-4 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${availabilityBadge[listing.availability]}`}>
                            {merchandiseAvailabilityLabels[listing.availability]}
                        </p>
                        <h1 className="mt-2 font-heading text-2xl leading-tight font-semibold text-[#1f2924]">{listing.title}</h1>
                        <div className="mt-4 rounded-xl bg-[#f1f0ea] p-4">
                            <p className="text-xs text-muted-foreground">Harga dari komunitas</p>
                            <p className="mt-1 font-heading text-[28px] font-semibold text-primary">{formatMerchandisePrice(listing)}</p>
                            {listing.priceAmount !== null && listing.priceNote && <p className="mt-1 text-xs text-muted-foreground">{listing.priceNote}</p>}
                        </div>
                        {listing.description && <p className="mt-4 text-sm leading-6 whitespace-pre-line text-foreground/85">{listing.description}</p>}
                        <div className="mt-4 flex items-center justify-between">
                            <ShareButton title={listing.title} className="h-9 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted" />
                        </div>
                        <ReportForm targetType="MERCHANDISE_LISTING" targetId={listing.id} targetName={listing.title} isAuthenticated={user !== null} />
                    </section>

                    <section aria-labelledby="how-to-get-title" className="rounded-2xl border border-border bg-card p-5">
                        <h2 id="how-to-get-title" className="flex items-center gap-2 font-heading text-lg font-semibold">
                            <MessageSquareText aria-hidden="true" className="size-5 text-primary" /> Cara Mendapatkan Merchandise Ini
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">Koordinasi dilakukan langsung dengan pengurus komunitas di luar TemuBaca.</p>
                        <ol className="mt-4 flex list-none flex-col gap-2 rounded-xl bg-[#f1f0ea] p-4 text-sm">
                            {steps.map((step, index) => (
                                <li key={step} className="flex gap-2">
                                    <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{index + 1}</span>
                                    {step}
                                </li>
                            ))}
                        </ol>
                        <Link href={communityHref} className="mt-4 flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                            Buka Profil Komunitas <ArrowRight aria-hidden="true" className="size-4" />
                        </Link>
                    </section>

                    <section className="flex gap-3 rounded-2xl bg-[#e7efe8] p-5">
                        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                        <div>
                            <h2 className="font-sans text-sm font-semibold">Pemberitahuan TemuBaca</h2>
                            <p className="mt-1 text-xs leading-5 text-foreground/80">
                                <strong>TemuBaca belum memproses pembayaran atau pengiriman.</strong> Katalog ini hanya publikasi dari komunitas terverifikasi. Kontak komunitas belum ditampilkan di TemuBaca; waspadai pihak yang mengaku sebagai pengurus.
                            </p>
                        </div>
                    </section>
                </div>
            </div>

            <section aria-labelledby="ethics-title" className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-8">
                <p className="text-xs font-semibold tracking-[0.08em] text-primary uppercase">Keluargaan &amp; integritas</p>
                <h2 id="ethics-title" className="mt-2 font-heading text-xl font-semibold">Etika Berjejaring &amp; Merawat Ruang Baca Warga</h2>
                <ul className="mt-6 grid list-none gap-6 p-0 md:grid-cols-3">
                    {ethics.map(({ icon: Icon, title, body }) => (
                        <li key={title}>
                            <span className="flex size-8 items-center justify-center rounded-md bg-[#c9ecd6] text-primary"><Icon aria-hidden="true" className="size-4" /></span>
                            <h3 className="mt-3 font-heading text-base font-semibold">{title}</h3>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
                        </li>
                    ))}
                </ul>
            </section>

            {others.length > 0 && (
                <section aria-labelledby="related-title" className="mt-10">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 id="related-title" className="font-heading text-2xl font-semibold">Dukungan Lain dari {listing.communityName}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">Merchandise lain yang dipublikasikan komunitas ini.</p>
                        </div>
                        <Link href={`${communityHref}#merchandise`} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                            Lihat semua katalog komunitas <ArrowRight aria-hidden="true" className="size-3.5" />
                        </Link>
                    </div>
                    <ul className="mt-5 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
                        {others.map((item) => (
                            <li key={item.id} className="flex flex-col rounded-2xl border border-border bg-card p-4">
                                <div aria-hidden="true" className="flex aspect-[4/3] items-center justify-center rounded-lg bg-[#f1f0ea] text-primary/40">
                                    <ShoppingBag className="size-10" />
                                </div>
                                <span className="mt-3 w-fit rounded-full bg-[#f1f0ea] px-2 py-0.5 text-[11px] text-muted-foreground">{merchandiseAvailabilityLabels[item.availability]}</span>
                                <h3 className="mt-2 font-heading text-base font-semibold"><Link href={`/merchandise/${item.id}`} className="hover:underline">{item.title}</Link></h3>
                                <p className="mt-1 text-sm font-bold text-primary">{formatMerchandisePrice(item)}</p>
                                {item.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <p className="mt-8 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info aria-hidden="true" className="size-3.5" /> Informasi produk ditulis oleh komunitas dan dapat berubah sewaktu-waktu.
            </p>
        </main>
    );
}
