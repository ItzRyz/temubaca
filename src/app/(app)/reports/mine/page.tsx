import { CheckCircle2, Clock, Flag, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { MarkReportsSeen } from "@/features/reports/components/mark-reports-seen";
import { getCurrentUser } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/login-redirect";
import { listReportsByReporter } from "@/lib/db/queries/reports";
import { reportsSeenAt } from "@/lib/db/queries/users";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Laporan saya" };

const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

const outcome = {
    PENDING: { label: "Menunggu ditinjau", note: "Tim TemuBaca belum meninjau laporan ini.", icon: Clock, className: "bg-[#fbecc4] text-[#5c3d00]" },
    REVIEWING: { label: "Sedang ditinjau", note: "Tim TemuBaca sedang memeriksa konten ini.", icon: Clock, className: "bg-[#dfe6f5] text-[#24365c]" },
    RESOLVED: { label: "Ditindaklanjuti", note: "Laporan diterima dan sudah ditindaklanjuti. Terima kasih.", icon: CheckCircle2, className: "bg-[#c9ecd6] text-primary" },
    REJECTED: { label: "Tidak ditindak", note: "Setelah ditinjau, konten ini tidak melanggar aturan TemuBaca.", icon: XCircle, className: "bg-[#f1f0ea] text-foreground/80" },
} as const;

/**
 * "Laporan saya" (Pengaturan → Moderasi: kirim konfirmasi ke pelapor, 30 Okt 2026): the reporter sees each
 * report's status and outcome. The admin's internal note and the decider are not shown.
 */
export default async function MyReportsPage() {
    const user = await getCurrentUser();
    if (!user) return redirectToLogin();
    const [items, since] = [await listReportsByReporter(user.id), reportsSeenAt(user.preferences)];

    return (
        <main className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6 sm:py-10">
            <MarkReportsSeen />
            <h1 className="font-heading text-[30px] leading-tight font-semibold text-primary">Laporan saya</h1>
            <p className="mt-1 text-sm text-muted-foreground">Status laporan yang kamu kirim. Pemilik konten tidak pernah tahu siapa yang melapor.</p>
            {items.length === 0 ? (
                <p className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    <Flag aria-hidden="true" className="mx-auto mb-2 size-6 text-primary/60" />Kamu belum pernah mengirim laporan.
                </p>
            ) : (
                <ul className="mt-6 flex list-none flex-col gap-3 p-0">
                    {items.map((item) => {
                        const state = outcome[item.status as keyof typeof outcome] ?? outcome.PENDING;
                        const Icon = state.icon;
                        const fresh = item.reviewedAt && item.reviewedAt > since && (item.status === "RESOLVED" || item.status === "REJECTED");
                        return (
                            <li key={item.id} className="rounded-xl border border-border bg-card p-4">
                                <p className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", state.className)}><Icon aria-hidden="true" className="size-3.5" /> {state.label}</span>
                                    {fresh && <span className="rounded-full bg-destructive px-2 py-0.5 font-semibold text-white">Baru</span>}
                                    <span className="text-muted-foreground">Dilaporkan {dateFormat.format(item.createdAt)}{item.reviewedAt ? ` · diputus ${dateFormat.format(item.reviewedAt)}` : ""}</span>
                                </p>
                                <p className="mt-2 font-semibold">
                                    {item.target?.href ? <Link href={item.target.href} className="hover:underline">{item.target.title}</Link> : item.target?.title ?? "Konten sudah tidak tersedia"}
                                </p>
                                <p className="text-sm text-muted-foreground">Alasan: {item.reason}</p>
                                <p className="mt-2 text-sm">{state.note}</p>
                            </li>
                        );
                    })}
                </ul>
            )}
        </main>
    );
}
