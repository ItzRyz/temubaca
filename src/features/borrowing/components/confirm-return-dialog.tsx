"use client";

import { RotateCcw, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import { Field, FormAlert, TextArea } from "@/components/ui/form";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

import { sendLoanRequest } from "../client";
import { loanActionDone } from "../lifecycle";
import { dialogPrimaryButton, dialogSecondaryButton, LoanBookCard, LoanDialog } from "./loan-dialog";

const COMMENT_MAX = 500;
const ratingLabels = ["", "Buruk", "Kurang", "Cukup", "Baik", "Sangat baik"] as const;

/**
 * "Konfirmasi Pengembalian" for the lender (30 Okt 2026): confirms the return and may leave a review of the
 * borrower in the same request, so both are saved or neither. The review is optional.
 */
export function ConfirmReturnDialog({ borrowingId, bookTitle, borrowerName, summary, triggerClassName }: {
    borrowingId: string;
    bookTitle: string;
    borrowerName: string;
    summary: string;
    triggerClassName: string;
}) {
    const router = useRouter();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const ratingId = useId();
    const [pending, startTransition] = useTransition();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [error, setError] = useState("");

    function send(withReview: boolean) {
        if (withReview && rating === 0) {
            setError("Pilih 1–5 bintang, atau konfirmasi tanpa ulasan.");
            return;
        }
        setError("");
        startTransition(async () => {
            const result = await sendLoanRequest(`/api/borrowings/${borrowingId}`, "PATCH", {
                action: "confirm_return",
                ...(withReview ? { review: { rating, comment: comment.trim() || undefined } } : {}),
            });
            if (!result.ok) return setError(result.message);
            dialogRef.current?.close();
            notify.success(withReview ? "Pengembalian dikonfirmasi dan ulasan tersimpan." : loanActionDone.confirm_return);
            router.refresh();
        });
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        send(true);
    }

    return (
        <>
            <button type="button" onClick={() => dialogRef.current?.showModal()} className={triggerClassName}>
                <RotateCcw aria-hidden="true" className="size-4" /> Konfirmasi Pengembalian
            </button>
            <LoanDialog
                ref={dialogRef}
                title="Konfirmasi Pengembalian"
                subtitle={`Pastikan buku sudah kembali dari ${borrowerName}. Ulasan membantu pemberi pinjam lain.`}
                onClose={() => dialogRef.current?.close()}
                footerNote="Ulasan opsional dan hanya bisa diberikan sekali untuk pinjaman ini."
                actions={(
                    <>
                        <button type="button" disabled={pending} onClick={() => send(false)} className={`${dialogSecondaryButton} whitespace-nowrap`}>
                            {pending ? "Memproses…" : "Tanpa ulasan"}
                        </button>
                        <button type="submit" form={`return-${borrowingId}`} disabled={pending} className={`${dialogPrimaryButton} whitespace-nowrap`}>
                            <RotateCcw aria-hidden="true" className="size-4" /> {pending ? "Menyimpan…" : "Kirim ulasan & konfirmasi"}
                        </button>
                    </>
                )}
            >
                <form id={`return-${borrowingId}`} onSubmit={submit} noValidate className="flex flex-col gap-5">
                    <LoanBookCard title={bookTitle}>
                        <p className="text-xs text-muted-foreground">{summary}</p>
                    </LoanBookCard>
                    <fieldset>
                        <legend id={ratingId} className="text-sm font-medium">Ulasan untuk {borrowerName} <span className="font-normal text-muted-foreground">(opsional)</span></legend>
                        <div role="radiogroup" aria-labelledby={ratingId} className="mt-2 flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((value) => (
                                <label key={value} className="cursor-pointer rounded-md p-1 has-focus-visible:outline-2 has-focus-visible:outline-ring">
                                    <input type="radio" name="rating" value={value} checked={rating === value} onChange={() => { setRating(value); setError(""); }} className="sr-only" />
                                    <Star aria-hidden="true" className={cn("size-7", value <= rating ? "fill-[#e8a33d] text-[#e8a33d]" : "text-muted-foreground")} />
                                    <span className="sr-only">{value} bintang, {ratingLabels[value]}</span>
                                </label>
                            ))}
                            <span aria-live="polite" className="ml-2 text-sm text-muted-foreground">{rating ? ratingLabels[rating] : "Belum dinilai"}</span>
                        </div>
                    </fieldset>
                    <Field label="Catatan" hint={`Opsional. Misalnya ketepatan waktu dan kondisi buku. ${comment.length} / ${COMMENT_MAX}`}>
                        {(control) => (
                            <TextArea {...control} value={comment} maxLength={COMMENT_MAX} onChange={(event) => setComment(event.target.value)}
                                placeholder="Mis. tepat waktu, buku dirawat dengan baik." />
                        )}
                    </Field>
                    <FormAlert>{error}</FormAlert>
                </form>
            </LoanDialog>
        </>
    );
}
