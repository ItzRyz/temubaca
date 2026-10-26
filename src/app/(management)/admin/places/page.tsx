import type { Metadata } from "next";
import Link from "next/link";

import { CuratedPlaceForm, emptyCuratedPlace, PlaceVisibilityControl } from "@/features/places/components/admin-place-forms";
import { placeTypeLabels } from "@/features/places/places";
import { regionByCode } from "@/features/regions/regions";
import { listPlacesForAdmin } from "@/lib/db/queries/places";

export const metadata: Metadata = { title: "Data tempat" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

/** Why an owner pin is off the map although no admin hid it. */
const offMapReason: Partial<Record<string, string>> = {
    COMMUNITY: "Tidak tampil: komunitas belum terverifikasi",
    EVENT: "Tidak tampil: acara belum terbit, daring, atau sudah selesai",
};

/** Peta Literasi curation (DEC-07): libraries and meeting points, plus moderation of community and event pins. */
export default async function AdminPlacesPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const places = await listPlacesForAdmin();
    const editing = typeof params.edit === "string" ? places.find((place) => place.id === params.edit && (place.type === "LIBRARY" || place.type === "MEETING_POINT")) : undefined;

    return (
        <main className="px-4 py-8 sm:px-8 sm:py-10">
            <header>
                <h1 className="font-heading text-[28px] leading-tight font-semibold text-primary sm:text-[34px]">Data Tempat</h1>
                <p className="mt-2 max-w-2xl text-base text-muted-foreground">
                    Perpustakaan dan titik temu publik di <Link href="/map" className="font-semibold text-primary hover:underline">Peta Literasi</Link>. Titik komunitas dan acara dipasang pengelolanya; titik komunitas tampil hanya saat komunitas terverifikasi, dan titik acara hanya sampai acara selesai. Setiap perubahan tercatat di jejak audit.
                </p>
            </header>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <section aria-labelledby="place-form-title" className="h-fit rounded-xl border border-border bg-card p-6">
                    <h2 id="place-form-title" className="font-heading text-xl font-semibold">{editing ? `Ubah ${editing.name}` : "Tambah tempat"}</h2>
                    {editing && <Link href="/admin/places" className="mt-1 inline-block text-sm font-semibold text-primary hover:underline">Batal mengubah</Link>}
                    <div className="mt-4">
                        <CuratedPlaceForm
                            key={editing?.id ?? "new"}
                            placeId={editing?.id}
                            initial={editing ? {
                                type: editing.type as "LIBRARY" | "MEETING_POINT",
                                name: editing.name,
                                addressPublic: editing.addressPublic ?? "",
                                regionCode: editing.regionCode ?? "",
                                source: editing.source ?? "",
                                latitude: String(editing.latitude),
                                longitude: String(editing.longitude),
                            } : emptyCuratedPlace}
                        />
                    </div>
                </section>

                <section aria-labelledby="place-list-title">
                    <h2 id="place-list-title" className="font-heading text-xl font-semibold">Semua tempat ({places.length})</h2>
                    {places.length ? (
                        <ul className="mt-4 flex list-none flex-col gap-3 p-0">
                            {places.map((place) => {
                                const status = place.hiddenAt ? "Disembunyikan" : place.onMap ? "Tampil di peta" : offMapReason[place.type] ?? "Tidak tampil";
                                return (
                                    <li key={place.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-muted-foreground">{placeTypeLabels[place.type]} · {status}</p>
                                            <p className="mt-1 font-semibold">
                                                {place.eventId ? <Link href={`/events/${place.eventId}`} className="hover:underline">{place.name}</Link> : place.name}
                                            </p>
                                            {place.eventId && place.communityName && <p className="text-sm text-muted-foreground">Acara {place.communityName}</p>}
                                            <p className="text-sm text-muted-foreground">{place.addressPublic} · {regionByCode(place.regionCode)?.name ?? "Wilayah belum tercatat"}</p>
                                            <p className="text-xs text-muted-foreground">{place.latitude}, {place.longitude}{place.checkedAt && ` · diperbarui ${date.format(place.checkedAt)}`}</p>
                                            {place.hiddenReason && <p className="mt-1 text-xs text-destructive">Alasan: {place.hiddenReason}</p>}
                                        </div>
                                        <div className="flex shrink-0 flex-wrap gap-2">
                                            {(place.type === "LIBRARY" || place.type === "MEETING_POINT") && (
                                                <Link href={`/admin/places?edit=${place.id}`} className="flex min-h-10 items-center rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted">
                                                    Ubah<span className="sr-only">: {place.name}</span>
                                                </Link>
                                            )}
                                            <PlaceVisibilityControl placeId={place.id} placeName={place.name} hidden={Boolean(place.hiddenAt)} />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">Belum ada tempat. Tambahkan perpustakaan atau titik temu publik pertama.</p>
                    )}
                </section>
            </div>
        </main>
    );
}
