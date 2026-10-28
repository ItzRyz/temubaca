"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { ChoiceOption, Field, FormAlert, Select, TextArea } from "@/components/ui/form";

import { sendLoanRequest } from "../client";
import { borrowBlockDayOptions, disputeConsequenceLabels, type DisputeConsequence } from "../lifecycle";

const consequenceHints: Record<DisputeConsequence, string> = {
    NONE: "Tidak ada pihak yang dikenai sanksi.",
    WARNING: "Tercatat dan ditampilkan ke pihak itu di kartu pinjamannya.",
    BORROW_BLOCK: "Pihak itu tidak dapat mengajukan pinjam sampai batas waktu.",
    SUSPENSION: "Akun ditangguhkan seperti di Data Pengguna; dapat dipulihkan admin.",
};

/** Admin decision on a loan dispute (DEC-02): returned frees the copy, lost takes it off the catalog; a consequence is chosen per case. */
export function ResolveDisputePanel({ borrowingId }: { borrowingId: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [outcome, setOutcome] = useState<"" | "RETURNED" | "LOST">("");
    const [note, setNote] = useState("");
    const [consequence, setConsequence] = useState<DisputeConsequence>("NONE");
    const [party, setParty] = useState<"" | "OWNER" | "REQUESTER">("");
    const [days, setDays] = useState<number>(borrowBlockDayOptions[0]);
    const [error, setError] = useState("");

    function submit(event: FormEvent) {
        event.preventDefault();
        if (!outcome) return setError("Pilih hasil sengketa.");
        if (note.trim().length < 5) return setError("Tulis alasan keputusan minimal 5 karakter.");
        if (consequence !== "NONE" && !party) return setError("Pilih pihak yang dikenai konsekuensi.");
        setError("");
        const chosen = consequence === "NONE" ? { type: consequence } : consequence === "BORROW_BLOCK" ? { type: consequence, party, days } : { type: consequence, party };
        startTransition(async () => {
            const result = await sendLoanRequest(`/api/admin/borrowings/${borrowingId}`, "PATCH", { outcome, note, consequence: chosen });
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
            <fieldset>
                <legend className="text-sm font-semibold">Konsekuensi</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {(Object.keys(disputeConsequenceLabels) as DisputeConsequence[]).map((type) => (
                        <ChoiceOption key={type} type="radio" name={`consequence-${borrowingId}`} checked={consequence === type} onChange={() => setConsequence(type)} className="items-start rounded-lg border border-border p-3 has-checked:border-primary has-checked:bg-[#eef4ef]">
                            <span><span className="block font-semibold">{disputeConsequenceLabels[type]}</span><span className="block text-xs text-muted-foreground">{consequenceHints[type]}</span></span>
                        </ChoiceOption>
                    ))}
                </div>
            </fieldset>
            {consequence !== "NONE" && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Dikenakan pada" required>
                        {(control) => (
                            <Select {...control} value={party} onChange={(event) => setParty(event.target.value as typeof party)}>
                                <option value="">Pilih pihak</option>
                                <option value="REQUESTER">Peminjam</option>
                                <option value="OWNER">Pemilik</option>
                            </Select>
                        )}
                    </Field>
                    {consequence === "BORROW_BLOCK" && (
                        <Field label="Lama pembatasan" required>
                            {(control) => (
                                <Select {...control} value={days} onChange={(event) => setDays(Number(event.target.value))}>
                                    {borrowBlockDayOptions.map((value) => <option key={value} value={value}>{value} hari</option>)}
                                </Select>
                            )}
                        </Field>
                    )}
                </div>
            )}
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

/** Ask one or both parties for more details; the asked party sees it under "Perlu Tindakan". */
export function AskDisputePanel({ borrowingId }: { borrowingId: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [party, setParty] = useState<"OWNER" | "REQUESTER" | "BOTH">("BOTH");
    const [question, setQuestion] = useState("");
    const [error, setError] = useState("");

    function submit(event: FormEvent) {
        event.preventDefault();
        if (question.trim().length < 10) return setError("Tulis pertanyaan minimal 10 karakter.");
        setError("");
        startTransition(async () => {
            const result = await sendLoanRequest(`/api/admin/borrowings/${borrowingId}/questions`, "POST", { party, question });
            if (!result.ok) return setError(result.message);
            setQuestion("");
            router.refresh();
        });
    }

    return (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <p className="text-sm font-semibold">Minta keterangan</p>
            <Field label="Tanyakan kepada">
                {(control) => (
                    <Select {...control} value={party} onChange={(event) => setParty(event.target.value as typeof party)}>
                        <option value="BOTH">Kedua pihak</option>
                        <option value="REQUESTER">Peminjam</option>
                        <option value="OWNER">Pemilik</option>
                    </Select>
                )}
            </Field>
            <Field label="Pertanyaan" hint="Terlihat oleh kedua pihak di riwayat pinjaman.">
                {(control) => <TextArea {...control} value={question} maxLength={500} onChange={(event) => setQuestion(event.target.value)} />}
            </Field>
            <FormAlert>{error}</FormAlert>
            <button type="submit" disabled={pending} className="min-h-11 self-end rounded-lg border border-primary px-5 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-60">
                {pending ? "Mengirim..." : "Kirim Pertanyaan"}
            </button>
        </form>
    );
}
