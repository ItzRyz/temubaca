"use client";

import { Check, Send, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";

import { ChoiceOption, Field, FormAlert, Select, TextArea, TextInput } from "@/components/ui/form";

import { sendLoanRequest } from "../client";
import { dialogPrimaryButton, dialogSecondaryButton, LoanBookCard, LoanDialog } from "./loan-dialog";
import { notify } from "@/lib/toast";
import { meetingTimeFrom, wibDate } from "../meeting-time";

const NOTE_MAX = 200;

/** Figma "Ajukan Pinjam - Modal" (299:2608) on a shared copy in Detail Buku. */
export function BorrowRequestDialog({ listingId, bookTitle, bookMeta, ownerName, conditionNote, guarantee, meetingPoints, loanChoices, triggerClassName }: {
    listingId: string;
    bookTitle: string;
    bookMeta: string;
    ownerName: string;
    conditionNote: string | null;
    /** The owner's non-money guarantee, shown at handover (28 Okt 2026). */
    guarantee: string | null;
    meetingPoints: string[];
    loanChoices: number[];
    triggerClassName: string;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [meetingPoint, setMeetingPoint] = useState(meetingPoints[0] ?? "");
    const [loanDays, setLoanDays] = useState(String(loanChoices.includes(14) ? 14 : loanChoices[loanChoices.length - 1]));
    const [preferredDate, setPreferredDate] = useState("");
    const [preferredClock, setPreferredClock] = useState("");
    const [note, setNote] = useState("");
    const [agreed, setAgreed] = useState(false);
    const [error, setError] = useState("");
    const [sent, setSent] = useState(false);

    function close() {
        dialogRef.current?.close();
        if (sent) router.refresh();
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        if (!agreed) {
            setError("Setujui etika bertukar sebelum mengirim permintaan.");
            return;
        }
        const time = meetingTimeFrom(preferredDate || undefined, preferredClock || undefined);
        if ("error" in time) {
            setError(time.error);
            return;
        }
        setError("");
        startTransition(async () => {
            const result = await sendLoanRequest("/api/borrow-requests", "POST", {
                listingId,
                meetingPoint: meetingPoint || undefined,
                loanDays: Number(loanDays),
                preferredDate: preferredDate || undefined,
                preferredClock: preferredClock || undefined,
                note,
                agreed: true,
            });
            if (result.ok) {
                setSent(true);
                notify.success("Permintaan pinjam dikirim.");
            }
            else setError(result.message);
        });
    }

    return (
        <>
            <button type="button" onClick={() => { setError(""); dialogRef.current?.showModal(); }} className={triggerClassName}>
                Ajukan Pinjam
            </button>
            {sent ? (
                <LoanDialog
                    ref={dialogRef}
                    title="Permintaan terkirim"
                    subtitle={`${ownerName} akan meninjau permintaan Anda.`}
                    onClose={close}
                    className="max-w-md"
                    actions={(
                        <>
                            <button type="button" onClick={close} className={dialogSecondaryButton}>Tutup</button>
                            <Link href="/my-listings?tab=peminjaman&view=pinjam" className={dialogPrimaryButton}>Lihat Peminjaman</Link>
                        </>
                    )}
                >
                    <div role="status" className="flex gap-3 rounded-xl bg-[#e7efe8] p-4 text-sm">
                        <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                        <span>Serah terima baru terjadi setelah pemilik menerima. Selama belum ditanggapi, Anda masih bisa membatalkannya dari Buku Saya.</span>
                    </div>
                </LoanDialog>
            ) : (
                <LoanDialog
                    ref={dialogRef}
                    title="Ajukan Pinjam"
                    subtitle="Kirim permintaan ke pemilik. Serah terima baru terjadi setelah ia menerima."
                    onClose={close}
                    footerNote="Anda dapat membatalkan selama pemilik belum menanggapi."
                    actions={(
                        <>
                            <button type="button" onClick={close} className={dialogSecondaryButton}>Batal</button>
                            <button type="submit" form={`borrow-${listingId}`} disabled={pending} className={dialogPrimaryButton}>
                                <Send aria-hidden="true" className="size-4" /> {pending ? "Mengirim..." : "Kirim Permintaan"}
                            </button>
                        </>
                    )}
                >
                    <form id={`borrow-${listingId}`} onSubmit={submit} noValidate className="flex flex-col gap-5">
                        <LoanBookCard title={bookTitle}>
                            <p className="text-muted-foreground">{bookMeta}</p>
                            <p className="mt-1">Pemilik <span className="font-semibold">{ownerName}</span></p>
                            {conditionNote && <p className="mt-1 text-xs text-muted-foreground">Kondisi: {conditionNote}</p>}
                        </LoanBookCard>

                        {meetingPoints.length > 0 ? (
                            <fieldset>
                                <legend className="text-sm font-medium">Titik temu publik <span aria-hidden="true" className="text-destructive">*</span></legend>
                                <div className="mt-2 flex flex-col gap-2">
                                    {meetingPoints.map((point) => (
                                        <ChoiceOption
                                            key={point}
                                            type="radio"
                                            name="meetingPoint"
                                            value={point}
                                            checked={meetingPoint === point}
                                            onChange={() => setMeetingPoint(point)}
                                            className="rounded-xl border border-border p-3 has-checked:border-primary has-checked:bg-[#eef4ef]"
                                        >
                                            <span>
                                                <span className="block font-semibold">{point}</span>
                                                <span className="block text-xs text-muted-foreground">Titik temu pemilik</span>
                                            </span>
                                        </ChoiceOption>
                                    ))}
                                </div>
                            </fieldset>
                        ) : (
                            <FormAlert tone="info">Pemilik belum menentukan titik temu. Tempat umum disepakati bersama setelah permintaan diterima.</FormAlert>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Lama pinjam" required hint="Mengikuti aturan pemilik.">
                                {(control) => (
                                    <Select {...control} value={loanDays} onChange={(event) => setLoanDays(event.target.value)}>
                                        {loanChoices.map((days) => <option key={days} value={days}>{days} hari</option>)}
                                    </Select>
                                )}
                            </Field>
                        </div>
                        <fieldset className="grid gap-2">
                            <legend className="text-sm font-semibold">Waktu pertemuan yang diinginkan <span className="font-normal text-muted-foreground">(opsional, WIB)</span></legend>
                            <div className="grid grid-cols-[1fr_auto] gap-3">
                                <Field label="Tanggal" hint="Jadwal pasti disepakati setelah diterima.">
                                    {(control) => (
                                        <TextInput {...control} type="date" value={preferredDate} min={wibDate()} onChange={(event) => setPreferredDate(event.target.value)} />
                                    )}
                                </Field>
                                <Field label="Jam">
                                    {(control) => (
                                        <TextInput {...control} type="time" step={900} value={preferredClock} onChange={(event) => setPreferredClock(event.target.value)} />
                                    )}
                                </Field>
                            </div>
                        </fieldset>

                        <Field
                            label={(
                                <span className="flex items-center justify-between">
                                    <span>Pesan untuk pemilik <span className="font-normal text-muted-foreground">(opsional)</span></span>
                                    <span aria-hidden="true" className="text-xs font-normal text-muted-foreground">{note.length} / {NOTE_MAX}</span>
                                </span>
                            )}
                        >
                            {(control) => (
                                <TextArea {...control} value={note} maxLength={NOTE_MAX} onChange={(event) => setNote(event.target.value)} placeholder="Perkenalkan diri singkat dan jelaskan keperluan meminjam." />
                            )}
                        </Field>

                        <p className="flex gap-2 rounded-lg bg-[#f1efe6] px-3 py-2.5 text-xs leading-5 text-foreground/80">
                            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                            Pemilik akan melihat nama tampilan Anda. Alamat rumah tidak pernah dibagikan.
                        </p>

                        {guarantee && (
                            <p className="rounded-lg border border-border px-3 py-2.5 text-sm">
                                <span className="block text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">Jaminan dari pemilik</span>
                                {guarantee}
                                <span className="mt-1 block text-xs text-muted-foreground">Cukup ditunjukkan saat serah terima. Jaminan tidak pernah berupa uang, dan Anda tidak perlu menyerahkan foto atau salinan identitas.</span>
                            </p>
                        )}

                        <ChoiceOption type="checkbox" checked={agreed} onChange={(event) => { setAgreed(event.target.checked); setError(""); }} className="items-start px-0">
                            <span>Saya bersedia mengembalikan buku tepat waktu dan bertemu di tempat publik{guarantee ? ", serta memenuhi jaminan pemilik" : ""}.</span>
                        </ChoiceOption>
                        <FormAlert>{error}</FormAlert>
                    </form>
                </LoanDialog>
            )}
        </>
    );
}
