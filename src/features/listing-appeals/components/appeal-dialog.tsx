"use client";

import { EyeOff, ImageIcon, Info, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import { ChoiceOption, Field, FormAlert, TextArea } from "@/components/ui/form";
import { dialogPrimaryButton, dialogSecondaryButton, LoanBookCard, LoanDialog } from "@/features/borrowing/components/loan-dialog";
import { sendCommunityRequest } from "@/features/community-management/client";
import { timeAgo } from "@/lib/format/relative-time";

import { APPEAL_DETAILS_MAX, appealFileError, appealReasons, APPEAL_FILE_TYPES } from "../rules";

/** Figma "Ajukan Banding - Modal" (301:2608) for a listing an admin has hidden. */
export function AppealDialog({ listingId, bookTitle, hiddenAt, hiddenReason }: { listingId: string; bookTitle: string; hiddenAt: string; hiddenReason: string | null }) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const fileId = useId();
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [reason, setReason] = useState("");
    const [details, setDetails] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [message, setMessage] = useState("");

    function submit(event: FormEvent) {
        event.preventDefault();
        const next: Record<string, string> = {};
        if (!reason) next.reason = "Pilih alasan banding.";
        if (details.trim().length < 10) next.details = "Jelaskan minimal 10 karakter.";
        setErrors(next);
        setMessage("");
        if (Object.keys(next).length > 0) return;
        startTransition(async () => {
            const form = new FormData();
            form.set("reason", reason);
            form.set("details", details);
            if (file) form.set("file", file);
            const result = await sendCommunityRequest(`/api/book-listings/${listingId}/appeals`, "POST", form);
            if (!result.ok) {
                setErrors(result.fieldErrors);
                setMessage(result.message);
                return;
            }
            dialogRef.current?.close();
            router.refresh();
        });
    }

    return (
        <>
            <button type="button" onClick={() => dialogRef.current?.showModal()} className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-destructive px-3 text-sm font-semibold text-destructive hover:bg-destructive/5">
                Ajukan Banding
            </button>
            <LoanDialog
                ref={dialogRef}
                title="Ajukan Banding"
                subtitle="Jelaskan mengapa listing ini sebaiknya tampil kembali. Moderator akan meninjau ulang."
                onClose={() => dialogRef.current?.close()}
                footerNote="Banding dan hasilnya tercatat di jejak audit."
                actions={(
                    <>
                        <button type="button" onClick={() => dialogRef.current?.close()} className={dialogSecondaryButton}>Batal</button>
                        <button type="submit" form={`appeal-${listingId}`} disabled={pending} className={dialogPrimaryButton}>
                            <Send aria-hidden="true" className="size-4" /> {pending ? "Mengirim..." : "Kirim Banding"}
                        </button>
                    </>
                )}
            >
                <form id={`appeal-${listingId}`} onSubmit={submit} noValidate className="flex flex-col gap-5">
                    <LoanBookCard title={bookTitle}>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive"><EyeOff aria-hidden="true" className="size-3" /> Disembunyikan Moderator</span>
                            <span className="text-muted-foreground">{timeAgo(new Date(hiddenAt))}</span>
                        </p>
                        <p className="mt-2 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">Alasan moderator</p>
                        <p className="text-sm">{hiddenReason ?? "Tidak dicantumkan."}</p>
                    </LoanBookCard>

                    <fieldset aria-describedby={errors.reason ? `appeal-reason-${listingId}` : undefined}>
                        <legend className="text-sm font-medium">Alasan banding <span aria-hidden="true" className="text-destructive">*</span></legend>
                        <div className="mt-2 flex flex-col gap-2">
                            {appealReasons.map((value) => (
                                <ChoiceOption key={value} type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)}
                                    className="rounded-xl border border-border p-3 has-checked:border-primary has-checked:bg-[#eef4ef]">
                                    <span className="font-medium">{value}</span>
                                </ChoiceOption>
                            ))}
                        </div>
                        {errors.reason && <p id={`appeal-reason-${listingId}`} role="alert" className="mt-1.5 text-[13px] text-destructive">{errors.reason}</p>}
                    </fieldset>

                    <Field
                        label={(
                            <span className="flex items-center justify-between gap-2">
                                <span>Penjelasan <span aria-hidden="true" className="text-destructive">*</span></span>
                                <span aria-hidden="true" className="text-xs font-normal text-muted-foreground">{details.length} / {APPEAL_DETAILS_MAX}</span>
                            </span>
                        )}
                        hint="Singkat dan sopan. Sertakan bukti jika ada."
                        error={errors.details}
                    >
                        {(control) => <TextArea {...control} rows={4} value={details} maxLength={APPEAL_DETAILS_MAX} onChange={(event) => setDetails(event.target.value)} placeholder="Jelaskan apa yang sudah diperbaiki atau mengapa laporan tidak tepat." />}
                    </Field>

                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">Bukti pendukung <span className="font-normal text-muted-foreground">(opsional)</span></span>
                        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-3">
                            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e7efe8] text-primary"><ImageIcon className="size-4" /></span>
                            <span className="min-w-0 flex-1 text-sm">
                                <span className="block truncate font-semibold">{file ? file.name : "Unggah foto"}</span>
                                <span className="block text-xs text-muted-foreground">Mis. foto kondisi atau halaman buku. JPG atau PNG, maksimal 5 MB.</span>
                            </span>
                            {file ? (
                                <button type="button" aria-label="Hapus foto" onClick={() => setFile(null)} className="flex size-9 items-center justify-center rounded-lg hover:bg-muted"><X aria-hidden="true" className="size-4" /></button>
                            ) : (
                                <label htmlFor={fileId} className="cursor-pointer rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
                                    Pilih File
                                    <input id={fileId} type="file" accept={APPEAL_FILE_TYPES.join(",")} className="sr-only" onChange={(event) => {
                                        const next = event.target.files?.[0] ?? null;
                                        const problem = next ? appealFileError(next) : null;
                                        setErrors((current) => { const copy = { ...current }; if (problem) copy.file = problem; else delete copy.file; return copy; });
                                        setFile(problem ? null : next);
                                        event.target.value = "";
                                    }} />
                                </label>
                            )}
                        </div>
                        {errors.file && <p role="alert" className="text-[13px] text-destructive">{errors.file}</p>}
                    </div>

                    <p className="flex gap-2 rounded-lg bg-[#f1efe6] px-3 py-2.5 text-xs leading-5 text-foreground/80">
                        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                        Listing tetap tersembunyi selama banding ditinjau. Anda akan diberi tahu hasilnya di Buku Saya.
                    </p>
                    <FormAlert>{message}</FormAlert>
                </form>
            </LoanDialog>
        </>
    );
}

/** Admin decision on an appeal; the note is shown to the owner. */
export function AppealReviewPanel({ appealId }: { appealId: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [note, setNote] = useState("");
    const [error, setError] = useState("");
    const decide = (decision: "APPROVE" | "REJECT") => startTransition(async () => {
        setError("");
        if (note.trim().length < 5) return setError("Tulis alasan keputusan minimal 5 karakter.");
        const result = await sendCommunityRequest(`/api/admin/listing-appeals/${appealId}`, "PATCH", { decision, note });
        if (!result.ok) return setError(result.fieldErrors.note ?? result.message);
        router.refresh();
    });
    return (
        <div className="mt-3 flex flex-col gap-2">
            <label htmlFor={`appeal-note-${appealId}`} className="text-xs font-semibold">Alasan keputusan <span className="font-normal text-muted-foreground">(terlihat oleh pemilik)</span></label>
            <textarea id={`appeal-note-${appealId}`} rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} className="rounded-lg border border-input bg-card px-3 py-2 text-sm" />
            <div className="flex flex-wrap gap-2">
                <button type="button" disabled={pending} onClick={() => decide("APPROVE")} className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">Terima, tampilkan lagi</button>
                <button type="button" disabled={pending} onClick={() => decide("REJECT")} className="min-h-10 rounded-lg border border-destructive px-4 text-sm font-semibold text-destructive disabled:opacity-60">Tolak banding</button>
            </div>
            <FormAlert>{error}</FormAlert>
        </div>
    );
}
