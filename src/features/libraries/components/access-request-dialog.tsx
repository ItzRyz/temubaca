"use client";

import { Check, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";

import { ChoiceOption, Field, FormAlert, TextArea } from "@/components/ui/form";
import { sendLoanRequest } from "@/features/borrowing/client";
import { dialogPrimaryButton, dialogSecondaryButton, LoanBookCard, LoanDialog } from "@/features/borrowing/components/loan-dialog";

import { ACCESS_MESSAGE_MAX } from "../access";

/** "Ajukan Akses" on a library that holds the book and accepts requests through TemuBaca (TB-023). */
export function AccessRequestDialog({ libraryId, libraryName, bookId, bookTitle, accessRules, pickupDays, triggerClassName }: {
    libraryId: string;
    libraryName: string;
    bookId: string;
    bookTitle: string;
    accessRules: string | null;
    pickupDays: number;
    triggerClassName: string;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [message, setMessage] = useState("");
    const [agreed, setAgreed] = useState(false);
    const [error, setError] = useState("");
    const [sent, setSent] = useState(false);

    function close() {
        dialogRef.current?.close();
        if (sent) router.refresh();
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        if (!agreed) return setError("Setujui aturan perpustakaan sebelum mengirim pengajuan.");
        setError("");
        startTransition(async () => {
            const result = await sendLoanRequest("/api/book-accesses", "POST", { libraryId, bookId, message, agreed: true });
            if (result.ok) setSent(true);
            else setError(result.message);
        });
    }

    return (
        <>
            <button type="button" onClick={() => { setError(""); dialogRef.current?.showModal(); }} className={triggerClassName}>
                Ajukan Akses
            </button>
            {sent ? (
                <LoanDialog
                    ref={dialogRef}
                    title="Pengajuan terkirim"
                    subtitle={`${libraryName} akan meninjau pengajuan Anda.`}
                    onClose={close}
                    className="max-w-md"
                    actions={(
                        <>
                            <button type="button" onClick={close} className={dialogSecondaryButton}>Tutup</button>
                            <Link href="/my-listings?tab=peminjaman&view=perpustakaan" className={dialogPrimaryButton}>Lihat Pengajuan</Link>
                        </>
                    )}
                >
                    <div role="status" className="flex gap-3 rounded-xl bg-[#e7efe8] p-4 text-sm">
                        <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                        <span>Bila diterima, buku dapat diambil dalam {pickupDays} hari. Statusnya tampil di Buku Saya → Peminjaman → Perpustakaan.</span>
                    </div>
                </LoanDialog>
            ) : (
                <LoanDialog
                    ref={dialogRef}
                    title="Ajukan Akses"
                    subtitle="Minta perpustakaan menyiapkan buku ini untuk dipinjam atau dibaca di tempat."
                    onClose={close}
                    footerNote="Anda dapat membatalkan sampai buku diambil."
                    actions={(
                        <>
                            <button type="button" onClick={close} className={dialogSecondaryButton}>Batal</button>
                            <button type="submit" form={`access-${libraryId}`} disabled={pending} className={dialogPrimaryButton}>
                                <Send aria-hidden="true" className="size-4" /> {pending ? "Mengirim..." : "Kirim Pengajuan"}
                            </button>
                        </>
                    )}
                >
                    <form id={`access-${libraryId}`} onSubmit={submit} noValidate className="flex flex-col gap-5">
                        <LoanBookCard title={bookTitle}>
                            <p className="text-muted-foreground">{libraryName}</p>
                        </LoanBookCard>
                        {accessRules && (
                            <p className="rounded-lg border border-border px-3 py-2.5 text-sm">
                                <span className="block text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">Aturan perpustakaan</span>
                                {accessRules}
                            </p>
                        )}
                        <Field label={<>Pesan untuk perpustakaan <span className="font-normal text-muted-foreground">(opsional)</span></>} hint={`Mis. ingin membaca di tempat atau meminjam. Jangan cantumkan alamat atau nomor telepon. ${message.length} / ${ACCESS_MESSAGE_MAX}`}>
                            {(control) => <TextArea {...control} value={message} maxLength={ACCESS_MESSAGE_MAX} onChange={(event) => setMessage(event.target.value)} />}
                        </Field>
                        <p className="text-xs text-muted-foreground">Pengelola perpustakaan melihat nama tampilan Anda, bukan email Anda.</p>
                        <ChoiceOption type="checkbox" checked={agreed} onChange={(event) => { setAgreed(event.target.checked); setError(""); }} className="items-start px-0">
                            <span>Saya akan mengikuti aturan perpustakaan dan mengambil buku dalam {pickupDays} hari bila diterima.</span>
                        </ChoiceOption>
                        <FormAlert>{error}</FormAlert>
                    </form>
                </LoanDialog>
            )}
        </>
    );
}
