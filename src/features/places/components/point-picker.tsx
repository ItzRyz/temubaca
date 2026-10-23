"use client";

import dynamic from "next/dynamic";

import { Field, TextInput } from "@/components/ui/form";

const PointPickerMap = dynamic(() => import("./point-picker-map"), {
    ssr: false,
    loading: () => <p className="flex size-full items-center justify-center text-sm text-muted-foreground">Memuat peta…</p>,
});

export type PointText = { latitude: string; longitude: string };

function parsePoint(value: PointText) {
    const latitude = Number(value.latitude);
    const longitude = Number(value.longitude);
    return value.latitude.trim() && value.longitude.trim() && Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

/** Latitude/longitude fields with a map to click (DEC-07). Values stay strings so a half-typed number is kept. */
export function PointPicker({ value, onChange, errors }: {
    value: PointText;
    onChange: (value: PointText) => void;
    errors?: { latitude?: string; longitude?: string };
}) {
    return (
        <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">Klik peta untuk memasang titik, atau isi lintang dan bujur (misalnya disalin dari Google Maps). Pilih tempat umum, bukan rumah pribadi.</p>
            <div className="h-72 overflow-hidden rounded-xl border border-border bg-muted">
                <PointPickerMap point={parsePoint(value)} onPick={(point) => onChange({ latitude: String(point.latitude), longitude: String(point.longitude) })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Lintang" required error={errors?.latitude} hint="Contoh: -6.2088">
                    {(control) => <TextInput {...control} inputMode="decimal" value={value.latitude} onChange={(event) => onChange({ ...value, latitude: event.target.value })} />}
                </Field>
                <Field label="Bujur" required error={errors?.longitude} hint="Contoh: 106.8456">
                    {(control) => <TextInput {...control} inputMode="decimal" value={value.longitude} onChange={(event) => onChange({ ...value, longitude: event.target.value })} />}
                </Field>
            </div>
        </div>
    );
}
