import { Library, MapPin } from "lucide-react";
import Link from "next/link";

import { LoanViewNav } from "@/features/borrowing/components/loans-panel";
import type { listAccessRequestsForUser } from "@/lib/db/queries/libraries";
import { cn } from "@/lib/utils";

import { accessActionBlocker, accessState, accessStateLabels, type AccessState } from "../access";
import { AccessActions } from "./access-actions";

type AccessRequest = Awaited<ReturnType<typeof listAccessRequestsForUser>>[number];

const dateTime = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const tone: Record<AccessState, string> = {
    PENDING: "bg-[#fbecc4] text-[#5c3d00]",
    APPROVED: "bg-[#c9ecd6] text-primary",
    COLLECTED: "bg-[#e7efe8] text-primary",
    REJECTED: "bg-destructive/10 text-destructive",
    CANCELLED: "bg-[#f1f0ea] text-foreground/80",
    EXPIRED: "bg-[#f1f0ea] text-foreground/80",
};

/** "Minta & Pinjam → Perpustakaan": the reader's requests to libraries (TB-023). */
export function LibraryAccessPanel({ requests, now }: { requests: AccessRequest[]; now: Date }) {
    return (
        <>
            <div className="mt-4 flex rounded-xl border border-border bg-card p-3"><LoanViewNav view="perpustakaan" /></div>
            {requests.length === 0 ? (
                <section className="mt-6 rounded-xl border border-dashed border-border p-8 text-center">
                    <h2 className="font-heading text-xl font-semibold">Belum ada pengajuan ke perpustakaan</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Buka detail buku, lalu tekan Ajukan Akses pada perpustakaan yang menerima pengajuan.</p>
                    <Link href="/libraries" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Lihat Perpustakaan</Link>
                </section>
            ) : (
                <ul className="mt-6 flex list-none flex-col gap-3 p-0">
                    {requests.map((request) => {
                        const state = accessState(request, now);
                        return (
                            <li key={request.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:justify-between">
                                <div className="min-w-0">
                                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", tone[state])}>{accessStateLabels[state]}</span>
                                    <p className="mt-2 font-semibold"><Link href={`/books/${request.book.id}`} className="hover:underline">{request.book.title}</Link></p>
                                    <p className="flex items-center gap-1 text-sm text-muted-foreground"><Library aria-hidden="true" className="size-3.5" /> <Link href={`/libraries/${request.library.id}`} className="hover:underline">{request.library.name}</Link></p>
                                    {state === "APPROVED" && request.expiresAt && (
                                        <p className="mt-2 rounded-lg bg-[#e7efe8] px-3 py-2 text-sm">
                                            Ambil sebelum {dateTime.format(request.expiresAt)}{request.library.publicLocation ? ` di ${request.library.publicLocation}` : ""}.
                                            {request.library.accessRules ? ` ${request.library.accessRules}` : ""}
                                        </p>
                                    )}
                                    {request.responseNote && <p className="mt-1 text-sm">Catatan perpustakaan: {request.responseNote}</p>}
                                    <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                                        <span>Diajukan {dateTime.format(request.createdAt)}</span>
                                        {request.library.placeId && <Link href={`/map?tempat=${request.library.placeId}`} className="flex items-center gap-1 font-semibold text-primary hover:underline"><MapPin aria-hidden="true" className="size-3" /> Peta Literasi</Link>}
                                    </p>
                                </div>
                                <AccessActions accessId={request.id} actions={accessActionBlocker(request, "requester", "cancel", now) === null ? ["cancel"] : []} />
                            </li>
                        );
                    })}
                </ul>
            )}
        </>
    );
}
