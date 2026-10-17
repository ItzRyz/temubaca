"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Field, FormAlert, Select, TextArea, TextInput } from "@/components/ui/form";

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
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [condition, setCondition] = useState<(typeof conditions)[number][0]>("GOOD");
    const [publicLocation, setPublicLocation] = useState("");
    const [borrowingRules, setBorrowingRules] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    if (!isAuthenticated) {
        return (
            <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={triggerClassName ?? "inline-flex min-h-11 items-center rounded-xl border border-primary px-5 py-3 text-sm font-semibold text-primary hover:bg-primary/5"}>
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
            <FormAlert tone="success" className="mt-2 w-fit bg-card">{saved ? "Listing buku berhasil dibuat." : null}</FormAlert>
            <FormAlert className="mt-2 w-fit bg-card">{error}</FormAlert>
            {open && (
                <form onSubmit={handleSubmit} className="mt-4 grid max-w-2xl gap-4 rounded-2xl border border-border/70 bg-card p-5 text-foreground">
                    <Field label="Kondisi buku">
                        {(control) => (
                            <Select {...control} value={condition} onChange={(event) => setCondition(event.target.value as (typeof conditions)[number][0])}>
                                {conditions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </Select>
                        )}
                    </Field>
                    <Field label={<>Area/lokasi publik <span className="font-normal text-muted-foreground">(opsional)</span></>} hint="Tulis area umum seperti nama taman atau stasiun, bukan alamat rumah.">
                        {(control) => <TextInput {...control} value={publicLocation} onChange={(event) => setPublicLocation(event.target.value)} maxLength={500} placeholder="Contoh: Bandung, Dago" />}
                    </Field>
                    <Field label={<>Aturan peminjaman <span className="font-normal text-muted-foreground">(opsional)</span></>}>
                        {(control) => <TextArea {...control} value={borrowingRules} onChange={(event) => setBorrowingRules(event.target.value)} maxLength={5000} placeholder="Tambahkan informasi yang perlu diketahui calon peminjam." />}
                    </Field>
                    <button type="submit" disabled={pending} className="min-h-11 justify-self-start rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                        {pending ? "Menyimpan…" : "Terbitkan listing"}
                    </button>
                </form>
            )}
        </div>
    );
}
