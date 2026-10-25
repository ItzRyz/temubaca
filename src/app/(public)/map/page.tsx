import type { Metadata } from "next";
import Link from "next/link";

import { MapExplorer } from "@/features/places/components/map-explorer";
import { PLACE_TYPES } from "@/features/places/places";
import { listPublicPlaces } from "@/lib/db/queries/places";

export const metadata: Metadata = {
    title: "Peta Literasi",
    description: "Temukan perpustakaan, komunitas baca terverifikasi, acara, dan titik temu publik di sekitarmu.",
};

export const dynamic = "force-dynamic";

/** Peta Literasi (TB-026, DEC-07): every public place is sent once and filtered in the browser. */
export default async function MapPage({ searchParams }: PageProps<"/map">) {
    const { tempat } = await searchParams;
    const places = await listPublicPlaces({ types: [...PLACE_TYPES] });

    return (
        <main className="mx-auto w-full max-w-[1256px] px-4 py-8 sm:px-6 sm:py-10">
            <header className="max-w-3xl">
                <h1 className="font-heading text-[32px] leading-tight font-semibold text-primary sm:text-[40px]">Peta Literasi</h1>
                <p className="mt-2 text-base text-muted-foreground">
                    Perpustakaan, komunitas baca terverifikasi, acara yang akan datang, dan titik temu publik. Semua titik adalah tempat umum; salinan buku milik warga tidak ditampilkan di peta.
                </p>
            </header>
            <div className="mt-6">
                <MapExplorer
                    initialId={typeof tempat === "string" ? tempat : undefined}
                    places={places.map((place) => ({ ...place, checkedAt: place.checkedAt?.toISOString() ?? null, eventStartsAt: place.eventStartsAt?.toISOString() ?? null }))}
                />
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
                Titik dikurasi tim TemuBaca atau dipasang pengelola komunitas. Ada yang keliru? Laporkan lewat halaman komunitas atau acaranya, atau <Link href="/help" className="font-semibold text-primary hover:underline">Pusat bantuan</Link>.
            </p>
        </main>
    );
}
