"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Field, FormAlert, Select, TextArea, TextInput } from "@/components/ui/form";

type BookListingEditorProps = {
    listingId: string;
    initialCondition: string;
    initialLocation: string | null;
    initialRules: string | null;
};

const conditions = [
    ["NEW", "Baru"],
    ["LIKE_NEW", "Sangat baik"],
    ["GOOD", "Baik"],
    ["FAIR", "Layak baca"],
    ["POOR", "Perlu perhatian"],
] as const;

export function BookListingEditor({ listingId, initialCondition, initialLocation, initialRules }: BookListingEditorProps) {
    const router = useRouter();
    const [condition, setCondition] = useState(initialCondition);
    const [location, setLocation] = useState(initialLocation ?? "");
    const [rules, setRules] = useState(initialRules ?? "");
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setPending(true);
        setMessage(null);
        setError(null);

        try {
            const response = await fetch(`/api/book-listings/${listingId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    condition,
                    publicLocation: location.trim() || null,
                    borrowingRules: rules.trim() || null,
                }),
            });

            if (!response.ok) {
                setError(response.status === 429
                    ? "Terlalu banyak perubahan. Coba lagi sebentar."
                    : "Perubahan belum dapat disimpan.");
                return;
            }

            setMessage("Perubahan berhasil disimpan.");
            router.refresh();
        } catch {
            setError("Koneksi terputus. Coba lagi.");
        } finally {
            setPending(false);
        }
    }

    return (
        <details className="mt-3 border-t border-border/70 pt-3">
            <summary className="cursor-pointer text-sm font-semibold text-primary">Ubah detail listing</summary>
            <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
                <Field label="Kondisi buku">
                    {(control) => (
                        <Select {...control} value={condition} onChange={(event) => setCondition(event.target.value)}>
                            {conditions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </Select>
                    )}
                </Field>
                <Field label="Area/lokasi publik" hint="Tulis area umum seperti nama taman atau stasiun, bukan alamat rumah.">
                    {(control) => <TextInput {...control} value={location} onChange={(event) => setLocation(event.target.value)} maxLength={500} />}
                </Field>
                <Field label="Aturan peminjaman">
                    {(control) => <TextArea {...control} value={rules} onChange={(event) => setRules(event.target.value)} maxLength={5000} />}
                </Field>
                <button type="submit" disabled={pending} className="min-h-11 justify-self-start rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-60">
                    {pending ? "Menyimpan…" : "Simpan perubahan"}
                </button>
                <FormAlert tone="success">{message}</FormAlert>
                <FormAlert>{error}</FormAlert>
            </form>
        </details>
    );
}
