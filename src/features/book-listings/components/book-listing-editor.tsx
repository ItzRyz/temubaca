"use client";

import { useState, type FormEvent } from "react";

type BookListingEditorProps = {
    listingId: string;
    initialCondition: string;
    initialLocation: string | null;
    initialRules: string | null;
};

const conditions = [
    ["NEW", "Baru"],
    ["LIKE_NEW", "Seperti baru"],
    ["GOOD", "Baik"],
    ["FAIR", "Cukup baik"],
    ["POOR", "Perlu perhatian"],
] as const;

export function BookListingEditor({ listingId, initialCondition, initialLocation, initialRules }: BookListingEditorProps) {
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
        } catch {
            setError("Koneksi terputus. Coba lagi.");
        } finally {
            setPending(false);
        }
    }

    return (
        <details className="mt-4 border-t border-border/70 pt-4">
            <summary className="cursor-pointer text-sm font-semibold text-primary">Ubah detail listing</summary>
            <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
                <label className="grid gap-2 text-sm font-medium">
                    Kondisi buku
                    <select value={condition} onChange={(event) => setCondition(event.target.value)} className="h-10 rounded-lg border border-input bg-background px-3">
                        {conditions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                    Area/lokasi publik
                    <input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={500} className="h-10 rounded-lg border border-input bg-background px-3" />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                    Aturan peminjaman
                    <textarea value={rules} onChange={(event) => setRules(event.target.value)} maxLength={5000} rows={3} className="rounded-lg border border-input bg-background px-3 py-2" />
                </label>
                <button type="submit" disabled={pending} className="min-h-10 justify-self-start rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-60">
                    {pending ? "Menyimpan…" : "Simpan perubahan"}
                </button>
                {message && <p role="status" className="text-sm text-primary">{message}</p>}
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            </form>
        </details>
    );
}
