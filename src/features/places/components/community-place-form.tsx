"use client";

import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormAlert, TextInput } from "@/components/ui/form";
import { sendCommunityRequest, type FieldErrors } from "@/features/community-management/client";
import { RegionSelect } from "@/features/regions/components/region-select";

import { PointPicker } from "./point-picker";

type Saved = { addressPublic: string | null; latitude: number; longitude: number; regionCode: string | null; hidden: boolean } | null;

/** One owner-managed pin (a community meeting place or an event venue) with a map to place it (DEC-07). */
function PinForm({ id, url, title, intro, saved, withRegion, savedText }: {
    id: string;
    url: string;
    title: string;
    intro: string;
    saved: Saved;
    withRegion: boolean;
    savedText: string;
}) {
    const router = useRouter();
    const empty = { addressPublic: "", latitude: "", longitude: "", regionCode: "" };
    const [values, setValues] = useState(saved ? {
        addressPublic: saved.addressPublic ?? "",
        latitude: String(saved.latitude),
        longitude: String(saved.longitude),
        regionCode: saved.regionCode ?? "",
    } : empty);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
    const [pending, setPending] = useState(false);

    async function save() {
        setPending(true);
        setMessage(null);
        // A community pin takes its kab/kota from the profile; the server schema drops the unused field.
        const result = await sendCommunityRequest(url, "PUT", values);
        setPending(false);
        if (!result.ok) {
            setErrors(result.fieldErrors);
            setMessage({ tone: "error", text: result.message });
            return;
        }
        setErrors({});
        setMessage({ tone: "success", text: savedText });
        router.refresh();
    }

    async function remove() {
        setPending(true);
        setMessage(null);
        const result = await sendCommunityRequest(url, "DELETE");
        setPending(false);
        if (!result.ok) {
            setMessage({ tone: "error", text: result.message });
            return;
        }
        setValues(empty);
        setMessage({ tone: "success", text: "Titik dihapus dari peta." });
        router.refresh();
    }

    return (
        <section aria-labelledby={`${id}-title`} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 id={`${id}-title`} className="flex items-center gap-2 font-heading text-xl font-semibold text-primary">
                <MapPin aria-hidden="true" className="size-5" /> {title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
            {saved?.hidden && <FormAlert tone="error" className="mt-4">Titik ini disembunyikan tim TemuBaca dan tidak tampil di peta. Hubungi bantuan bila menurutmu ini keliru.</FormAlert>}
            <form onSubmit={(event) => { event.preventDefault(); void save(); }} noValidate className="mt-4 flex flex-col gap-4">
                <Field label="Nama tempat atau alamat publik" required error={errors.addressPublic} hint="Contoh: Taman Suropati, Jl. Taman Suropati, Menteng.">
                    {(control) => <TextInput {...control} value={values.addressPublic} maxLength={200} onChange={(event) => setValues((current) => ({ ...current, addressPublic: event.target.value }))} />}
                </Field>
                {withRegion && (
                    <RegionSelect id={`${id}-region`} label="Kabupaten/Kota" required value={values.regionCode} onChange={(code) => setValues((current) => ({ ...current, regionCode: code }))} error={errors.regionCode} />
                )}
                <PointPicker value={values} onChange={(point) => setValues((current) => ({ ...current, ...point }))} errors={{ latitude: errors.latitude, longitude: errors.longitude }} />
                {message && <FormAlert tone={message.tone}>{message.text}</FormAlert>}
                <div className="flex flex-wrap gap-3">
                    <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                        {pending ? "Menyimpan…" : "Simpan titik"}
                    </button>
                    {saved && (
                        <button type="button" disabled={pending} onClick={() => void remove()} className="min-h-11 rounded-lg border border-border px-5 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-60">
                            Hapus dari peta
                        </button>
                    )}
                </div>
            </form>
        </section>
    );
}

/**
 * "Titik temu di peta" on the community manage page (DEC-07). Optional; the pin shows on the Peta
 * Literasi only while the community is VERIFIED and an admin has not hidden it. Its kab/kota follows the profile.
 */
export function CommunityPlaceForm({ communityId, saved, verified }: { communityId: string; saved: Saved; verified: boolean }) {
    return (
        <PinForm
            id="community-place"
            url={`/api/communities/${communityId}/place`}
            title="Titik temu di peta"
            intro="Opsional. Pasang satu tempat umum tempat komunitas biasa berkumpul, misalnya taman, kafe, atau perpustakaan. Jangan memakai alamat rumah. Titik ini dilihat semua orang di Peta Literasi."
            saved={saved}
            withRegion={false}
            savedText={verified ? "Titik temu disimpan dan tampil di Peta Literasi." : "Titik temu disimpan. Titik tampil di Peta Literasi setelah komunitas terverifikasi."}
        />
    );
}

/** "Lokasi acara di peta" on the event edit page (DEC-07 phase 2). Shown on the map while the event is published and not yet over. */
export function EventPlaceForm({ communityId, eventId, saved, published }: { communityId: string; eventId: string; saved: Saved; published: boolean }) {
    return (
        <PinForm
            id="event-place"
            url={`/api/communities/${communityId}/events/${eventId}/place`}
            title="Lokasi acara di peta"
            intro="Opsional. Tandai tempat acara di Peta Literasi agar pembaca bisa membuka petunjuk arah. Gunakan tempat umum, bukan alamat rumah. Titik hilang dari peta setelah acara selesai."
            saved={saved}
            withRegion
            savedText={published ? "Lokasi disimpan dan tampil di Peta Literasi." : "Lokasi disimpan. Titik tampil di Peta Literasi setelah acara diterbitkan."}
        />
    );
}
