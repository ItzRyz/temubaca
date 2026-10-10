"use client";

import { CheckCircle2, Flag, Send, ShieldCheck, X } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";

type ReportTargetType = "BOOK" | "BOOK_LISTING" | "COMMUNITY" | "EVENT" | "MERCHANDISE_LISTING" | "USER";

const targetLabels: Record<ReportTargetType, string> = {
    BOOK: "Buku",
    BOOK_LISTING: "Salinan Buku",
    COMMUNITY: "Komunitas",
    EVENT: "Acara",
    MERCHANDISE_LISTING: "Merchandise",
    USER: "Akun",
};

/** The selected reason title is sent as `reason`; the API stores it as free text (3–500 characters). */
const reasons = [
    { value: "Informasi keliru", description: "Data buku, jadwal acara, lokasi titik temu, atau identitas tidak akurat/menyesatkan." },
    { value: "Konten tidak pantas", description: "Mengandung ujaran kebencian, pelecehan, atau konten terlarang." },
    { value: "Penipuan atau tidak aman", description: "Mencurigakan, pungutan biaya di luar etika komunitas, atau titik temu berisiko." },
    { value: "Lainnya", description: "Kendala lain yang perlu perhatian pengelola." },
] as const;

const DETAILS_MAX = 500;

type Status = "idle" | "sending" | "success";

export function ReportForm({ targetType, targetId, isAuthenticated, label = "Laporkan konten", targetName }: {
    targetType: ReportTargetType;
    targetId: string;
    isAuthenticated: boolean;
    /** Trigger text. */
    label?: string;
    /** Shown in the dialog title, e.g. the book title. */
    targetName?: string;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const titleId = useId();
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState("");
    const [details, setDetails] = useState("");

    if (!isAuthenticated) return null;

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
        const formData = new FormData(event.currentTarget);
        const reason = formData.get("reason");
        if (typeof reason !== "string" || !reason) {
            setError("Pilih salah satu alasan pelaporan.");
            return;
        }

        setStatus("sending");
        setError("");
        try {
            const response = await fetch("/api/reports", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    targetType,
                    targetId,
                    reason,
                    details: details.trim() || undefined,
                }),
            });
            const payload = await response.json() as { success?: boolean; error?: { message?: string } };
            if (!response.ok || !payload.success) {
                setError(payload.error?.message ?? "Laporan belum dapat dikirim. Coba lagi nanti.");
                setStatus("idle");
                return;
            }
            setStatus("success");
        } catch {
            setError("Laporan belum dapat dikirim. Periksa koneksi lalu coba lagi.");
            setStatus("idle");
        }
    }

    const heading = targetName ? `Laporkan “${targetName}”` : `Laporkan ${targetLabels[targetType].toLowerCase()} ini`;

    return (
        <>
            <button
                type="button"
                onClick={open}
                className="mt-4 flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-destructive hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
            >
                <Flag aria-hidden="true" className="size-3.5" /> {label}
            </button>
            <dialog
                ref={dialogRef}
                aria-labelledby={titleId}
                className="m-auto w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-lg border border-border bg-card p-0 text-foreground shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] backdrop:bg-[rgba(0,23,14,0.6)] backdrop:backdrop-blur-[2px]"
            >
                <div className="flex items-start justify-between gap-4 border-b border-border bg-[#faf7f0] px-6 pt-5 pb-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#ffb5a1]/40 bg-[#ffdbd1] px-2.5 py-0.5 text-xs font-semibold text-[#3b0900]">
                                <Flag aria-hidden="true" className="size-3" /> Laporkan {targetLabels[targetType]}
                            </span>
                            <span className="text-[11px] text-muted-foreground">Layanan Perlindungan Warga</span>
                        </div>
                        <h2 id={titleId} className="mt-1.5 font-heading text-xl leading-7 font-semibold tracking-[-0.5px]">{heading}</h2>
                    </div>
                    <button type="button" onClick={close} aria-label="Tutup dialog" className="rounded p-1.5 text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
                        <X aria-hidden="true" className="size-4" />
                    </button>
                </div>

                {status === "success" ? (
                    <div role="status" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                        <CheckCircle2 aria-hidden="true" className="size-10 text-primary" />
                        <p className="font-heading text-lg font-semibold">Laporan diterima</p>
                        <p className="max-w-sm text-sm text-muted-foreground">Terima kasih. Pengelola TemuBaca akan meninjau laporanmu. Konten tidak otomatis disembunyikan selama peninjauan.</p>
                        <button type="button" onClick={close} className="mt-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Tutup</button>
                    </div>
                ) : (
                    <form ref={formRef} onSubmit={submit} noValidate className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto p-6">
                        <fieldset aria-describedby={error ? `${titleId}-error` : undefined}>
                            <legend className="text-xs font-semibold tracking-[0.6px] text-muted-foreground uppercase">
                                Pilih alasan pelaporan <span className="text-destructive">*</span>
                            </legend>
                            <div className="mt-2.5 flex flex-col gap-2.5">
                                {reasons.map((reason) => (
                                    <label key={reason.value} className="flex cursor-pointer items-start gap-3 rounded border border-border bg-[#faf7f0] p-3 has-checked:border-primary has-checked:bg-[#e7efe8]">
                                        <input type="radio" name="reason" value={reason.value} className="mt-0.5 size-4 shrink-0 accent-primary" onChange={() => setError("")} />
                                        <span>
                                            <span className="block text-sm font-semibold">{reason.value}</span>
                                            <span className="block text-xs leading-4 text-muted-foreground">{reason.description}</span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        <label className="flex flex-col gap-1.5">
                            <span className="flex items-center justify-between text-xs font-semibold">
                                <span>Detail tambahan <span className="font-normal text-muted-foreground">(Opsional)</span></span>
                                <span aria-hidden="true" className="text-[11px] font-normal text-muted-foreground">{details.length}/{DETAILS_MAX}</span>
                            </span>
                            <textarea
                                name="details"
                                rows={3}
                                maxLength={DETAILS_MAX}
                                value={details}
                                onChange={(event) => setDetails(event.target.value)}
                                placeholder="Ceritakan kronologi atau bagian yang perlu ditinjau oleh pengelola TemuBaca..."
                                className="rounded border border-border bg-card px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
                            />
                            <span className="text-[11px] text-muted-foreground">Jangan cantumkan alamat rumah, nomor telepon, atau data pribadi lain.</span>
                        </label>

                        <p className="flex gap-3 rounded border border-border bg-[#f1f0ea] p-4 text-xs leading-5 text-foreground/80">
                            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                            <span><strong className="text-foreground">Laporan ditinjau langsung oleh manusia.</strong> Pengelola TemuBaca memeriksa setiap laporan untuk menjaga keamanan ruang literasi warga.</span>
                        </p>

                        {error && <p id={`${titleId}-error`} role="alert" className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

                        <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
                            <button type="button" onClick={close} className="rounded px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted">Batal</button>
                            <button type="submit" disabled={status === "sending"} className="flex items-center gap-2 rounded bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_1px_1px_rgba(0,0,0,0.05)] hover:bg-primary/90 disabled:opacity-60">
                                <Send aria-hidden="true" className="size-3.5" />
                                {status === "sending" ? "Mengirim…" : "Kirim Laporan"}
                            </button>
                        </div>
                    </form>
                )}
            </dialog>
        </>
    );
}
