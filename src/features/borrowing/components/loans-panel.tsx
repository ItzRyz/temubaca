import { AlertTriangle, ArrowLeftRight, BookOpen, CalendarDays, CheckCircle2, Clock, Hourglass, Inbox, MapPin, Search, XCircle } from "lucide-react";
import Link from "next/link";

import type { LoanItem } from "@/lib/db/queries/borrowing";
import { timeAgo } from "@/lib/format/relative-time";
import { cn } from "@/lib/utils";

import { allowedActions, loanEventLabels, loanGroup, overdueDays, type LoanGroup, type LoanState } from "../lifecycle";
import { LoanActions } from "./loan-actions";

export type LoanView = "pinjamkan" | "pinjam";
export type LoanFilter = "all" | "action" | "ongoing" | "history";

const dateFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" });
const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

const filterLabels: Record<LoanFilter, string> = { all: "Semua", action: "Perlu Tindakan", ongoing: "Berjalan", history: "Riwayat" };

function filterOf(group: LoanGroup): Exclude<LoanFilter, "all"> {
    return group === "waiting" ? "ongoing" : group;
}

function badgeFor(loan: LoanItem, now: Date): { label: string; className: string; icon: typeof Clock; when: string } {
    const state: LoanState = loan.state;
    switch (state) {
        case "PENDING":
            return { label: loan.role === "owner" ? "Permintaan Baru" : "Menunggu Jawaban", className: "bg-[#fbecc4] text-[#5c3d00]", icon: Hourglass, when: `Diajukan ${timeAgo(loan.requestedAt, now)}` };
        case "AWAITING_HANDOVER":
            return { label: "Menunggu Serah Terima", className: "bg-[#dfe6f5] text-[#24365c]", icon: Inbox, when: loan.preferredTime ? `Usulan waktu: ${loan.preferredTime}` : `Diterima ${timeAgo(loan.respondedAt, now)}` };
        case "ACTIVE":
            return { label: "Sedang Dipinjam", className: "bg-[#ffdbd1] text-[#5c1a0a]", icon: ArrowLeftRight, when: `Dipinjam sejak ${loan.handedOverAt ? dateFormatter.format(loan.handedOverAt) : "-"}` };
        case "OVERDUE":
            return { label: `Terlambat ${Math.max(1, overdueDays(loan.dueAt, now))} hari`, className: "bg-destructive/10 text-destructive", icon: Clock, when: `Jatuh tempo: ${loan.dueAt ? dateFormatter.format(loan.dueAt) : "-"}` };
        case "DISPUTED":
            return { label: "Dalam Sengketa", className: "bg-[#fbecc4] text-[#5c3d00]", icon: AlertTriangle, when: `Dilaporkan ${timeAgo(loan.disputedAt, now)}` };
        case "RETURNED":
            return { label: "Dikembalikan", className: "bg-[#c9ecd6] text-primary", icon: CheckCircle2, when: loan.returnedAt ? dateFormatter.format(loan.returnedAt) : "" };
        case "LOST":
            return { label: "Dinyatakan Hilang", className: "bg-destructive/10 text-destructive", icon: XCircle, when: timeAgo(loan.updatedAt, now) };
        case "REJECTED":
            return { label: "Ditolak", className: "bg-destructive/10 text-destructive", icon: XCircle, when: loan.respondedAt ? dateTimeFormatter.format(loan.respondedAt) : "" };
        case "CANCELLED":
            return { label: "Dibatalkan", className: "bg-[#f1f0ea] text-foreground/80", icon: XCircle, when: timeAgo(loan.updatedAt, now) };
    }
}

/** What the two-party confirmations look like from this side. */
function confirmationHint(loan: LoanItem) {
    const other = loan.role === "owner" ? "Peminjam" : "Pemilik";
    const s = loan.snapshot;
    const [mineHandover, theirsHandover] = loan.role === "owner" ? [s.ownerHandoverAt, s.requesterHandoverAt] : [s.requesterHandoverAt, s.ownerHandoverAt];
    const [mineReturn, theirsReturn] = loan.role === "owner" ? [s.ownerReturnAt, s.requesterReturnAt] : [s.requesterReturnAt, s.ownerReturnAt];
    if (loan.state === "AWAITING_HANDOVER") {
        if (mineHandover) return `Anda sudah mengonfirmasi. Menunggu ${other.toLowerCase()} mengonfirmasi serah terima.`;
        if (theirsHandover) return `${other} sudah mengonfirmasi serah terima.`;
        return "Konfirmasi setelah buku berpindah tangan di titik temu publik.";
    }
    if (loan.state === "ACTIVE" || loan.state === "OVERDUE") {
        if (mineReturn) return `Anda sudah mengonfirmasi pengembalian. Menunggu ${other.toLowerCase()}.`;
        if (theirsReturn) return `${other} sudah mengonfirmasi pengembalian.`;
    }
    if (loan.state === "PENDING" && loan.role === "owner") return "Serah terima dilakukan di titik temu publik.";
    return undefined;
}

function LoanCard({ loan, now }: { loan: LoanItem; now: Date }) {
    const badge = badgeFor(loan, now);
    const BadgeIcon = badge.icon;
    const actions = allowedActions(loan.snapshot, loan.role, now);
    const authors = loan.book.authors.join(", ") || "Penulis belum tercatat";
    const summary = [`Durasi ${loan.loanDays} hari`, loan.meetingPoint && `Titik temu: ${loan.meetingPoint}`].filter(Boolean).join(" • ");
    const daysLeft = loan.dueAt ? Math.ceil((loan.dueAt.getTime() - now.getTime()) / 86_400_000) : null;

    return (
        <li className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <span aria-hidden="true" className="flex h-24 w-[72px] shrink-0 items-center justify-center overflow-hidden rounded bg-[#dbe2dc] text-primary">
                    {loan.book.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={loan.book.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
                    ) : <BookOpen className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 font-semibold", badge.className)}>
                            <BadgeIcon aria-hidden="true" className="size-3.5" /> {badge.label}
                        </span>
                        {badge.when}
                    </p>
                    <h3 className="mt-1.5 font-heading text-lg font-semibold">
                        <Link href={`/books/${loan.book.id}`} className="hover:underline">{loan.book.title}</Link>
                    </h3>
                    <p className="text-sm text-muted-foreground">{authors}</p>
                    <p className="mt-2 flex items-center gap-2 text-sm">
                        {loan.role === "requester" && <span className="text-xs text-muted-foreground">Pemilik</span>}
                        <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-[#e7efe8] text-[10px] font-semibold text-primary">
                            {loan.otherParty.displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}
                        </span>
                        <span className="font-semibold">{loan.otherParty.displayName}</span>
                    </p>

                    {loan.state === "PENDING" && loan.role === "owner" && loan.note && (
                        <p className="mt-3 rounded-lg bg-[#f1efe6] px-3 py-2.5 text-sm italic">“{loan.note}”</p>
                    )}
                    {loan.state === "PENDING" && loan.role === "requester" && (
                        <p className="mt-3 rounded-lg bg-[#f1efe6] px-3 py-2.5 text-sm">Permintaan Anda sudah terkirim. Statusnya berubah di sini saat pemilik menanggapi.</p>
                    )}
                    {loan.state === "DISPUTED" && (
                        <p className="mt-3 rounded-lg bg-[#f1efe6] px-3 py-2.5 text-sm">
                            Ditinjau pengelola TemuBaca ({loan.disputeReason}). Pinjaman terkunci sampai sengketa diputuskan.
                        </p>
                    )}
                    {loan.state === "OVERDUE" && loan.role === "requester" && loan.snapshot.lastReminderAt && (
                        <p className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                            <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                            Pemilik mengirim pengingat {timeAgo(loan.snapshot.lastReminderAt, now)}. Atur pengembalian di titik temu yang disepakati.
                        </p>
                    )}
                    {loan.state === "REJECTED" && loan.rejectionReason && (
                        <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm">
                            <p className="text-[11px] font-semibold tracking-[0.06em] text-destructive uppercase">Alasan penolakan</p>
                            <p className="mt-0.5">{loan.rejectionReason}{loan.responseNote ? `. ${loan.responseNote}` : ""}</p>
                        </div>
                    )}
                    {loan.state === "CANCELLED" && (
                        <p className="mt-3 text-sm text-muted-foreground">{loan.cancelledByOther ? `Dibatalkan oleh ${loan.role === "owner" ? "peminjam" : "pemilik"}.` : "Anda membatalkan pinjaman ini."}</p>
                    )}
                    {(loan.state === "LOST" || loan.state === "RETURNED") && loan.resolutionNote && (
                        <p className="mt-3 rounded-lg bg-[#f1efe6] px-3 py-2.5 text-sm">Keputusan pengelola: {loan.resolutionNote}</p>
                    )}

                    {loan.events.length > 0 && (
                        <details className="mt-3 text-xs">
                            <summary className="cursor-pointer font-semibold text-primary">Riwayat ({loan.events.length})</summary>
                            <ol className="mt-2 flex list-none flex-col gap-1.5 border-l border-border p-0 pl-4 text-muted-foreground">
                                {loan.events.map((event) => (
                                    <li key={event.id}>
                                        <span className="font-medium text-foreground">{loanEventLabels[event.type] ?? event.type}</span>
                                        {" "}{event.by === "you" ? "oleh Anda" : event.by === "other" ? `oleh ${loan.otherParty.displayName}` : event.by === "admin" ? "oleh pengelola" : ""}
                                        {event.note && !["Pemilik", "Peminjam"].includes(event.note) ? ` (${event.note})` : ""} • {dateTimeFormatter.format(event.createdAt)}
                                    </li>
                                ))}
                            </ol>
                        </details>
                    )}

                    <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin aria-hidden="true" className="size-3.5" /> {loan.meetingPoint ? `Titik temu: ${loan.meetingPoint}` : "Titik temu disepakati bersama"}</span>
                        {(loan.state === "ACTIVE" && loan.dueAt) ? (
                            <span className="flex items-center gap-1"><CalendarDays aria-hidden="true" className="size-3.5" /> Estimasi kembali: {dateFormatter.format(loan.dueAt)} (sisa {daysLeft} hari)</span>
                        ) : loan.state === "OVERDUE" && loan.handedOverAt ? (
                            <span className="flex items-center gap-1"><CalendarDays aria-hidden="true" className="size-3.5" /> Dipinjam sejak {dateFormatter.format(loan.handedOverAt)}</span>
                        ) : (
                            <span className="flex items-center gap-1"><CalendarDays aria-hidden="true" className="size-3.5" /> Durasi pinjam: {loan.loanDays} hari</span>
                        )}
                    </p>
                </div>
                <LoanActions
                    role={loan.role}
                    requestId={loan.requestId}
                    borrowingId={loan.borrowingId}
                    actions={actions}
                    bookTitle={loan.book.title}
                    otherName={loan.otherParty.displayName}
                    summary={summary}
                    hint={confirmationHint(loan)}
                />
            </div>
        </li>
    );
}

function Section({ title, loans, now }: { title: string; loans: LoanItem[]; now: Date }) {
    if (loans.length === 0) return null;
    return (
        <section className="mt-8" aria-label={title}>
            <h2 className="flex items-baseline gap-2 font-heading text-xl font-semibold">
                {title} <span className="font-sans text-xs font-normal text-muted-foreground">{loans.length} item</span>
            </h2>
            <ul className="mt-3 flex list-none flex-col gap-3 p-0">
                {loans.map((loan) => <LoanCard key={loan.requestId} loan={loan} now={now} />)}
            </ul>
        </section>
    );
}

/** Figma "Buku Saya - Peminjaman" (297:2494, owner) and "Saya Pinjam" (298:2551, borrower). */
export function LoansPanel({ loans, view, filter, query, now }: { loans: LoanItem[]; view: LoanView; filter: LoanFilter; query: string; now: Date }) {
    const role = view === "pinjamkan" ? "owner" : "requester";
    const needle = query.toLocaleLowerCase("id-ID");
    const mine = loans
        .filter((loan) => loan.role === role)
        .map((loan) => ({ loan, group: loanGroup(loan.snapshot, loan.role, now) }));
    const counts = {
        all: mine.length,
        action: mine.filter((item) => filterOf(item.group) === "action").length,
        ongoing: mine.filter((item) => filterOf(item.group) === "ongoing").length,
        history: mine.filter((item) => filterOf(item.group) === "history").length,
    };
    const visible = mine.filter(({ loan, group }) =>
        (filter === "all" || filterOf(group) === filter) &&
        (!needle || loan.book.title.toLocaleLowerCase("id-ID").includes(needle) || loan.otherParty.displayName.toLocaleLowerCase("id-ID").includes(needle)),
    );
    const inGroup = (group: LoanGroup) => visible.filter((item) => item.group === group).map((item) => item.loan);
    // The history keeps the 20 most recent entries.
    const history = inGroup("history").slice(0, 20);

    const hrefFor = (next: { view?: LoanView; filter?: LoanFilter }) => {
        const search = new URLSearchParams({ tab: "peminjaman" });
        const nextView = next.view ?? view;
        if (nextView !== "pinjamkan") search.set("view", nextView);
        const nextFilter = next.filter ?? (next.view ? "all" : filter);
        if (nextFilter !== "all") search.set("filter", nextFilter);
        if (query && !next.view) search.set("q", query);
        return `/my-listings?${search.toString()}`;
    };

    return (
        <>
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    <nav aria-label="Arah pinjaman" className="flex gap-1 rounded-lg bg-[#f1f0ea] p-1">
                        {([["pinjamkan", "Dipinjamkan ke kawan"], ["pinjam", "Saya pinjam"]] as const).map(([value, label]) => (
                            <Link key={value} href={hrefFor({ view: value })} aria-current={view === value ? "page" : undefined}
                                className={cn("rounded-md px-3 py-1.5 text-xs font-semibold", view === value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                                {label}
                            </Link>
                        ))}
                    </nav>
                    {(Object.keys(filterLabels) as LoanFilter[]).map((value) => (
                        <Link key={value} href={hrefFor({ filter: value })} aria-current={filter === value ? "true" : undefined}
                            className={cn("rounded-lg border px-3 py-1.5 text-sm font-semibold", filter === value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                            {filterLabels[value]}{value !== "all" && value !== "history" ? ` (${counts[value]})` : ""}
                        </Link>
                    ))}
                </div>
                <form action="/my-listings" method="get" role="search" className="flex gap-2 lg:w-80">
                    <input type="hidden" name="tab" value="peminjaman" />
                    {view !== "pinjamkan" && <input type="hidden" name="view" value={view} />}
                    {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
                    <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input px-3 focus-within:ring-2 focus-within:ring-ring/30">
                        <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        <span className="sr-only">Cari judul atau nama</span>
                        <input name="q" type="search" maxLength={100} defaultValue={query} placeholder={view === "pinjamkan" ? "Cari judul, peminjam..." : "Cari judul, pemilik..."} className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                    </label>
                    <button type="submit" className="h-11 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/5">Cari</button>
                </form>
            </div>

            {visible.length === 0 ? (
                <section className="mt-6 rounded-xl border border-dashed border-border p-8 text-center">
                    <h2 className="font-heading text-xl font-semibold">
                        {mine.length > 0 ? "Tidak ada pinjaman yang cocok" : view === "pinjamkan" ? "Belum ada permintaan pinjam" : "Anda belum meminjam buku"}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {mine.length > 0
                            ? "Ubah filter atau kata kunci pencarian."
                            : view === "pinjamkan"
                                ? "Permintaan dari kawan pembaca untuk buku yang Anda tawarkan akan muncul di sini."
                                : "Buka detail buku, lalu tekan Ajukan Pinjam pada salinan warga yang ditawarkan."}
                    </p>
                    {mine.length === 0 && view === "pinjam" && (
                        <Link href="/books" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Jelajahi Buku</Link>
                    )}
                </section>
            ) : (
                <>
                    <Section title="Perlu Tindakan" loans={inGroup("action")} now={now} />
                    <Section title="Menunggu Jawaban Pemilik" loans={inGroup("waiting")} now={now} />
                    <Section title={view === "pinjamkan" ? "Sedang Berjalan" : "Sedang Saya Pinjam"} loans={inGroup("ongoing")} now={now} />
                    <Section title="Riwayat Terbaru" loans={history} now={now} />
                </>
            )}
        </>
    );
}

/** Stat cards above the tabs for the loan view. */
export function loanStats(loans: LoanItem[], view: LoanView, now: Date) {
    const role = view === "pinjamkan" ? "owner" : "requester";
    const mine = loans.filter((loan) => loan.role === role);
    return {
        action: mine.filter((loan) => loanGroup(loan.snapshot, loan.role, now) === "action").length,
        pending: mine.filter((loan) => loan.state === "PENDING").length,
        ongoing: mine.filter((loan) => loan.state === "ACTIVE" || loan.state === "OVERDUE" || loan.state === "DISPUTED").length,
        returned: mine.filter((loan) => loan.state === "RETURNED").length,
    };
}
