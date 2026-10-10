"use client";

import { useState, useTransition } from "react";

import { addInterest, deleteInterest } from "../actions";

type Interest = { id: string; subject: string };

export function InterestManager({ interests }: { interests: Interest[] }) {
    const [pending, startTransition] = useTransition();
    const [message, setMessage] = useState("");

    async function submit(formData: FormData) {
        const result = await addInterest(formData);
        setMessage(result.message);
        if (result.success) (document.getElementById("interest-subject") as HTMLInputElement | null)?.form?.reset();
    }

    function remove(id: string) {
        startTransition(async () => {
            const result = await deleteInterest(id);
            setMessage(result.message ?? (result.success ? "Minat dihapus." : "Minat gagal dihapus."));
        });
    }

    return (
        <section className="mt-8 rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="font-heading text-xl font-semibold">Minat bacaan</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tambahkan kategori yang cocok dengan nama kategori buku di katalog.</p>
            <form action={submit} className="mt-4 flex flex-col gap-3 sm:flex-row">
                <label htmlFor="interest-subject" className="sr-only">Kategori minat</label>
                <input id="interest-subject" name="subject" minLength={2} maxLength={80} required placeholder="Contoh: Sejarah" className="min-h-11 flex-1 rounded-xl border border-input bg-background px-4 py-2 text-sm" />
                <button disabled={pending} className="min-h-11 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">Tambah minat</button>
            </form>
            {interests.length > 0 ? <ul className="mt-4 flex list-none flex-wrap gap-2 p-0">{interests.map((interest) => <li key={interest.id} className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm">{interest.subject}<button type="button" disabled={pending} onClick={() => remove(interest.id)} aria-label={`Hapus minat ${interest.subject}`} className="font-bold text-muted-foreground hover:text-destructive">×</button></li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">Belum ada minat tersimpan.</p>}
            <p aria-live="polite" className="mt-3 min-h-5 text-sm text-muted-foreground">{message}</p>
        </section>
    );
}
