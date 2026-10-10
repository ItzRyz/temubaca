import { ArrowRight, Library, ShoppingBag } from "lucide-react";
import Link from "next/link";

import { formatMerchandisePrice } from "@/features/merchandise/format";

export type HomeMerchandise = {
    id: string;
    title: string;
    description: string | null;
    priceAmount: string | null;
    currency: string | null;
    priceNote: string | null;
    communityName: string;
};

export function HomeMerchandiseBand({ items }: { items: HomeMerchandise[] }) {
    return (
        <section aria-labelledby="home-merch-title" className="px-4 py-8 sm:px-9 sm:py-12">
            <div className="mx-auto grid max-w-[1208px] gap-8 rounded-[28px] bg-card p-6 sm:p-12 lg:grid-cols-[minmax(0,320px)_1fr] lg:items-center">
                <div>
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
                        <Library aria-hidden="true" className="size-3.5" /> Perpustakaan mandiri warga
                    </p>
                    <h2 id="home-merch-title" className="mt-5 font-heading text-[28px] leading-9 font-bold text-[#1f2924] sm:text-[32px]">Dukung Keberlanjutan Ruang Baca</h2>
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                        Merchandise dari komunitas terverifikasi membantu pengelolaan titik temu warga. Pembelian dikonfirmasi langsung dengan komunitas; TemuBaca belum memproses pembayaran.
                    </p>
                    <Link href="/merchandise" className="mt-6 inline-flex items-center gap-1 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                        Jelajahi Toko Komunitas <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                </div>
                {items.length > 0 ? (
                    <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-3">
                        {items.map((item) => (
                            <li key={item.id} className="flex flex-col rounded-2xl border border-border bg-card p-3 shadow-[0_4px_16px_rgba(31,41,36,0.06)]">
                                <div aria-hidden="true" className="flex aspect-[4/3] items-center justify-center rounded-lg bg-muted text-primary/50">
                                    <ShoppingBag className="size-10" />
                                </div>
                                <h3 className="mt-3 line-clamp-1 font-sans text-sm font-semibold"><Link href={`/merchandise/${item.id}`} className="hover:underline">{item.title}</Link></h3>
                                {item.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>}
                                <p className="mt-1 text-[11px] text-muted-foreground">oleh {item.communityName}</p>
                                <p className="mt-auto pt-3 text-sm font-bold text-primary">{formatMerchandisePrice(item)}</p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">Belum ada merchandise terbit dari komunitas terverifikasi.</p>
                )}
            </div>
        </section>
    );
}
