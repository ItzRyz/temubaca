import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { formatMerchandisePrice } from "@/features/merchandise/format";
import { ReportForm } from "@/features/reports/components/report-form";
import { countPublicMerchandise, listPublicMerchandise } from "@/lib/db/queries/merchandise";
import { publicEventQuerySchema } from "@/lib/validation/schemas/public-catalog.schema";

export const metadata: Metadata = {
    title: "Katalog merchandise",
    description: "Lihat merchandise yang dipublikasikan oleh komunitas baca terverifikasi.",
};

export const dynamic = "force-dynamic";

type MerchandisePageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleValue(value: string | string[] | undefined) {
    return typeof value === "string" ? value : undefined;
}

const availabilityLabels = {
    AVAILABLE: "Tersedia menurut listing",
    UNAVAILABLE: "Tidak tersedia",
    RESERVED: "Dipesan",
} as const;

export default async function MerchandisePage({ searchParams }: MerchandisePageProps) {
    const params = await searchParams;
    const parsed = publicEventQuerySchema.safeParse({
        page: singleValue(params.page),
        limit: singleValue(params.limit),
    });
    const query = parsed.success ? parsed.data : null;
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const offset = (page - 1) * limit;
    const [listings, total, user] = await Promise.all([
        query ? listPublicMerchandise({ limit, offset }) : Promise.resolve([]),
        query ? countPublicMerchandise() : Promise.resolve(0),
        getCurrentUser(),
    ]);
    const totalPages = query ? Math.ceil(total / limit) : 0;

    return (
        <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
            <header className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Dari komunitas baca</p>
                <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">Katalog merchandise</h1>
                <p className="mt-4 text-base leading-7 text-muted-foreground">
                    Katalog ini menampilkan listing terbit dari komunitas terverifikasi. TemuBaca belum menyediakan checkout atau memproses pembayaran; informasi transaksi perlu dikonfirmasi langsung kepada komunitas.
                </p>
                {!parsed.success && <p role="alert" className="mt-3 text-sm text-destructive">Parameter halaman tidak valid.</p>}
            </header>

            {listings.length > 0 ? (
                <ul className="mt-10 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
                    {listings.map((listing) => (
                        <li key={listing.id}>
                            <article className="h-full rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
                                <h2 className="font-heading text-xl font-semibold"><Link href={`/merchandise/${listing.id}`} className="hover:underline">{listing.title}</Link></h2>
                                <p className="mt-1 text-sm text-muted-foreground">{listing.communityName}</p>
                                {listing.description && <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">{listing.description}</p>}
                                <p className="mt-4 text-sm font-semibold text-primary">{formatMerchandisePrice(listing)}</p>
                                {listing.priceAmount !== null && listing.priceNote && <p className="mt-1 text-xs text-muted-foreground">{listing.priceNote}</p>}
                                <p className="mt-3 text-xs text-muted-foreground">{availabilityLabels[listing.availability]}</p>
                                <ReportForm targetType="MERCHANDISE_LISTING" targetId={listing.id} targetName={listing.title} isAuthenticated={user !== null} />
                            </article>
                        </li>
                    ))}
                </ul>
            ) : (
                <section className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center">
                    <h2 className="font-heading text-lg font-semibold">Belum ada merchandise untuk ditampilkan</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Listing yang dipublikasikan komunitas terverifikasi akan muncul di sini.</p>
                </section>
            )}

            {totalPages > 1 && (
                <nav aria-label="Halaman merchandise" className="mt-8 flex items-center justify-between">
                    {page > 1 ? <Link className="rounded-lg border px-4 py-2 text-sm hover:bg-muted" href={`/merchandise?page=${page - 1}&limit=${limit}`}>Sebelumnya</Link> : <span />}
                    <span className="text-sm text-muted-foreground">Halaman {page} dari {totalPages} · {total} listing</span>
                    {page < totalPages ? <Link className="rounded-lg border px-4 py-2 text-sm hover:bg-muted" href={`/merchandise?page=${page + 1}&limit=${limit}`}>Berikutnya</Link> : <span />}
                </nav>
            )}
        </main>
    );
}
