"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { ChoiceOption, Field, FormAlert, TextArea } from "@/components/ui/form";

import { sendLoanRequest } from "../client";

/** Admin decision on a loan dispute (DEC-02): returned frees the copy, lost takes it off the catalog. */
export function ResolveDisputePanel({ borrowingId }: { borrowingId: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [outcome, setOutcome] = useState<"" | "RETURNED" | "LOST">("");
    const [note, setNote] = useState("");
    const [error, setError] = useState("");

    function submit(event: FormEvent) {
        event.preventDefault();
        if (!outcome) return setError("Pilih hasil sengketa.");
        if (note.trim().length < 5) return setError("Tulis alasan keputusan minimal 5 karakter.");
        setError("");
        startTransition(async () => {
            const result = await sendLoanRequest(`/api/admin/borrowings/${borrowingId}`, "PATCH", { outcome, note });
            if (!result.ok) return setError(result.message);
            router.refresh();
        });
    }

    return (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-xl border border-border bg-[#fcfbf7] p-4">
            <fieldset>
                <legend className="text-sm font-semibold">Keputusan</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <ChoiceOption type="radio" name={`outcome-${borrowingId}`} checked={outcome === "RETURNED"} onChange={() => setOutcome("RETURNED")} className="items-start rounded-lg border border-border p-3 has-checked:border-primary has-checked:bg-[#eef4ef]">
                        <span><span className="block font-semibold">Dinyatakan dikembalikan</span><span className="block text-xs text-muted-foreground">Salinan kembali ditawarkan.</span></span>
                    </ChoiceOption>
                    <ChoiceOption type="radio" name={`outcome-${borrowingId}`} checked={outcome === "LOST"} onChange={() => setOutcome("LOST")} className="items-start rounded-lg border border-border p-3 has-checked:border-primary has-checked:bg-[#eef4ef]">
                        <span><span className="block font-semibold">Dinyatakan hilang</span><span className="block text-xs text-muted-foreground">Salinan ditandai tidak ditawarkan.</span></span>
                    </ChoiceOption>
                </div>
            </fieldset>
            <Field label="Alasan keputusan" required hint="Terlihat oleh kedua pihak dan tercatat di jejak audit.">
                {(control) => <TextArea {...control} value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />}
            </Field>
            <FormAlert>{error}</FormAlert>
            <button type="submit" disabled={pending} className="min-h-11 self-end rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {pending ? "Menyimpan..." : "Simpan Keputusan"}
            </button>
        </form>
    );
}
