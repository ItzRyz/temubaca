"use client";

import { ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";

import { ChoiceOption, Field, FormAlert, TextArea } from "@/components/ui/form";

import { sendLoanRequest } from "../client";
import { loanActionDone, rejectionReasons } from "../lifecycle";
import { dialogDangerButton, dialogSecondaryButton, LoanBookCard, LoanDialog } from "./loan-dialog";
import { notify } from "@/lib/toast";

const NOTE_MAX = 200;

/** Figma "Tolak Permintaan - Modal" (300:2608). */
export function RejectRequestDialog({ requestId, bookTitle, requesterName, summary, triggerClassName }: {
    requestId: string;
    bookTitle: string;
    requesterName: string;
    summary: string;
    triggerClassName: string;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [reason, setReason] = useState("");
    const [note, setNote] = useState("");
    const [markUnavailable, setMarkUnavailable] = useState(false);
    const [error, setError] = useState("");

    function submit(event: FormEvent) {
        event.preventDefault();
        if (!reason) return setError("Pilih alasan penolakan.");
        if (reason === "Lainnya" && !note.trim()) return setError("Isi catatan jika memilih \"Lainnya\".");
        setError("");
        startTransition(async () => {
            const result = await sendLoanRequest(`/api/borrow-requests/${requestId}`, "PATCH", { action: "reject", reason, note, markUnavailable });
            if (!result.ok) return setError(result.message);
            dialogRef.current?.close();
            notify.success(loanActionDone.reject);
            router.refresh();
        });
    }

    return (
        <>
            <button type="button" onClick={() => dialogRef.current?.showModal()} className={triggerClassName}>
                <X aria-hidden="true" className="size-4" /> Tolak
            </button>
            <LoanDialog
                ref={dialogRef}
                title="Tolak Permintaan"
                subtitle="Peminjam akan menerima alasan Anda. Pilih yang paling sesuai."
                onClose={() => dialogRef.current?.close()}
                footerNote="Keputusan tercatat di riwayat peminjaman."
                actions={(
                    <>
                        <button type="button" onClick={() => dialogRef.current?.close()} className={dialogSecondaryButton}>Batal</button>
                        <button type="submit" form={`reject-${requestId}`} disabled={pending} className={dialogDangerButton}>
                            <X aria-hidden="true" className="size-4" /> {pending ? "Menolak..." : "Tolak Permintaan"}
                        </button>
                    </>
                )}
            >
                <form id={`reject-${requestId}`} onSubmit={submit} noValidate className="flex flex-col gap-5">
                    <LoanBookCard title={bookTitle}>
                        <p className="text-muted-foreground">Diminta oleh {requesterName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{summary}</p>
                    </LoanBookCard>
                    <fieldset>
                        <legend className="text-sm font-medium">Alasan penolakan <span aria-hidden="true" className="text-destructive">*</span></legend>
                        <div className="mt-2 flex flex-col gap-2">
                            {rejectionReasons.map((value) => (
                                <ChoiceOption key={value} type="radio" name="reason" value={value} checked={reason === value} onChange={() => { setReason(value); setError(""); }}
                                    className="rounded-xl border border-border p-3 has-checked:border-primary has-checked:bg-[#eef4ef]">
                                    <span className="font-medium">{value}</span>
                                </ChoiceOption>
                            ))}
                        </div>
                    </fieldset>
                    <Field
                        label={<>Catatan untuk peminjam <span className="font-normal text-muted-foreground">(opsional)</span></>}
                        hint={`Wajib diisi jika memilih "Lainnya". ${note.length} / ${NOTE_MAX}`}
                    >
                        {(control) => <TextArea {...control} value={note} maxLength={NOTE_MAX} onChange={(event) => setNote(event.target.value)} placeholder="mis. Saya bisa bertemu hari Minggu di TIM Cikini." />}
                    </Field>
                    <ChoiceOption type="checkbox" checked={markUnavailable} onChange={(event) => setMarkUnavailable(event.target.checked)} className="items-start px-0">
                        <span>
                            <span className="block font-semibold">Tandai buku ini Tidak Ditawarkan sementara</span>
                            <span className="block text-xs text-muted-foreground">Berguna jika bukunya memang tidak bisa dipinjam. Anda bisa menawarkannya lagi kapan saja.</span>
                        </span>
                    </ChoiceOption>
                    <p className="flex gap-2 rounded-lg bg-[#f1efe6] px-3 py-2.5 text-xs leading-5 text-foreground/80">
                        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                        Alasan dan catatan Anda dikirim ke peminjam. Hindari membagikan data pribadi seperti alamat atau nomor telepon.
                    </p>
                    <FormAlert>{error}</FormAlert>
                </form>
            </LoanDialog>
        </>
    );
}
