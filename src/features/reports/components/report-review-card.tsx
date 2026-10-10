"use client";

import { useState } from "react";

type ReportStatus = "PENDING" | "REVIEWING" | "RESOLVED" | "REJECTED";
type Report = {
    id: string;
    targetType: string;
    targetId: string;
    reason: string;
    details: string | null;
    status: ReportStatus;
    outcome: string | null;
    createdAt: Date;
    reporter: { displayName: string };
};

const statusLabels: Record<ReportStatus, string> = {
    PENDING: "Menunggu",
    REVIEWING: "Sedang ditinjau",
    RESOLVED: "Ditindaklanjuti",
    REJECTED: "Tidak ditindaklanjuti",
};

export function ReportReviewCard({ report }: { report: Report }) {
    const [status, setStatus] = useState<ReportStatus>(report.status);
    const [outcome, setOutcome] = useState(report.outcome ?? "");
    const [message, setMessage] = useState("");
    const [pending, setPending] = useState(false);

    async function save() {
        setPending(true);
        setMessage("");
        try {
            const response = await fetch(`/api/admin/reports/${report.id}`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ status, outcome }),
            });
            const payload = await response.json() as { success?: boolean; error?: { message?: string } };
            setMessage(response.ok && payload.success ? "Tinjauan disimpan." : payload.error?.message ?? "Perubahan belum dapat disimpan.");
        } catch {
            setMessage("Perubahan belum dapat disimpan. Periksa koneksi lalu coba lagi.");
        } finally {
            setPending(false);
        }
    }

    return (
        <li className="grid gap-3 rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{report.targetType} · {report.targetId}</h2>
                <time dateTime={report.createdAt.toISOString()} className="text-xs text-muted-foreground">{report.createdAt.toLocaleString("id-ID")}</time>
            </div>
            <p className="text-sm">Alasan: {report.reason}</p>
            {report.details && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{report.details}</p>}
            <p className="text-xs text-muted-foreground">Pelapor: {report.reporter.displayName} · Status: {statusLabels[report.status]}</p>
            <label className="grid max-w-sm gap-1 text-sm font-medium">Status tinjauan
                <select value={status} onChange={(event) => setStatus(event.target.value as ReportStatus)} className="min-h-10 rounded-lg border border-input bg-background px-3">
                    {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">Catatan hasil <span className="font-normal text-muted-foreground">(internal moderator)</span>
                <textarea value={outcome} onChange={(event) => setOutcome(event.target.value)} maxLength={10000} rows={2} className="rounded-lg border border-input bg-background px-3 py-2 font-normal" />
            </label>
            <button type="button" onClick={save} disabled={pending} className="min-h-10 justify-self-start rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{pending ? "Menyimpan…" : "Simpan tinjauan"}</button>
            <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">{message}</p>
        </li>
    );
}
