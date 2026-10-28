"use client";

import { AlertTriangle, Info, MessageSquarePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";

import { ChoiceOption, Field, FormAlert, TextArea } from "@/components/ui/form";

import { sendLoanRequest } from "../client";
import { problemReasons } from "../lifecycle";
import { dialogDangerButton, dialogPrimaryButton, dialogSecondaryButton, LoanBookCard, LoanDialog } from "./loan-dialog";

const DETAILS_MAX = 500;
const INFO_MAX = 1_000;

/** "Laporkan Masalah" on an active loan: opens a dispute that an admin settles (DEC-02). */
export function ReportProblemDialog({ borrowingId, bookTitle, summary, triggerClassName }: {
    borrowingId: string;
    bookTitle: string;
    summary: string;
    triggerClassName: string;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [reason, setReason] = useState("");
    const [details, setDetails] = useState("");
    const [error, setError] = useState("");

    function submit(event: FormEvent) {
        event.preventDefault();
        if (!reason) return setError("Pilih jenis masalah.");
        if (details.trim().length < 10) return setError("Jelaskan masalahnya minimal 10 karakter.");
        setError("");
        startTransition(async () => {
            const result = await sendLoanRequest(`/api/borrowings/${borrowingId}`, "PATCH", { action: "report_problem", reason, details });
            if (!result.ok) return setError(result.message);
            dialogRef.current?.close();
            router.refresh();
        });
    }

    return (
        <>
            <button type="button" onClick={() => dialogRef.current?.showModal()} className={triggerClassName}>
                <AlertTriangle aria-hidden="true" className="size-4" /> Laporkan Masalah
            </button>
            <LoanDialog
                ref={dialogRef}
                title="Laporkan Masalah"
                subtitle="Pengelola TemuBaca akan meninjau dan memutuskan bersama kedua pihak."
                onClose={() => dialogRef.current?.close()}
                footerNote="Laporan dan keputusannya tercatat di riwayat peminjaman."
                actions={(
                    <>
                        <button type="button" onClick={() => dialogRef.current?.close()} className={dialogSecondaryButton}>Batal</button>
                        <button type="submit" form={`problem-${borrowingId}`} disabled={pending} className={dialogDangerButton}>
                            <AlertTriangle aria-hidden="true" className="size-4" /> {pending ? "Mengirim..." : "Kirim Laporan"}
                        </button>
                    </>
                )}
            >
                <form id={`problem-${borrowingId}`} onSubmit={submit} noValidate className="flex flex-col gap-5">
                    <LoanBookCard title={bookTitle}>
                        <p className="text-xs text-muted-foreground">{summary}</p>
                    </LoanBookCard>
                    <fieldset>
                        <legend className="text-sm font-medium">Jenis masalah <span aria-hidden="true" className="text-destructive">*</span></legend>
                        <div className="mt-2 flex flex-col gap-2">
                            {problemReasons.map((item) => (
                                <ChoiceOption key={item.value} type="radio" name="reason" value={item.value} checked={reason === item.value} onChange={() => { setReason(item.value); setError(""); }}
                                    className="items-start rounded-xl border border-border p-3 has-checked:border-primary has-checked:bg-[#eef4ef]">
                                    <span>
                                        <span className="block font-semibold">{item.value}</span>
                                        <span className="block text-xs text-muted-foreground">{item.description}</span>
                                    </span>
                                </ChoiceOption>
                            ))}
                        </div>
                    </fieldset>
                    <Field label="Penjelasan" required hint={`Singkat dan sopan. Jangan cantumkan alamat atau nomor telepon. ${details.length} / ${DETAILS_MAX}`}>
                        {(control) => <TextArea {...control} value={details} maxLength={DETAILS_MAX} onChange={(event) => setDetails(event.target.value)} placeholder="Ceritakan apa yang terjadi." />}
                    </Field>
                    <p className="flex gap-2 rounded-lg bg-[#f1efe6] px-3 py-2.5 text-xs leading-5 text-foreground/80">
                        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                        Pinjaman terkunci selama ditinjau. Pengelola memutuskan buku dinyatakan dikembalikan atau hilang; tidak ada ganti rugi uang di TemuBaca.
                    </p>
                    <FormAlert>{error}</FormAlert>
                </form>
            </LoanDialog>
        </>
    );
}

/** "Tambah Keterangan" while a dispute is reviewed: answers the admin's question or adds new details. */
export function AddDisputeInfoDialog({ borrowingId, bookTitle, summary, question, triggerClassName }: {
    borrowingId: string;
    bookTitle: string;
    summary: string;
    /** The admin's open question to this party, if any. */
    question: string | null;
    triggerClassName: string;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [details, setDetails] = useState("");
    const [error, setError] = useState("");

    function submit(event: FormEvent) {
        event.preventDefault();
        if (details.trim().length < 10) return setError("Tulis keterangan minimal 10 karakter.");
        setError("");
        startTransition(async () => {
            const result = await sendLoanRequest(`/api/borrowings/${borrowingId}`, "PATCH", { action: "add_dispute_info", details });
            if (!result.ok) return setError(result.message);
            setDetails("");
            dialogRef.current?.close();
            router.refresh();
        });
    }

    return (
        <>
            <button type="button" onClick={() => dialogRef.current?.showModal()} className={triggerClassName}>
                <MessageSquarePlus aria-hidden="true" className="size-4" /> {question ? "Jawab Pengelola" : "Tambah Keterangan"}
            </button>
            <LoanDialog
                ref={dialogRef}
                title={question ? "Jawab Pengelola" : "Tambah Keterangan"}
                subtitle="Keterangan Anda terlihat oleh pengelola dan pihak lain di riwayat pinjaman."
                onClose={() => dialogRef.current?.close()}
                footerNote="Tercatat di riwayat peminjaman."
                actions={(
                    <>
                        <button type="button" onClick={() => dialogRef.current?.close()} className={dialogSecondaryButton}>Batal</button>
                        <button type="submit" form={`dispute-info-${borrowingId}`} disabled={pending} className={dialogPrimaryButton}>
                            {pending ? "Mengirim..." : "Kirim Keterangan"}
                        </button>
                    </>
                )}
            >
                <form id={`dispute-info-${borrowingId}`} onSubmit={submit} noValidate className="flex flex-col gap-5">
                    <LoanBookCard title={bookTitle}>
                        <p className="text-xs text-muted-foreground">{summary}</p>
                    </LoanBookCard>
                    {question && (
                        <p className="rounded-lg bg-[#fbecc4] px-3 py-2.5 text-sm text-[#5c3d00]">
                            <span className="block text-[11px] font-semibold tracking-[0.06em] uppercase">Pertanyaan pengelola</span>
                            {question}
                        </p>
                    )}
                    <Field label="Keterangan" required hint={`Kronologi, waktu, atau bukti yang bisa dicek (mis. tautan foto). Jangan cantumkan alamat atau nomor telepon. ${details.length} / ${INFO_MAX}`}>
                        {(control) => <TextArea {...control} value={details} maxLength={INFO_MAX} onChange={(event) => setDetails(event.target.value)} />}
                    </Field>
                    <FormAlert>{error}</FormAlert>
                </form>
            </LoanDialog>
        </>
    );
}
