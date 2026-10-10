"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type BookListingFormProps = {
    bookId: string;
    isAuthenticated: boolean;
    /** Styling for the wrapper and trigger; used on dark surfaces such as the book detail band. */
    className?: string;
    triggerClassName?: string;
};

const conditions = [
    ["NEW", "Baru"],
    ["LIKE_NEW", "Seperti baru"],
    ["GOOD", "Baik"],
    ["FAIR", "Cukup baik"],
    ["POOR", "Perlu perhatian"],
] as const;

export function BookListingForm({ bookId, isAuthenticated, className = "mt-8", triggerClassName }: BookListingFormProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [condition, setCondition] = useState<(typeof conditions)[number][0]>("GOOD");
    const [publicLocation, setPublicLocation] = useState("");
    const [borrowingRules, setBorrowingRules] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    if (!isAuthenticated) {
        return (
            <Link href="/login" className={triggerClassName ?? "inline-flex min-h-11 items-center rounded-xl border border-primary px-5 py-3 text-sm font-semibold text-primary hover:bg-primary/5"}>
                Masuk untuk menawarkan buku
            </Link>
        );
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setPending(true);
        setError(null);
        setSaved(false);

        try {
            const response = await fetch("/api/book-listings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bookId,
                    condition,
                    ...(publicLocation.trim() ? { publicLocation: publicLocation.trim() } : {}),
                    ...(borrowingRules.trim() ? { borrowingRules: borrowingRules.trim() } : {}),
                }),
            });

            if (!response.ok) {
                setError(response.status === 429
                    ? "Terlalu banyak perubahan. Coba lagi sebentar."
                    : "Listing belum dapat disimpan. Periksa isian lalu coba lagi.");
                return;
            }

            setSaved(true);
            setOpen(false);
            router.refresh();
        } catch {
            setError("Koneksi terputus. Periksa internet lalu coba lagi.");
        } finally {
            setPending(false);
        }
    }

    return (
        <div className={className}>
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                className={triggerClassName ?? "inline-flex min-h-11 items-center rounded-xl bg-secondary px-5 py-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80"}
            >
                {open ? "Tutup formulir" : "Tawarkan salinan buku ini"}
            </button>
            {saved && <p role="status" className="mt-2 text-sm font-medium">Listing buku berhasil dibuat.</p>}
            {error && <p role="alert" className="mt-2 w-fit rounded-md bg-card px-2 py-1 text-sm text-destructive">{error}</p>}
            {open && (
                <form onSubmit={handleSubmit} className="mt-4 grid max-w-2xl gap-4 rounded-2xl border border-border/70 bg-card p-5 text-foreground">
                    <label className="grid gap-2 text-sm font-medium">
                        Kondisi buku
                        <select value={condition} onChange={(event) => setCondition(event.target.value as (typeof conditions)[number][0])} className="h-11 rounded-lg border border-input bg-background px-3">
                            {conditions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </label>
                    <label className="grid gap-2 text-sm font-medium">
                        Area/lokasi publik <span className="font-normal text-muted-foreground">(opsional)</span>
                        <input value={publicLocation} onChange={(event) => setPublicLocation(event.target.value)} maxLength={500} className="h-11 rounded-lg border border-input bg-background px-3" placeholder="Contoh: Bandung, Dago" />
                    </label>
                    <label className="grid gap-2 text-sm font-medium">
                        Aturan peminjaman <span className="font-normal text-muted-foreground">(opsional)</span>
                        <textarea value={borrowingRules} onChange={(event) => setBorrowingRules(event.target.value)} maxLength={5000} rows={3} className="rounded-lg border border-input bg-background px-3 py-2" placeholder="Tambahkan informasi yang perlu diketahui calon peminjam." />
                    </label>
                    <button type="submit" disabled={pending} className="min-h-11 justify-self-start rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                        {pending ? "Menyimpan…" : "Terbitkan listing"}
                    </button>
                </form>
            )}
        </div>
    );
}
