"use client";

import { AlertTriangle, BookOpen, Check, Clock, Flag, RefreshCw, Send, ShieldCheck, X } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";

import { ChoiceOption, Field, FormAlert, TextArea } from "@/components/ui/form";
import { cn } from "@/lib/utils";

import { reportReasonsFor, type ReportTargetType } from "../report-reasons";

const targetLabels: Record<ReportTargetType, string> = {
    BOOK: "Buku",
    BOOK_LISTING: "Salinan Buku",
    COMMUNITY: "Komunitas",
    EVENT: "Acara",
    MERCHANDISE_LISTING: "Merchandise",
    USER: "Akun",
};

const DETAILS_MAX = 500;

/** `failed` keeps the form filled and turns the submit into "Coba Lagi"; `limited` is the 429 state. */
type Status = "idle" | "sending" | "success" | "failed" | "limited";

function initialsOf(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

/**
 * Report dialog (Figma "Laporan" 25:6948 and 213:*): reasons per content type, a card naming what is
 * reported, and distinct sending, sent, failed, and rate-limited states.
 */
export function ReportForm({ targetType, targetId, isAuthenticated, label = "Laporkan konten", targetName, targetMeta, triggerClassName }: {
    targetType: ReportTargetType;
    targetId: string;
    isAuthenticated: boolean;
    /** Trigger text. */
    label?: string;
    /** Replaces the default text-link trigger styling. */
    triggerClassName?: string;
    /** Shown on the target card, e.g. the book title. */
    targetName?: string;
    /** Second line on the target card, e.g. the author or the event date. */
    targetMeta?: string;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const titleId = useId();
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState("");
    const [details, setDetails] = useState("");

    if (!isAuthenticated) return null;
    const reasons = reportReasonsFor(targetType);
    const kind = targetLabels[targetType];

    function open() {
        setStatus("idle");
        setError("");
        setDetails("");
        formRef.current?.reset();
        dialogRef.current?.showModal();
    }

    function close() {
        dialogRef.current?.close();
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const reason = new FormData(event.currentTarget).get("reason");
        if (typeof reason !== "string" || !reason) {
            setError("Pilih salah satu alasan laporan.");
            return;
        }

        setStatus("sending");
        setError("");
        try {
            const response = await fetch("/api/reports", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ targetType, targetId, reason, details: details.trim() || undefined }),
            });
            if (response.status === 429) {
                setStatus("limited");
                return;
            }
            const payload = await response.json().catch(() => null) as { success?: boolean; error?: { message?: string } } | null;
            if (!response.ok || !payload?.success) {
                // Validation problems are the reader's to fix; anything else is a delivery failure.
                if (response.status >= 400 && response.status < 500) {
                    setError(payload?.error?.message ?? "Periksa kembali isian laporan.");
                    setStatus("idle");
                } else {
                    setStatus("failed");
                }
                return;
            }
            setStatus("success");
        } catch {
            setStatus("failed");
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={open}
                className={triggerClassName ?? "mt-4 flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-destructive hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"}
            >
                <Flag aria-hidden="true" className="size-3.5" /> {label}
            </button>
            <dialog
                ref={dialogRef}
                aria-labelledby={titleId}
                className={cn(
                    "m-auto w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-border bg-[#fcfbf7] p-0 text-foreground shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] backdrop:bg-[rgba(0,23,14,0.6)] backdrop:backdrop-blur-[2px]",
                    status === "success" ? "max-w-md" : "max-w-xl",
                )}
            >
                {status === "success" ? (
                    <div role="status" className="flex flex-col gap-4 p-7">
                        <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-[#c9ecd6] text-primary"><Check className="size-7" /></span>
                        <h2 id={titleId} className="font-heading text-2xl font-semibold text-primary">Laporan terkirim</h2>
                        <p className="text-sm leading-6 text-muted-foreground">Terima kasih sudah membantu menjaga TemuBaca. Identitas Anda tidak diperlihatkan kepada pihak yang dilaporkan.</p>
                        <div className="rounded-xl border border-border bg-card p-4">
                            <p className="text-sm font-semibold">Apa selanjutnya</p>
                            <ol className="mt-2 flex list-none flex-col gap-2 p-0 text-sm text-muted-foreground">
                                {["Pengelola TemuBaca meninjau laporan Anda.", "Tindakan dan alasannya dicatat oleh pengelola."].map((text, index) => (
                                    <li key={text} className="flex items-center gap-3">
                                        <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e7efe8] text-xs font-semibold text-primary">{index + 1}</span>
                                        {text}
                                    </li>
                                ))}
                            </ol>
                        </div>
                        <button type="button" onClick={close} autoFocus className="min-h-11 self-end rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Selesai</button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-2">
                            <div>
                                <h2 id={titleId} className="font-heading text-2xl font-semibold text-primary">Laporkan {kind}</h2>
                                <p className="mt-1 text-sm text-muted-foreground">Bantu kami menjaga TemuBaca tetap akurat dan aman.</p>
                            </div>
                            <button type="button" onClick={close} aria-label="Tutup dialog" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e7efe8] text-primary hover:bg-[#d9e6db] focus-visible:outline-2 focus-visible:outline-ring">
                                <X aria-hidden="true" className="size-4" />
                            </button>
                        </div>

                        <form ref={formRef} onSubmit={submit} noValidate className="flex max-h-[72vh] flex-col">
                            <div className="flex flex-col gap-5 overflow-y-auto px-6 py-4">
                                {status === "failed" && (
                                    <div role="alert" className="flex gap-3 rounded-xl bg-[#ffdbd1] p-4 text-sm text-[#5c1a0a]">
                                        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
                                        <span><span className="block font-semibold">Laporan belum terkirim</span>Koneksi terputus atau layanan sedang bermasalah. Isian Anda masih tersimpan, silakan coba lagi.</span>
                                    </div>
                                )}
                                {status === "limited" && (
                                    <div role="alert" className="flex gap-3 rounded-xl bg-[#fbecc4] p-4 text-sm text-[#5c3d00]">
                                        <Clock aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                                        <span><span className="block font-semibold">Terlalu banyak laporan dalam waktu singkat</span>Demi mencegah penyalahgunaan, pengiriman laporan dibatasi sementara. Silakan coba lagi beberapa saat lagi.</span>
                                    </div>
                                )}

                                {targetName && (
                                    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
                                        <span aria-hidden="true" className="flex h-14 w-11 shrink-0 items-center justify-center rounded bg-primary font-heading text-sm text-primary-foreground">
                                            {targetType === "BOOK" || targetType === "BOOK_LISTING" ? <BookOpen className="size-4" /> : initialsOf(targetName)}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate font-heading text-lg font-semibold">{targetName}</span>
                                            {targetMeta && <span className="block truncate text-sm text-muted-foreground">{targetMeta}</span>}
                                        </span>
                                    </div>
                                )}

                                <fieldset aria-describedby={error ? `${titleId}-error` : undefined}>
                                    <legend className="text-sm font-semibold">Pilih alasan laporan <span className="font-normal text-muted-foreground">(wajib)</span></legend>
                                    <div className="mt-2.5 flex flex-col gap-2.5">
                                        {reasons.map((reason) => (
                                            <ChoiceOption
                                                key={reason.value}
                                                type="radio"
                                                name="reason"
                                                value={reason.value}
                                                onChange={() => setError("")}
                                                className="items-start rounded-xl border border-border bg-card p-4 has-checked:border-primary has-checked:bg-[#eef4ef]"
                                            >
                                                <span>
                                                    <span className="block text-sm font-semibold">{reason.value}</span>
                                                    <span className="block text-xs leading-5 text-muted-foreground">{reason.description}</span>
                                                </span>
                                            </ChoiceOption>
                                        ))}
                                    </div>
                                </fieldset>
                                <FormAlert id={`${titleId}-error`}>{error}</FormAlert>

                                <Field
                                    label={(
                                        <span className="flex items-center justify-between">
                                            <span>Detail tambahan <span className="font-normal text-muted-foreground">(opsional)</span></span>
                                            <span aria-hidden="true" className="text-xs font-normal text-muted-foreground">{details.length}/{DETAILS_MAX}</span>
                                        </span>
                                    )}
                                    hint={`Jangan cantumkan alamat rumah, nomor telepon, atau data pribadi lain. Maksimal ${DETAILS_MAX} karakter.`}
                                >
                                    {(control) => (
                                        <TextArea
                                            {...control}
                                            name="details"
                                            maxLength={DETAILS_MAX}
                                            value={details}
                                            onChange={(event) => setDetails(event.target.value)}
                                            placeholder="Ceritakan apa yang terjadi atau bagian mana yang keliru..."
                                        />
                                    )}
                                </Field>

                                <div className="flex gap-4 rounded-xl bg-[#e7efe8] p-4">
                                    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-primary"><ShieldCheck className="size-4" /></span>
                                    <span className="text-sm leading-6">
                                        <span className="block font-heading text-base font-semibold">Ditinjau manusia, identitas Anda dirahasiakan</span>
                                        <span className="text-muted-foreground">Laporan dibaca pengelola TemuBaca dan identitas Anda tidak diperlihatkan kepada pihak yang dilaporkan. Anda akan menerima konfirmasi setelah laporan terkirim.</span>
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
                                <button type="button" onClick={close} className="min-h-11 rounded-lg bg-[#e7efe8] px-5 text-sm font-semibold text-primary hover:bg-[#d9e6db]">
                                    {status === "limited" ? "Tutup" : "Batal"}
                                </button>
                                {status !== "limited" && (
                                    <button type="submit" disabled={status === "sending"} className="flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                                        {status === "failed" ? <RefreshCw aria-hidden="true" className="size-4" /> : <Send aria-hidden="true" className="size-4" />}
                                        {status === "sending" ? "Mengirim..." : status === "failed" ? "Coba Lagi" : "Kirim Laporan"}
                                    </button>
                                )}
                            </div>
                        </form>
                    </>
                )}
            </dialog>
        </>
    );
}
