"use client";

import { Check, Plus } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";

import { FormAlert, TextInput } from "@/components/ui/form";
import { cn } from "@/lib/utils";

import { addInterest, deleteInterest } from "../actions";

type Interest = { id: string; subject: string };

const chipClass = "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60";

/** Figma "Minat & Preferensi" (179:1344): tap a category to select or release it. */
export function InterestManager({ interests, suggestions }: { interests: Interest[]; suggestions: string[] }) {
    const [pending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
    const [custom, setCustom] = useState("");
    const [optimistic, applyOptimistic] = useOptimistic(interests, (current: Interest[], change: { add?: string; removeId?: string }) =>
        change.removeId ? current.filter((item) => item.id !== change.removeId) : [...current, { id: `pending-${change.add}`, subject: change.add ?? "" }]);

    const selected = new Set(optimistic.map((item) => item.subject.toLocaleLowerCase("id-ID")));
    const others = suggestions.filter((subject) => !selected.has(subject.toLocaleLowerCase("id-ID")));

    function add(subject: string) {
        const value = subject.trim();
        if (value.length < 2) {
            setMessage({ tone: "error", text: "Minat minimal 2 karakter." });
            return;
        }
        startTransition(async () => {
            applyOptimistic({ add: value });
            const formData = new FormData();
            formData.set("subject", value);
            const result = await addInterest(formData);
            setMessage(result.success ? { tone: "success", text: `“${value}” ditambahkan ke minat.` } : { tone: "error", text: result.message });
            if (result.success) setCustom("");
        });
    }

    function remove(interest: Interest) {
        startTransition(async () => {
            applyOptimistic({ removeId: interest.id });
            const result = await deleteInterest(interest.id);
            setMessage(result.success ? { tone: "success", text: `“${interest.subject}” dilepas dari minat.` } : { tone: "error", text: result.message ?? "Minat gagal dihapus." });
        });
    }

    return (
        <section aria-labelledby="interest-title" className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 id="interest-title" className="font-heading text-xl font-semibold">Minat Baca Anda</h2>
            <p className="mt-1 text-sm text-muted-foreground">Dipakai untuk memberi rekomendasi buku. Ketuk kategori untuk memilih atau melepasnya.</p>

            <h3 className="mt-5 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Terpilih ({optimistic.length})</h3>
            {optimistic.length > 0 ? (
                <ul className="mt-2 flex list-none flex-wrap gap-2 p-0">
                    {optimistic.map((interest) => (
                        <li key={interest.id}>
                            <button type="button" disabled={pending || interest.id.startsWith("pending-")} onClick={() => remove(interest)} aria-pressed="true"
                                aria-label={`${interest.subject}, terpilih. Ketuk untuk melepas`} className={cn(chipClass, "border-primary bg-primary text-primary-foreground hover:bg-primary/90")}>
                                <Check aria-hidden="true" className="size-4" /> {interest.subject}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-2 text-sm text-muted-foreground">Belum ada minat. Pilih dari kategori di bawah.</p>
            )}

            <h3 className="mt-5 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Kategori lain</h3>
            {others.length > 0 && (
                <ul className="mt-2 flex list-none flex-wrap gap-2 p-0">
                    {others.map((subject) => (
                        <li key={subject}>
                            <button type="button" disabled={pending} onClick={() => add(subject)} aria-pressed="false" aria-label={`${subject}. Ketuk untuk memilih`}
                                className={cn(chipClass, "border-border bg-card text-foreground hover:bg-muted")}>
                                <Plus aria-hidden="true" className="size-4" /> {subject}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <form onSubmit={(event) => { event.preventDefault(); add(custom); }} className="mt-3 flex max-w-md gap-2">
                <TextInput aria-label="Tambah kategori sendiri" value={custom} onChange={(event) => setCustom(event.target.value)} minLength={2} maxLength={80} placeholder="Kategori lain, mis. Sejarah" />
                <button type="submit" disabled={pending || custom.trim().length < 2} className="h-11 shrink-0 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50">Tambah</button>
            </form>
            <FormAlert className="mt-3" tone={message?.tone ?? "success"}>{message?.text}</FormAlert>
        </section>
    );
}
