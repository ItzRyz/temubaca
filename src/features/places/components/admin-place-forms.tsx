"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormAlert, Select, TextArea, TextInput } from "@/components/ui/form";
import { sendCommunityRequest, type FieldErrors } from "@/features/community-management/client";
import { RegionSelect } from "@/features/regions/components/region-select";

import { CURATED_PLACE_TYPES, placeTypeLabels } from "../places";
import { PointPicker } from "./point-picker";

export type CuratedPlaceValues = {
    type: (typeof CURATED_PLACE_TYPES)[number];
    name: string;
    addressPublic: string;
    regionCode: string;
    source: string;
    latitude: string;
    longitude: string;
};

export const emptyCuratedPlace: CuratedPlaceValues = { type: "LIBRARY", name: "", addressPublic: "", regionCode: "", source: "", latitude: "", longitude: "" };

/** Admin form for a library or public meeting point (DEC-07); every save is written to the audit log. */
export function CuratedPlaceForm({ placeId, initial }: { placeId?: string; initial: CuratedPlaceValues }) {
    const router = useRouter();
    const [values, setValues] = useState(initial);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
    const [pending, setPending] = useState(false);
    const set = <K extends keyof CuratedPlaceValues>(key: K, value: CuratedPlaceValues[K]) => setValues((current) => ({ ...current, [key]: value }));

    async function save() {
        setPending(true);
        setMessage(null);
        const result = await sendCommunityRequest(placeId ? `/api/admin/places/${placeId}` : "/api/admin/places", placeId ? "PUT" : "POST", values);
        setPending(false);
        if (!result.ok) {
            setErrors(result.fieldErrors);
            setMessage({ tone: "error", text: result.message });
            return;
        }
        setErrors({});
        if (placeId) {
            setMessage({ tone: "success", text: "Tempat diperbarui dan tercatat di jejak audit." });
            router.refresh();
        } else {
            setValues(emptyCuratedPlace);
            setMessage({ tone: "success", text: "Tempat ditambahkan ke Peta Literasi." });
            router.refresh();
        }
    }

    return (
        <form onSubmit={(event) => { event.preventDefault(); void save(); }} noValidate className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Jenis tempat" required error={errors.type}>
                    {(control) => (
                        <Select {...control} value={values.type} onChange={(event) => set("type", event.target.value as CuratedPlaceValues["type"])}>
                            {CURATED_PLACE_TYPES.map((type) => <option key={type} value={type}>{placeTypeLabels[type]}</option>)}
                        </Select>
                    )}
                </Field>
                <Field label="Nama tempat" required error={errors.name}>
                    {(control) => <TextInput {...control} value={values.name} maxLength={120} onChange={(event) => set("name", event.target.value)} />}
                </Field>
            </div>
            <Field label="Alamat publik" required error={errors.addressPublic} hint="Alamat atau patokan yang boleh dilihat semua orang.">
                {(control) => <TextArea {...control} rows={2} value={values.addressPublic} maxLength={200} onChange={(event) => set("addressPublic", event.target.value)} />}
            </Field>
            <RegionSelect id={placeId ? `place-region-${placeId}` : "place-region-new"} label="Kabupaten/Kota" required value={values.regionCode} onChange={(code) => set("regionCode", code)} error={errors.regionCode} />
            <PointPicker value={values} onChange={(point) => setValues((current) => ({ ...current, ...point }))} errors={{ latitude: errors.latitude, longitude: errors.longitude }} />
            <Field label="Sumber data" error={errors.source} hint="Opsional, misalnya situs resmi perpustakaan atau kunjungan tim.">
                {(control) => <TextInput {...control} value={values.source} maxLength={200} onChange={(event) => set("source", event.target.value)} />}
            </Field>
            {message && <FormAlert tone={message.tone}>{message.text}</FormAlert>}
            <button type="submit" disabled={pending} className="min-h-11 self-start rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {pending ? "Menyimpan…" : placeId ? "Simpan perubahan" : "Tambah tempat"}
            </button>
        </form>
    );
}

/** Hide (reason required) or restore a place, community pins included. */
export function PlaceVisibilityControl({ placeId, placeName, hidden }: { placeId: string; placeName: string; hidden: boolean }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function send(body: { action: "hide"; reason: string } | { action: "restore" }) {
        setPending(true);
        setError(null);
        const result = await sendCommunityRequest(`/api/admin/places/${placeId}`, "PATCH", body);
        setPending(false);
        if (!result.ok) {
            setError(result.fieldErrors.reason ?? result.message);
            return;
        }
        setOpen(false);
        setReason("");
        router.refresh();
    }

    if (hidden) {
        return (
            <div className="flex flex-col gap-1">
                <button type="button" disabled={pending} onClick={() => void send({ action: "restore" })} className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted disabled:opacity-60">
                    Tampilkan lagi<span className="sr-only">: {placeName}</span>
                </button>
                {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            </div>
        );
    }
    if (!open) {
        return (
            <button type="button" onClick={() => setOpen(true)} className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold text-destructive hover:bg-destructive/5">
                Sembunyikan<span className="sr-only">: {placeName}</span>
            </button>
        );
    }
    return (
        <form onSubmit={(event) => { event.preventDefault(); void send({ action: "hide", reason }); }} className="flex w-full flex-col gap-2 sm:w-72">
            <Field label={`Alasan menyembunyikan ${placeName}`} required error={error}>
                {(control) => <TextInput {...control} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />}
            </Field>
            <div className="flex gap-2">
                <button type="submit" disabled={pending} className="min-h-10 rounded-lg bg-destructive px-3 text-sm font-semibold text-white disabled:opacity-60">Sembunyikan</button>
                <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold">Batal</button>
            </div>
        </form>
    );
}
