"use client";

import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormAlert, TextInput } from "@/components/ui/form";
import { sendCommunityRequest, type FieldErrors } from "@/features/community-management/client";

import { PointPicker } from "./point-picker";

type Saved = { addressPublic: string | null; latitude: number; longitude: number; hidden: boolean } | null;

/**
 * "Titik temu di peta" on the community manage page (DEC-07). Optional; the pin shows on the Peta
 * Literasi only while the community is VERIFIED and an admin has not hidden it.
 */
export function CommunityPlaceForm({ communityId, saved, verified }: { communityId: string; saved: Saved; verified: boolean }) {
    const router = useRouter();
    const [values, setValues] = useState({
        addressPublic: saved?.addressPublic ?? "",
        latitude: saved ? String(saved.latitude) : "",
        longitude: saved ? String(saved.longitude) : "",
    });
    const [errors, setErrors] = useState<FieldErrors>({});
    const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
    const [pending, setPending] = useState(false);
    const url = `/api/communities/${communityId}/place`;

    async function save() {
        setPending(true);
        setMessage(null);
        const result = await sendCommunityRequest(url, "PUT", values);
        setPending(false);
        if (!result.ok) {
            setErrors(result.fieldErrors);
            setMessage({ tone: "error", text: result.message });
            return;
        }
        setErrors({});
        setMessage({ tone: "success", text: verified ? "Titik temu disimpan dan tampil di Peta Literasi." : "Titik temu disimpan. Titik tampil di Peta Literasi setelah komunitas terverifikasi." });
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
        setValues({ addressPublic: "", latitude: "", longitude: "" });
        setMessage({ tone: "success", text: "Titik temu dihapus dari peta." });
        router.refresh();
    }

    return (
        <section aria-labelledby="community-place-title" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 id="community-place-title" className="flex items-center gap-2 font-heading text-xl font-semibold text-primary">
                <MapPin aria-hidden="true" className="size-5" /> Titik temu di peta
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
                Opsional. Pasang satu tempat umum tempat komunitas biasa berkumpul, misalnya taman, kafe, atau perpustakaan. Jangan memakai alamat rumah. Titik ini dilihat semua orang di Peta Literasi.
            </p>
            {saved?.hidden && <FormAlert tone="error" className="mt-4">Titik ini disembunyikan tim TemuBaca dan tidak tampil di peta. Hubungi bantuan bila menurutmu ini keliru.</FormAlert>}
            <form onSubmit={(event) => { event.preventDefault(); void save(); }} noValidate className="mt-4 flex flex-col gap-4">
                <Field label="Nama tempat atau alamat publik" required error={errors.addressPublic} hint="Contoh: Taman Suropati, Jl. Taman Suropati, Menteng.">
                    {(control) => <TextInput {...control} value={values.addressPublic} maxLength={200} onChange={(event) => setValues((current) => ({ ...current, addressPublic: event.target.value }))} />}
                </Field>
                <PointPicker value={values} onChange={(point) => setValues((current) => ({ ...current, ...point }))} errors={{ latitude: errors.latitude, longitude: errors.longitude }} />
                {message && <FormAlert tone={message.tone}>{message.text}</FormAlert>}
                <div className="flex flex-wrap gap-3">
                    <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                        {pending ? "Menyimpan…" : "Simpan titik temu"}
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
