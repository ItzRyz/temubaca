import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AskDisputePanel, ResolveDisputePanel } from "@/features/borrowing/components/resolve-dispute-panel";
import { disputeConsequenceLabels, DISPUTE_REVIEW_HOURS, disputeDeadline, loanEventLabels as eventText, type DisputeConsequence } from "@/features/borrowing/lifecycle";
import { listBorrowEvents, listBorrowingDisputes } from "@/lib/db/queries/borrowing";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Sengketa pinjam" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const dateTime = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });


/** Loan disputes opened through "Laporkan Masalah" (DEC-02); an admin rules them returned or lost. */
export default async function AdminLoansPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const view = params.status === "resolved" ? "resolved" : "open";
    const disputes = await listBorrowingDisputes();
    const open = disputes.filter((item) => item.status === "DISPUTED");
    const resolved = disputes.filter((item) => item.status !== "DISPUTED");
    const visible = view === "open" ? open : resolved;
    const now = new Date();
    const histories = new Map(await Promise.all(visible.map(async (item) => [item.requestId, await listBorrowEvents(item.requestId)] as const)));

    return (
        <main className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6">
            <h1 className="font-heading text-[28px] font-semibold text-primary">Sengketa Pinjam</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Masalah yang dilaporkan pemilik atau peminjam: buku rusak, hilang, atau tidak dikembalikan. Pinjaman terkunci sampai Anda memutuskan. Target keputusan {DISPUTE_REVIEW_HOURS} jam sejak dilaporkan; kedua pihak melihat target ini.
            </p>

            <nav aria-label="Status sengketa" className="mt-6 flex w-fit gap-1 rounded-xl border border-border bg-[#f1f0ea] p-1">
                {([["open", `Menunggu (${open.length})`], ["resolved", `Diputuskan (${resolved.length})`]] as const).map(([value, label]) => (
                    <Link key={value} href={value === "open" ? "/admin/loans" : "/admin/loans?status=resolved"} aria-current={view === value ? "page" : undefined}
                        className={cn("rounded-lg px-4 py-2 text-sm", view === value ? "bg-card font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                        {label}
                    </Link>
                ))}
            </nav>

            {visible.length === 0 ? (
                <p className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    {view === "open" ? "Tidak ada sengketa yang menunggu keputusan." : "Belum ada sengketa yang diputuskan."}
                </p>
            ) : (
                <ul className="mt-6 flex list-none flex-col gap-4 p-0">
                    {visible.map((item) => (
                        <li key={item.borrowingId} className="rounded-xl border border-border bg-card p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        {item.status === "DISPUTED" ? (
                                            <span className="inline-flex items-center gap-1 rounded bg-[#fbecc4] px-2 py-0.5 font-semibold text-[#5c3d00]"><AlertTriangle aria-hidden="true" className="size-3.5" /> {item.reason}</span>
                                        ) : item.status === "RETURNED" ? (
                                            <span className="inline-flex items-center gap-1 rounded bg-[#c9ecd6] px-2 py-0.5 font-semibold text-primary"><CheckCircle2 aria-hidden="true" className="size-3.5" /> Dinyatakan dikembalikan</span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 font-semibold text-destructive"><XCircle aria-hidden="true" className="size-3.5" /> Dinyatakan hilang</span>
                                        )}
                                        Dilaporkan {item.disputedAt ? dateTime.format(item.disputedAt) : "-"} oleh {item.reporterName ?? "akun terhapus"} ({item.reportedByOwner ? "pemilik" : "peminjam"})
                                        {item.status === "DISPUTED" && item.disputedAt && (disputeDeadline(item.disputedAt) < now ? (
                                            <span className="rounded bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">Lewat target {dateTime.format(disputeDeadline(item.disputedAt))}</span>
                                        ) : (
                                            <span>• Target {dateTime.format(disputeDeadline(item.disputedAt))}</span>
                                        ))}
                                        {item.status === "DISPUTED" && (item.ownerReplyRequestedAt || item.requesterReplyRequestedAt) && (
                                            <span className="rounded bg-[#dfe6f5] px-2 py-0.5 font-semibold text-[#24365c]">
                                                Menunggu jawaban {[item.ownerReplyRequestedAt && "pemilik", item.requesterReplyRequestedAt && "peminjam"].filter(Boolean).join(" & ")}
                                            </span>
                                        )}
                                    </p>
                                    <h2 className="mt-1.5 font-heading text-lg font-semibold">
                                        <Link href={`/books/${item.book.id}`} className="hover:underline">{item.book.title}</Link>
                                    </h2>
                                    <p className="text-sm text-muted-foreground">Pemilik {item.communityName ? `${item.communityName} (komunitas)` : item.ownerName} • Peminjam {item.requesterName}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Diserahkan {item.handedOverAt ? date.format(item.handedOverAt) : "-"} • Jatuh tempo {item.dueAt ? date.format(item.dueAt) : "-"}{item.meetingPoint ? ` • Titik temu ${item.meetingPoint}` : ""}
                                    </p>
                                </div>
                            </div>
                            <p className="mt-3 rounded-lg bg-[#f1efe6] px-3 py-2.5 text-sm">{item.details}</p>
                            {item.status !== "DISPUTED" && item.resolutionNote && (
                                <p className="mt-3 text-sm"><span className="font-semibold">Keputusan {item.resolvedAt ? dateTime.format(item.resolvedAt) : ""}:</span> {item.resolutionNote}</p>
                            )}
                            {item.status !== "DISPUTED" && item.consequence && item.consequence !== "NONE" && (
                                <p className="mt-1 text-sm">
                                    <span className="font-semibold">Konsekuensi:</span> {disputeConsequenceLabels[item.consequence as DisputeConsequence]}
                                    {item.consequenceDays ? ` ${item.consequenceDays} hari` : ""} untuk {item.consequenceToOwner ? "pemilik" : "peminjam"}
                                </p>
                            )}

                            <details className="mt-3 text-sm" open={(histories.get(item.requestId) ?? []).some((event) => event.type.startsWith("DISPUTE_INFO"))}>
                                <summary className="cursor-pointer font-semibold text-primary">Riwayat pinjaman</summary>
                                <ol className="mt-2 flex list-none flex-col gap-1.5 border-l border-border p-0 pl-4 text-xs text-muted-foreground">
                                    {(histories.get(item.requestId) ?? []).map((event) => (
                                        <li key={event.id}>
                                            <span className="font-medium text-foreground">{eventText[event.type] ?? event.type}</span>
                                            {event.note ? ` (${event.note})` : ""} • {dateTime.format(event.createdAt)}
                                        </li>
                                    ))}
                                </ol>
                            </details>

                            {item.status === "DISPUTED" && (
                                <div className="mt-4 flex flex-col gap-3">
                                    <AskDisputePanel borrowingId={item.borrowingId} />
                                    <ResolveDisputePanel borrowingId={item.borrowingId} />
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}
