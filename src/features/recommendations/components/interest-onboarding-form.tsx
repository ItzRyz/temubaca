"use client";

import { Check, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { FormAlert, TextInput } from "@/components/ui/form";
import { genres } from "@/features/books/genres";
import { withTourFlag } from "@/features/onboarding/tour-steps";
import { RegionSelect } from "@/features/regions/components/region-select";
import { cn } from "@/lib/utils";

import { saveInterestOnboarding } from "../actions";
import { MIN_ONBOARDING_INTERESTS } from "../onboarding";
import { notify } from "@/lib/toast";

const chipClass = "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60";
const key = (subject: string) => subject.toLocaleLowerCase("id-ID");

/** "Pilih minat": genres to tap, own interests to type, an optional kab/kota; at least three interests. */
export function InterestOnboardingForm({ next, regionCode }: { next: string; regionCode: string | null }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [selected, setSelected] = useState<string[]>([]);
    const [custom, setCustom] = useState("");
    const [region, setRegion] = useState(regionCode ?? "");
    const [error, setError] = useState("");
    const chosen = new Set(selected.map(key));
    const own = selected.filter((subject) => !genres.some((genre) => key(genre.label) === key(subject)));
    const missing = Math.max(0, MIN_ONBOARDING_INTERESTS - selected.length);

    const toggle = (subject: string) => {
        setError("");
        setSelected((current) => (current.some((item) => key(item) === key(subject)) ? current.filter((item) => key(item) !== key(subject)) : [...current, subject]));
    };

    function addCustom(event: FormEvent) {
        event.preventDefault();
        const value = custom.trim().replace(/\s+/g, " ");
        if (value.length < 2) return setError("Minat minimal 2 karakter.");
        if (!chosen.has(key(value))) setSelected((current) => [...current, value.slice(0, 80)]);
        setCustom("");
        setError("");
    }

    function save() {
        startTransition(async () => {
            const result = await saveInterestOnboarding({ subjects: selected, regionCode: region });
            if (!result.success) return setError(result.message);
            notify.success("Minat bacamu disimpan.");
            // "Panduan TemuBaca" opens once after this page (it checks whether the account has seen it).
            router.replace(withTourFlag(next));
            router.refresh();
        });
    }

    return (
        <div className="flex flex-col gap-6">
            <section aria-labelledby="genre-title">
                <h2 id="genre-title" className="text-sm font-semibold">Kategori bacaan</h2>
                <ul className="mt-3 flex list-none flex-wrap gap-2 p-0">
                    {genres.map((genre) => {
                        const on = chosen.has(key(genre.label));
                        return (
                            <li key={genre.slug}>
                                <button type="button" onClick={() => toggle(genre.label)} aria-pressed={on}
                                    className={cn(chipClass, on ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : "border-border bg-card text-foreground hover:bg-muted")}>
                                    {on ? <Check aria-hidden="true" className="size-4" /> : <Plus aria-hidden="true" className="size-4" />} {genre.label}
                                </button>
                            </li>
                        );
                    })}
                    {own.map((subject) => (
                        <li key={subject}>
                            <button type="button" onClick={() => toggle(subject)} aria-pressed="true" aria-label={`${subject}, terpilih. Ketuk untuk melepas`}
                                className={cn(chipClass, "border-primary bg-primary text-primary-foreground hover:bg-primary/90")}>
                                <X aria-hidden="true" className="size-4" /> {subject}
                            </button>
                        </li>
                    ))}
                </ul>
                <form onSubmit={addCustom} className="mt-3 flex max-w-md gap-2">
                    <TextInput aria-label="Tambah minat sendiri" value={custom} maxLength={80} onChange={(event) => setCustom(event.target.value)} placeholder="Minat lain, mis. Sains populer" />
                    <button type="submit" disabled={custom.trim().length < 2} className="h-11 shrink-0 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50">Tambah</button>
                </form>
            </section>

            <section aria-labelledby="region-title" className="max-w-md">
                <h2 id="region-title" className="sr-only">Wilayah</h2>
                <RegionSelect id="onboarding-region" label="Kabupaten/kota (opsional)" value={region} onChange={setRegion} emptyLabel="Tidak diisi"
                    hint="Untuk rekomendasi komunitas di sekitarmu. Tidak ditampilkan ke orang lain." />
            </section>

            <FormAlert>{error}</FormAlert>
            <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={() => { router.replace(withTourFlag(next)); router.refresh(); }} className="min-h-11 rounded-lg px-4 text-sm font-semibold text-muted-foreground hover:bg-muted">
                    Lewati dulu
                </button>
                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                    <p aria-live="polite" className="text-sm text-muted-foreground">
                        {selected.length} dipilih{missing ? ` · pilih ${missing} lagi` : ""}
                    </p>
                    <button type="button" onClick={save} disabled={pending || missing > 0} className="min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                        {pending ? "Menyimpan..." : "Simpan & Lanjut"}
                    </button>
                </div>
            </div>
        </div>
    );
}
