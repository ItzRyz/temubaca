"use client";

import { ExternalLink, LocateFixed, MapPin, Route, Search } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

import { kabkotaOptions, provinceOptions, regionByCode } from "@/features/regions/regions";
import { cn } from "@/lib/utils";

import { distanceMeters, formatDistance, googleMapsUrl, isInsideIndonesia, placeTypeColors, placeTypeLabels, type PlaceType } from "../places";
import { ROUTE_MODES, routeModeLabels, type RouteMode, type RouteOutcome } from "../route";

// Leaflet touches `window`, so the map renders in the browser only (Next lazy-loading guide).
const LiteracyMap = dynamic(() => import("./literacy-map"), {
    ssr: false,
    loading: () => <p className="flex size-full items-center justify-center text-sm text-muted-foreground">Memuat peta…</p>,
});

export type ExplorerPlace = {
    id: string;
    type: PlaceType;
    name: string;
    addressPublic: string | null;
    latitude: number;
    longitude: number;
    regionCode: string | null;
    checkedAt: string | null;
    communityId: string | null;
    communityName: string | null;
    eventId: string | null;
    eventStartsAt: string | null;
};

const FILTER_TYPES = ["LIBRARY", "COMMUNITY", "EVENT", "MEETING_POINT"] as const satisfies readonly PlaceType[];
const checkedFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const eventFormat = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** The page a pin belongs to: its event, its community, or none for a curated place. */
function placeHref(place: ExplorerPlace) {
    if (place.eventId) return `/events/${place.eventId}`;
    return place.communityId ? `/communities/${place.communityId}` : null;
}

type Locating = { status: "idle" | "locating" } | { status: "error"; message: string };

type RouteResult =
    | { outcome: "ROUTE"; externalUrl: string; route: { mode: RouteMode; distanceM: number; durationS: number; coordinates: [number, number][]; viaStreets: string[] } }
    | { outcome: Exclude<RouteOutcome, "ROUTE">; externalUrl: string; message: string };
type RouteState = { placeId: string; mode: RouteMode } & ({ status: "loading" } | { status: "done"; result: RouteResult } | { status: "error"; message: string });

/** "± 19 menit", or hours and minutes past an hour. */
function formatDuration(seconds: number) {
    const minutes = Math.max(1, Math.round(seconds / 60));
    return minutes < 60 ? `± ${minutes} menit` : `± ${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;
}

/** Peta Literasi (DEC-07, TB-026): filters and a list that work without the map, plus a Leaflet view. */
export function MapExplorer({ places, initialId }: { places: ExplorerPlace[]; initialId?: string }) {
    // `/map?tempat=<id>` (from a community or event page) opens on that pin.
    const initial = places.find((place) => place.id === initialId) ?? null;
    const [types, setTypes] = useState<PlaceType[]>([...FILTER_TYPES]);
    const [province, setProvince] = useState("");
    const [kabkota, setKabkota] = useState("");
    const [query, setQuery] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(initial?.id ?? null);
    const [focus, setFocus] = useState<{ latitude: number; longitude: number; zoom: number } | null>(initial ? { latitude: initial.latitude, longitude: initial.longitude, zoom: 15 } : null);
    // Kept in component state only: never sent to the server or stored (DEC-07).
    const [reader, setReader] = useState<{ latitude: number; longitude: number } | null>(null);
    const [locating, setLocating] = useState<Locating>({ status: "idle" });
    const [routeMode, setRouteMode] = useState<RouteMode>("drive");
    const [routeState, setRouteState] = useState<RouteState | null>(null);

    const visible = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase("id-ID");
        const region = kabkota || province;
        const matches = places.filter((place) =>
            types.includes(place.type)
            && (!region || place.regionCode?.startsWith(region))
            && (!needle || [place.name, place.communityName, place.addressPublic].some((text) => text?.toLocaleLowerCase("id-ID").includes(needle))),
        );
        const withDistance = matches.map((place) => ({ ...place, distance: reader ? distanceMeters(reader, place) : null }));
        return reader ? withDistance.sort((a, b) => a.distance! - b.distance!) : withDistance;
    }, [places, types, province, kabkota, query, reader]);

    const toggleType = (type: PlaceType) => setTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);

    function locate() {
        if (!("geolocation" in navigator)) {
            setLocating({ status: "error", message: "Peramban ini tidak mendukung lokasi. Pilih provinsi atau kabupaten/kota." });
            return;
        }
        setLocating({ status: "locating" });
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                if (!isInsideIndonesia(coords.latitude, coords.longitude)) {
                    setLocating({ status: "error", message: "Lokasimu di luar Indonesia. Pilih provinsi atau kabupaten/kota." });
                    return;
                }
                const position = { latitude: coords.latitude, longitude: coords.longitude };
                setReader(position);
                setFocus({ ...position, zoom: 12 });
                setLocating({ status: "idle" });
            },
            (error) => setLocating({
                status: "error",
                message: error.code === error.PERMISSION_DENIED
                    ? "Izin lokasi ditolak. Kamu tetap bisa memilih provinsi atau kabupaten/kota."
                    : "Lokasi belum dapat ditentukan. Coba lagi atau pilih wilayah.",
            }),
            { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
        );
    }

    /** Sends the reader's point once, only on this click (DEC-07); nothing about it is kept afterwards. */
    async function requestRoute(place: ExplorerPlace) {
        if (!reader) return;
        const mode = routeMode;
        setSelectedId(place.id);
        setRouteState({ placeId: place.id, mode, status: "loading" });
        try {
            const response = await fetch(`/api/places/${place.id}/route`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ origin: reader, mode }),
            });
            const payload = await response.json().catch(() => null) as { success?: boolean; data?: RouteResult; error?: { message?: string } } | null;
            if (response.ok && payload?.success && payload.data) {
                setRouteState({ placeId: place.id, mode, status: "done", result: payload.data });
                return;
            }
            const message = response.status === 429 ? "Terlalu banyak permintaan rute. Coba lagi sebentar lagi." : payload?.error?.message ?? "Rute belum dapat dihitung. Coba lagi.";
            setRouteState({ placeId: place.id, mode, status: "error", message });
        } catch {
            setRouteState({ placeId: place.id, mode, status: "error", message: "Koneksi terputus. Coba lagi." });
        }
    }

    const shownRoute = routeState?.status === "done" && routeState.result.outcome === "ROUTE" ? routeState.result.route : null;

    function show(place: ExplorerPlace) {
        setSelectedId(place.id);
        setFocus({ latitude: place.latitude, longitude: place.longitude, zoom: 15 });
    }

    function selectFromMap(id: string) {
        setSelectedId(id);
        document.getElementById(`place-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
            <div className="flex min-w-0 flex-col gap-4">
                <form role="search" onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
                    <label className="flex min-h-11 items-center gap-2 rounded-lg border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
                        <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        <span className="sr-only">Cari nama tempat atau komunitas</span>
                        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} placeholder="Cari tempat atau komunitas…" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" />
                    </label>
                    <fieldset>
                        <legend className="text-xs font-semibold text-muted-foreground">Jenis tempat</legend>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {FILTER_TYPES.map((type) => (
                                <button key={type} type="button" aria-pressed={types.includes(type)} onClick={() => toggleType(type)}
                                    className={cn("flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold", types.includes(type) ? "border-primary bg-[#e7efe8] text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                                    <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: placeTypeColors[type] }} />
                                    {placeTypeLabels[type]}
                                </button>
                            ))}
                        </div>
                    </fieldset>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <select aria-label="Provinsi" value={province} onChange={(event) => { setProvince(event.target.value); setKabkota(""); }} className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm">
                            <option value="">Semua provinsi</option>
                            {provinceOptions().map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
                        </select>
                        <select aria-label="Kabupaten/kota" value={kabkota} disabled={!province} onChange={(event) => setKabkota(event.target.value)} className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-60">
                            <option value="">Semua kabupaten/kota</option>
                            {province && kabkotaOptions(province).map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
                        </select>
                    </div>
                    <button type="button" onClick={locate} disabled={locating.status === "locating"} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-[#e7efe8] disabled:opacity-60">
                        <LocateFixed aria-hidden="true" className="size-4" /> {locating.status === "locating" ? "Mencari lokasimu…" : reader ? "Perbarui lokasiku" : "Gunakan lokasiku"}
                    </button>
                    <p className="text-xs text-muted-foreground">Lokasimu dipakai di perangkat ini untuk mengurutkan jarak. Saat kamu meminta rute, lokasimu dikirim sekali untuk menghitungnya, lalu tidak disimpan.</p>
                    {reader && (
                        <fieldset>
                            <legend className="text-xs font-semibold text-muted-foreground">Moda rute</legend>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {ROUTE_MODES.map((mode) => (
                                    <button key={mode} type="button" aria-pressed={routeMode === mode} onClick={() => setRouteMode(mode)}
                                        className={cn("min-h-9 rounded-full border px-3 text-xs font-semibold", routeMode === mode ? "border-primary bg-[#e7efe8] text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                                        {routeModeLabels[mode]}
                                    </button>
                                ))}
                            </div>
                        </fieldset>
                    )}
                    {locating.status === "error" && <p role="alert" className="text-sm text-destructive">{locating.message}</p>}
                </form>

                <p aria-live="polite" className="text-sm text-muted-foreground">{visible.length} tempat{reader ? ", diurutkan dari yang terdekat" : ""}</p>
                {visible.length ? (
                    <ul aria-label="Daftar tempat" className="relative flex max-h-[640px] list-none flex-col gap-3 overflow-y-auto p-0 pr-1">
                        {/* `relative` keeps the sr-only labels (absolutely positioned) inside this scroll box; without it they stretch the page. */}
                        {visible.map((place) => {
                            const href = placeHref(place);
                            return (
                                <li key={place.id} id={`place-${place.id}`}>
                                    <article className={cn("rounded-2xl border bg-card p-4", place.id === selectedId ? "border-primary shadow-sm" : "border-border")}>
                                        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                                            <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: placeTypeColors[place.type] }} />
                                            {placeTypeLabels[place.type]}
                                            {place.distance !== null && <span className="ml-auto font-normal">± {formatDistance(place.distance)}</span>}
                                        </p>
                                        <h3 className="mt-1 font-heading text-base font-semibold">
                                            {href ? <Link href={href} className="hover:underline">{place.name}</Link> : place.name}
                                        </h3>
                                        {place.eventId && (
                                            <p className="mt-1 text-sm">
                                                {place.eventStartsAt && <span className="capitalize">{eventFormat.format(new Date(place.eventStartsAt))} WIB</span>}
                                                {place.communityName && <span className="text-muted-foreground"> · oleh {place.communityName}</span>}
                                            </p>
                                        )}
                                        {place.addressPublic && <p className="mt-1 flex gap-1 text-sm text-muted-foreground"><MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />{place.addressPublic}</p>}
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {regionByCode(place.regionCode)?.name ?? "Wilayah belum tercatat"}
                                            {place.checkedAt && ` · Diperbarui ${checkedFormat.format(new Date(place.checkedAt))}`}
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <button type="button" onClick={() => show(place)} className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted">
                                                Lihat di peta<span className="sr-only">: {place.name}</span>
                                            </button>
                                            {reader && (
                                                <button type="button" onClick={() => void requestRoute(place)} disabled={routeState?.placeId === place.id && routeState.status === "loading"}
                                                    className="flex min-h-10 items-center gap-1 rounded-lg border border-primary px-3 text-sm font-semibold text-primary hover:bg-[#e7efe8] disabled:opacity-60">
                                                    <Route aria-hidden="true" className="size-3.5" /> Rute {routeModeLabels[routeMode].toLowerCase()}<span className="sr-only">: {place.name}</span>
                                                </button>
                                            )}
                                            <a href={googleMapsUrl(place.latitude, place.longitude)} target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                                                Buka di Google Maps <ExternalLink aria-hidden="true" className="size-3.5" /><span className="sr-only"> (tab baru)</span>
                                            </a>
                                        </div>
                                        {routeState?.placeId === place.id && <RouteSummary state={routeState} />}
                                    </article>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground">
                        {places.length ? "Tidak ada tempat yang cocok dengan filter ini." : "Belum ada tempat di peta. Perpustakaan dan titik temu publik ditambahkan oleh tim TemuBaca, dan komunitas terverifikasi bisa memasang titik temu serta lokasi acaranya."}
                    </p>
                )}
            </div>

            <div className="h-[420px] overflow-hidden rounded-2xl border border-border bg-muted lg:sticky lg:top-24 lg:h-[680px]" aria-label="Peta tempat literasi" role="region">
                <LiteracyMap places={visible} selectedId={selectedId} focus={focus} reader={reader} route={shownRoute?.coordinates ?? null} onSelect={selectFromMap} />
            </div>
        </div>
    );
}

/** The route result inside a place card; announced politely so screen readers hear it. */
function RouteSummary({ state }: { state: RouteState }) {
    return (
        <div role="status" className="mt-3 rounded-xl bg-[#f1f0ea] p-3 text-sm">
            {state.status === "loading" && <p>Menghitung rute {routeModeLabels[state.mode].toLowerCase()}…</p>}
            {state.status === "error" && <p className="text-destructive">{state.message}</p>}
            {state.status === "done" && (state.result.outcome === "ROUTE" ? (
                <>
                    <p className="font-semibold">
                        {routeModeLabels[state.result.route.mode]}: {formatDistance(state.result.route.distanceM)}, {formatDuration(state.result.route.durationS)}
                    </p>
                    {state.result.route.viaStreets.length > 0 && <p className="mt-1 text-muted-foreground">Lewat {state.result.route.viaStreets.join(", ")}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">Perkiraan tanpa lalu lintas, dari data jalan OpenStreetMap. Garis rute tampil di peta.</p>
                </>
            ) : (
                <p>{state.result.message}</p>
            ))}
        </div>
    );
}
