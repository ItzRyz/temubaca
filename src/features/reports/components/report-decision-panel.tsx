"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

type Decision = "REVIEWING" | "REJECTED" | "RESOLVED";

const decisions: { value: Decision; label: string; description: string }[] = [
    { value: "REVIEWING", label: "Tandai sedang ditinjau", description: "Laporan tetap di antrean sampai ada keputusan." },
    { value: "REJECTED", label: "Abaikan laporan", description: "Konten sesuai aturan; laporan ditutup tanpa tindakan." },
    { value: "RESOLVED", label: "Tandai ditindaklanjuti", description: "Masalah sudah ditangani di luar sistem, misalnya pemilik telah memperbaiki konten." },
];

/** Applies one decision to every open report about the same item through the batch endpoint. */
export function ReportDecisionPanel({ reportIds, initialOutcome }: { reportIds: string[]; initialOutcome: string }) {
    const router = useRouter();
    const noteId = useId();
    const [decision, setDecision] = useState<Decision | null>(null);
    const [outcome, setOutcome] = useState(initialOutcome);
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!decision) {
            setMessage({ tone: "error", text: "Pilih tindakan terlebih dahulu." });
            return;
        }
        if (decision !== "REVIEWING" && outcome.trim().length < 3) {
            setMessage({ tone: "error", text: "Catatan keputusan wajib diisi untuk menutup laporan." });
            return;
        }

        setPending(true);
        setMessage(null);
        try {
            const response = await fetch("/api/admin/reports", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ reportIds, status: decision, outcome: outcome.trim() }),
            });
            const payload = await response.json() as { success?: boolean; data?: { updated: number }; error?: { message?: string } };
            if (!response.ok || !payload.success) {
                setMessage({ tone: "error", text: payload.error?.message ?? "Keputusan belum dapat disimpan." });
                return;
            }
            setMessage({ tone: "ok", text: `Keputusan diterapkan ke ${payload.data?.updated ?? reportIds.length} laporan.` });
            router.refresh();
        } catch {
            setMessage({ tone: "error", text: "Keputusan belum dapat disimpan. Periksa koneksi lalu coba lagi." });
        } finally {
            setPending(false);
        }
    }

    return (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3 bg-[#f1f0ea] p-5">
            <fieldset>
                <legend className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Tindakan</legend>
                <div className="mt-2 flex flex-col gap-2">
                    {decisions.map((item) => (
                        <label key={item.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 has-checked:border-primary has-checked:bg-[#e7efe8]">
                            <input type="radio" name="decision" value={item.value} checked={decision === item.value} onChange={() => setDecision(item.value)} className="mt-0.5 size-4 accent-primary" />
                            <span>
                                <span className="block text-sm font-semibold">{item.label}</span>
                                <span className="block text-xs text-muted-foreground">{item.description}</span>
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>
            <label htmlFor={noteId} className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Catatan keputusan</label>
            <textarea
                id={noteId}
                rows={3}
                maxLength={10000}
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
                placeholder="Wajib diisi saat menutup laporan. Catatan hanya terlihat oleh admin."
                className="rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            {message && (
                <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "rounded bg-destructive/10 px-3 py-2 text-sm text-destructive" : "text-sm text-primary"}>
                    {message.text}
                </p>
            )}
            <button type="submit" disabled={pending} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                <Check aria-hidden="true" className="size-4" /> {pending ? "Menyimpan…" : "Terapkan Tindakan"}
            </button>
            <p className="text-xs text-muted-foreground">Keputusan berlaku untuk semua laporan tentang konten ini. Moderasi belum menyembunyikan konten secara otomatis.</p>
        </form>
    );
}
