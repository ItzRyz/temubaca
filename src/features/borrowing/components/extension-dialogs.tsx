"use client";

import { CalendarPlus, Info, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";

import { ChoiceOption, Field, FormAlert, TextArea } from "@/components/ui/form";

import { sendLoanRequest } from "../client";
import { extensionDayOptions, loanActionDone, type LoanAction } from "../lifecycle";
import { dialogDangerButton, dialogPrimaryButton, dialogSecondaryButton, LoanBookCard, LoanDialog } from "./loan-dialog";
import { notify } from "@/lib/toast";

const NOTE_MAX = 200;
const dateFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" });
const DAY_MS = 24 * 60 * 60 * 1000;

function useLoanSubmit(borrowingId: string) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState("");

    function send(body: { action: LoanAction } & Record<string, unknown>) {
        setError("");
        startTransition(async () => {
            const result = await sendLoanRequest(`/api/borrowings/${borrowingId}`, "PATCH", body);
            if (!result.ok) return setError(result.message);
            dialogRef.current?.close();
            notify.success(loanActionDone[body.action]);
            router.refresh();
        });
    }
    return { dialogRef, pending, error, send };
}

/** "Perpanjang" for the reader: one request per loan, before the due date, up to 14 days (DEC-02). */
export function RequestExtensionDialog({ borrowingId, bookTitle, summary, dueAt, triggerClassName }: {
    borrowingId: string;
    bookTitle: string;
    summary: string;
    dueAt: Date | null;
    triggerClassName: string;
}) {
    const { dialogRef, pending, error, send } = useLoanSubmit(borrowingId);
    const [days, setDays] = useState<number>(extensionDayOptions[0]);
    const [note, setNote] = useState("");

    function submit(event: FormEvent) {
        event.preventDefault();
        send({ action: "request_extension", days, note });
    }

    return (
        <>
            <button type="button" onClick={() => dialogRef.current?.showModal()} className={triggerClassName}>
                <CalendarPlus aria-hidden="true" className="size-4" /> Perpanjang
            </button>
            <LoanDialog
                ref={dialogRef}
                title="Ajukan Perpanjangan"
                subtitle="Pemilik buku akan menerima atau menolak permintaan ini."
                onClose={() => dialogRef.current?.close()}
                footerNote="Perpanjangan hanya dapat diajukan satu kali per pinjaman."
                actions={(
                    <>
                        <button type="button" onClick={() => dialogRef.current?.close()} className={dialogSecondaryButton}>Batal</button>
                        <button type="submit" form={`extend-${borrowingId}`} disabled={pending} className={dialogPrimaryButton}>
                            <CalendarPlus aria-hidden="true" className="size-4" /> {pending ? "Mengirim..." : "Kirim Permintaan"}
                        </button>
                    </>
                )}
            >
                <form id={`extend-${borrowingId}`} onSubmit={submit} noValidate className="flex flex-col gap-5">
                    <LoanBookCard title={bookTitle}>
                        <p className="text-xs text-muted-foreground">{summary}</p>
                        {dueAt && <p className="mt-1 text-xs text-muted-foreground">Tenggat sekarang: {dateFormatter.format(dueAt)}</p>}
                    </LoanBookCard>
                    <fieldset>
                        <legend className="text-sm font-medium">Tambahan waktu <span aria-hidden="true" className="text-destructive">*</span></legend>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            {extensionDayOptions.map((option) => (
                                <ChoiceOption key={option} type="radio" name="days" value={String(option)} checked={days === option} onChange={() => setDays(option)}
                                    className="items-start rounded-xl border border-border p-3 has-checked:border-primary has-checked:bg-[#eef4ef]">
                                    <span>
                                        <span className="block font-semibold">{option} hari</span>
                                        {dueAt && <span className="block text-xs text-muted-foreground">Sampai {dateFormatter.format(new Date(dueAt.getTime() + option * DAY_MS))}</span>}
                                    </span>
                                </ChoiceOption>
                            ))}
                        </div>
                    </fieldset>
                    <Field label="Pesan untuk pemilik" hint={`Opsional. ${note.length} / ${NOTE_MAX}`}>
                        {(control) => <TextArea {...control} value={note} maxLength={NOTE_MAX} onChange={(event) => setNote(event.target.value)} placeholder="Mis. bukunya belum selesai saya baca." />}
                    </Field>
                    <p className="flex gap-2 rounded-lg bg-[#f1efe6] px-3 py-2.5 text-xs leading-5 text-foreground/80">
                        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                        Selama menunggu jawaban, tenggat lama tetap berlaku.
                    </p>
                    <FormAlert>{error}</FormAlert>
                </form>
            </LoanDialog>
        </>
    );
}

/** The owner declines a waiting extension, with an optional note for the reader. */
export function RejectExtensionDialog({ borrowingId, bookTitle, days, triggerClassName }: {
    borrowingId: string;
    bookTitle: string;
    days: number | null;
    triggerClassName: string;
}) {
    const { dialogRef, pending, error, send } = useLoanSubmit(borrowingId);
    const [note, setNote] = useState("");

    function submit(event: FormEvent) {
        event.preventDefault();
        send({ action: "reject_extension", note });
    }

    return (
        <>
            <button type="button" onClick={() => dialogRef.current?.showModal()} className={triggerClassName}>
                <X aria-hidden="true" className="size-4" /> Tolak Perpanjangan
            </button>
            <LoanDialog
                ref={dialogRef}
                title="Tolak Perpanjangan"
                subtitle="Tenggat pinjaman tetap seperti semula."
                onClose={() => dialogRef.current?.close()}
                actions={(
                    <>
                        <button type="button" onClick={() => dialogRef.current?.close()} className={dialogSecondaryButton}>Batal</button>
                        <button type="submit" form={`reject-extend-${borrowingId}`} disabled={pending} className={dialogDangerButton}>
                            <X aria-hidden="true" className="size-4" /> {pending ? "Mengirim..." : "Tolak"}
                        </button>
                    </>
                )}
            >
                <form id={`reject-extend-${borrowingId}`} onSubmit={submit} noValidate className="flex flex-col gap-5">
                    <LoanBookCard title={bookTitle}>
                        {days && <p className="text-xs text-muted-foreground">Diminta tambahan {days} hari</p>}
                    </LoanBookCard>
                    <Field label="Catatan untuk peminjam" hint={`Opsional. ${note.length} / ${NOTE_MAX}`}>
                        {(control) => <TextArea {...control} value={note} maxLength={NOTE_MAX} onChange={(event) => setNote(event.target.value)} placeholder="Mis. bukunya akan saya pakai minggu depan." />}
                    </Field>
                    <FormAlert>{error}</FormAlert>
                </form>
            </LoanDialog>
        </>
    );
}
