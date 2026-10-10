import { BookOpen, CalendarDays, Clock, ExternalLink, Info, Library, Search, ShoppingBag, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { countCommunitiesByStatus, listCommunitiesForReview } from "@/lib/db/queries/communities";
import { countReportsByStatus, listReports, resolveReportTargets } from "@/lib/db/queries/reports";
import type { reportStatusValues, targetTypeValues } from "@/lib/db/schema";
import { ReportDecisionPanel } from "@/features/reports/components/report-decision-panel";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Peninjauan pengajuan & laporan" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type ReportStatus = (typeof reportStatusValues)[number];
type TargetType = (typeof targetTypeValues)[number];

const reportViews = {
    open: { label: "Menunggu", statuses: ["PENDING", "REVIEWING"] as ReportStatus[] },
    resolved: { label: "Ditindak", statuses: ["RESOLVED"] as ReportStatus[] },
    rejected: { label: "Diabaikan", statuses: ["REJECTED"] as ReportStatus[] },
} as const;
type ReportView = keyof typeof reportViews;

const communityViews = {
    PENDING: "Menunggu",
    VERIFIED: "Disetujui",
    REJECTED: "Ditolak",
} as const;
type CommunityView = keyof typeof communityViews;

const targetIcons: Partial<Record<TargetType, LucideIcon>> = {
    BOOK: BookOpen,
    BOOK_LISTING: Library,
    COMMUNITY: UsersRound,
    EVENT: CalendarDays,
    MERCHANDISE_LISTING: ShoppingBag,
    USER: UserRound,
};

const statusLabels: Record<ReportStatus, string> = {
    PENDING: "Menunggu tinjauan",
    REVIEWING: "Sedang ditinjau",
    RESOLVED: "Ditindaklanjuti",
    REJECTED: "Diabaikan",
};

const dateTime = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

function single(value: string | string[] | undefined) {
    return typeof value === "string" ? value : undefined;
}

export default async function ModerationPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const tab = single(params.tab) === "communities" ? "communities" : "reports";
    const query = (single(params.q) ?? "").trim().slice(0, 100);
    const selected = single(params.item);

    const [reportCounts, communityCounts] = await Promise.all([
        Promise.all((["PENDING", "REVIEWING", "RESOLVED", "REJECTED"] as const).map((status) => countReportsByStatus(status))),
        Promise.all((["PENDING", "VERIFIED", "REJECTED"] as const).map((status) => countCommunitiesByStatus(status))),
    ]);
    const reportViewCounts: Record<ReportView, number> = { open: reportCounts[0] + reportCounts[1], resolved: reportCounts[2], rejected: reportCounts[3] };
    const communityViewCounts: Record<CommunityView, number> = { PENDING: communityCounts[0], VERIFIED: communityCounts[1], REJECTED: communityCounts[2] };

    const hrefFor = (next: Record<string, string | undefined>) => {
        const search = new URLSearchParams();
        const merged = { tab, view: single(params.view), q: query || undefined, item: selected, ...next };
        for (const [key, value] of Object.entries(merged)) if (value && !(key === "tab" && value === "reports")) search.set(key, value);
        const value = search.toString();
        return value ? `/moderation/reports?${value}` : "/moderation/reports";
    };

    return (
        <main className="px-4 py-8 sm:px-8 sm:py-10">
            <header>
                <h1 className="font-heading text-[28px] leading-tight font-semibold text-primary sm:text-[34px]">Peninjauan Pengajuan &amp; Laporan</h1>
                <p className="mt-2 max-w-2xl text-base text-muted-foreground">Tinjau pengajuan komunitas dan laporan konten. Status, peninjau, dan waktu keputusan tersimpan pada setiap laporan.</p>
            </header>

            <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-col gap-3">
                    <nav aria-label="Jenis peninjauan" className="flex w-fit rounded-lg bg-[#f1f0ea] p-1">
                        {[
                            { value: "communities", label: `Verifikasi Komunitas (${communityViewCounts.PENDING})` },
                            { value: "reports", label: `Laporan Konten (${reportViewCounts.open})` },
                        ].map((item) => (
                            <Link
                                key={item.value}
                                href={hrefFor({ tab: item.value, view: undefined, item: undefined, q: undefined })}
                                aria-current={tab === item.value ? "page" : undefined}
                                className={cn("rounded-md px-3 py-1.5 text-sm font-medium", tab === item.value ? "bg-card font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                    <div className="flex flex-wrap gap-2">
                        {tab === "reports"
                            ? (Object.keys(reportViews) as ReportView[]).map((view) => {
                                const active = (single(params.view) ?? "open") === view;
                                return (
                                    <Link key={view} href={hrefFor({ view, item: undefined })} aria-current={active ? "true" : undefined}
                                        className={cn("rounded-lg border px-4 py-2 text-sm font-semibold", active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                                        {reportViews[view].label} ({reportViewCounts[view]})
                                    </Link>
                                );
                            })
                            : (Object.keys(communityViews) as CommunityView[]).map((view) => {
                                const active = (single(params.view) ?? "PENDING") === view;
                                return (
                                    <Link key={view} href={hrefFor({ view, item: undefined })} aria-current={active ? "true" : undefined}
                                        className={cn("rounded-lg border px-4 py-2 text-sm font-semibold", active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                                        {communityViews[view]} ({communityViewCounts[view]})
                                    </Link>
                                );
                            })}
                    </div>
                </div>
                <form action="/moderation/reports" method="get" role="search" className="flex lg:w-72">
                    {tab === "communities" && <input type="hidden" name="tab" value="communities" />}
                    {single(params.view) && <input type="hidden" name="view" value={single(params.view)} />}
                    <label className="flex h-10 w-full items-center gap-2 rounded-lg border border-input px-3 focus-within:ring-2 focus-within:ring-ring/30">
                        <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        <span className="sr-only">Cari judul konten atau nama</span>
                        <input name="q" type="search" maxLength={100} defaultValue={query} placeholder="Cari judul konten/pemilik..." className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                    </label>
                </form>
            </div>

            {tab === "reports"
                ? <ReportsTab view={(single(params.view) as ReportView) in reportViews ? single(params.view) as ReportView : "open"} query={query} selected={selected} hrefFor={hrefFor} />
                : <CommunitiesTab view={(single(params.view) as CommunityView) in communityViews ? single(params.view) as CommunityView : "PENDING"} query={query} selected={selected} hrefFor={hrefFor} />}
        </main>
    );
}

type TabProps<View> = { view: View; query: string; selected?: string; hrefFor: (next: Record<string, string | undefined>) => string };

async function ReportsTab({ view, query, selected, hrefFor }: TabProps<ReportView>) {
    const lists = await Promise.all(reportViews[view].statuses.map((status) => listReports({ status, limit: 100, offset: 0 })));
    const reports = lists.flatMap((list) => list.items);
    const targets = await resolveReportTargets(reports.map(({ targetType, targetId }) => ({ targetType, targetId })));

    const groups = new Map<string, { key: string; targetType: TargetType; targetId: string; reports: typeof reports }>();
    for (const report of reports) {
        const key = `${report.targetType}:${report.targetId}`;
        const group = groups.get(key) ?? { key, targetType: report.targetType, targetId: report.targetId, reports: [] };
        group.reports.push(report);
        groups.set(key, group);
    }
    const needle = query.toLocaleLowerCase("id-ID");
    const rows = [...groups.values()]
        .map((group) => ({ ...group, target: targets.get(group.key), latest: group.reports.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)) }))
        .filter((group) => !needle || `${group.target?.title ?? ""} ${group.target?.subtitle ?? ""}`.toLocaleLowerCase("id-ID").includes(needle))
        .sort((a, b) => b.latest.createdAt.getTime() - a.latest.createdAt.getTime());
    const active = rows.find((row) => row.key === selected) ?? rows[0];

    return (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_400px]">
            <section aria-labelledby="report-queue-title" className="overflow-hidden rounded-xl border border-border bg-card">
                <h2 id="report-queue-title" className="bg-[#f1f0ea] px-5 py-3 font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Antrean laporan konten</h2>
                {rows.length > 0 ? (
                    <ul className="list-none divide-y divide-border p-0">
                        {rows.map((row) => {
                            const Icon = targetIcons[row.targetType] ?? Info;
                            const isActive = row.key === active?.key;
                            return (
                                <li key={row.key}>
                                    <Link href={hrefFor({ item: row.key })} aria-current={isActive ? "true" : undefined}
                                        className={cn("grid grid-cols-[40px_1fr] items-center gap-x-3 gap-y-1 px-5 py-4 hover:bg-muted/60 sm:grid-cols-[40px_1fr_150px_90px_110px]", isActive && "border-l-4 border-primary bg-[#e7efe8] pl-4")}>
                                        <span aria-hidden="true" className={cn("flex size-10 items-center justify-center rounded-lg", isActive ? "bg-primary text-primary-foreground" : "bg-[#e7efe8] text-primary")}><Icon className="size-4" /></span>
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-semibold">{row.target?.title ?? "Konten tidak ditemukan"}</span>
                                            <span className="block truncate text-xs text-muted-foreground">{row.target?.subtitle ?? row.targetType}</span>
                                        </span>
                                        <span className="col-start-2 text-sm sm:col-start-auto">{row.latest.reason}</span>
                                        <span className={cn("col-start-2 text-sm sm:col-start-auto", row.reports.length > 1 && "font-semibold text-destructive")}>{row.reports.length} laporan</span>
                                        <span className="col-start-2 text-xs text-muted-foreground sm:col-start-auto">{dateTime.format(row.latest.createdAt)}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="p-8 text-center text-sm text-muted-foreground">Tidak ada laporan {reportViews[view].label.toLowerCase()}.</p>
                )}
            </section>

            {active && (
                <section aria-labelledby="report-detail-title" className="h-fit overflow-hidden rounded-xl border border-border bg-card xl:sticky xl:top-6">
                    <div className="bg-[#f1f0ea] p-5">
                        <div className="flex items-start justify-between gap-3">
                            <h2 id="report-detail-title" className="font-heading text-xl font-semibold">{active.target?.title ?? "Konten tidak ditemukan"}</h2>
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fbe7c6] px-2.5 py-0.5 text-xs font-semibold text-[#7a4b00]">
                                <Clock aria-hidden="true" className="size-3" /> {statusLabels[active.latest.status]}
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{active.targetType} · {active.targetId}</p>
                    </div>
                    <div className="flex flex-col gap-5 p-5">
                        <div>
                            <h3 className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Konten dilaporkan</h3>
                            <div className="mt-2 rounded-lg border border-border p-3">
                                <p className="text-sm font-semibold">{active.target?.title ?? "Konten sudah dihapus atau tidak ditemukan"}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">{active.target?.subtitle}</p>
                                {active.target?.href && (
                                    <Link href={active.target.href} target="_blank" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                                        Buka konten <ExternalLink aria-hidden="true" className="size-3.5" />
                                    </Link>
                                )}
                            </div>
                        </div>
                        <div>
                            <h3 className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Laporan masuk ({active.reports.length})</h3>
                            <ul className="mt-2 flex list-none flex-col gap-2 p-0">
                                {active.reports.map((report) => (
                                    <li key={report.id} className="rounded-lg bg-[#f1f0ea] p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-sm font-semibold">{report.reason}</p>
                                            <time dateTime={report.createdAt.toISOString()} className="shrink-0 text-xs text-muted-foreground">{dateTime.format(report.createdAt)}</time>
                                        </div>
                                        <p className="mt-1 text-sm whitespace-pre-wrap text-foreground/80">{report.details || "Tanpa keterangan tambahan."}</p>
                                        {report.outcome && <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">Catatan: {report.outcome}</p>}
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-2 text-xs text-muted-foreground">Identitas pelapor tidak ditampilkan di panel ini.</p>
                        </div>
                    </div>
                    <ReportDecisionPanel
                        key={active.key}
                        reportIds={active.reports.map((report) => report.id)}
                        initialOutcome={active.reports.find((report) => report.outcome)?.outcome ?? ""}
                    />
                </section>
            )}
        </div>
    );
}

async function CommunitiesTab({ view, query, selected, hrefFor }: TabProps<CommunityView>) {
    const needle = query.toLocaleLowerCase("id-ID");
    const rows = (await listCommunitiesForReview(view)).filter((row) =>
        !needle || `${row.name} ${row.ownerName}`.toLocaleLowerCase("id-ID").includes(needle));
    const active = rows.find((row) => row.id === selected) ?? rows[0];

    return (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_400px]">
            <section aria-labelledby="community-queue-title" className="overflow-hidden rounded-xl border border-border bg-card">
                <h2 id="community-queue-title" className="bg-[#f1f0ea] px-5 py-3 font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Antrean verifikasi komunitas warga</h2>
                {rows.length > 0 ? (
                    <ul className="list-none divide-y divide-border p-0">
                        {rows.map((row) => {
                            const isActive = row.id === active?.id;
                            return (
                                <li key={row.id}>
                                    <Link href={hrefFor({ item: row.id })} aria-current={isActive ? "true" : undefined}
                                        className={cn("grid grid-cols-[40px_1fr] items-center gap-x-3 gap-y-1 px-5 py-4 hover:bg-muted/60 sm:grid-cols-[40px_1fr_180px_120px]", isActive && "border-l-4 border-primary bg-[#e7efe8] pl-4")}>
                                        <span aria-hidden="true" className={cn("flex size-10 items-center justify-center rounded-lg font-heading", isActive ? "bg-primary text-primary-foreground" : "bg-[#e7efe8] text-primary")}>{row.name[0]?.toUpperCase()}</span>
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-semibold">{row.name}</span>
                                            <span className="block truncate text-xs text-muted-foreground">Pengaju: {row.ownerName}</span>
                                        </span>
                                        <span className="col-start-2 truncate text-sm sm:col-start-auto">{row.publicLocation ?? "Lokasi belum diisi"}</span>
                                        <span className="col-start-2 text-xs text-muted-foreground sm:col-start-auto">{dateTime.format(row.createdAt)}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="p-8 text-center text-sm text-muted-foreground">Tidak ada komunitas berstatus {communityViews[view].toLowerCase()}.</p>
                )}
            </section>

            {active && (
                <section aria-labelledby="community-detail-title" className="h-fit overflow-hidden rounded-xl border border-border bg-card xl:sticky xl:top-6">
                    <div className="bg-[#f1f0ea] p-5">
                        <h2 id="community-detail-title" className="font-heading text-xl font-semibold">{active.name}</h2>
                        <p className="mt-1 text-xs text-muted-foreground">Diajukan {dateTime.format(active.createdAt)} oleh {active.ownerName}</p>
                    </div>
                    <dl className="flex flex-col gap-4 p-5 text-sm">
                        <div>
                            <dt className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Wilayah titik temu</dt>
                            <dd className="mt-1 font-medium">{active.publicLocation ?? "Belum diisi"}</dd>
                        </div>
                        <div>
                            <dt className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Deskripsi</dt>
                            <dd className="mt-1 whitespace-pre-line text-foreground/85">{active.description || "Belum ada deskripsi."}</dd>
                        </div>
                    </dl>
                    <p className="flex gap-2 bg-[#f1f0ea] p-5 text-xs leading-5 text-muted-foreground">
                        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                        Persetujuan atau penolakan komunitas dari portal ini belum tersedia (TB-031). Bukti pengajuan, checklist SOP, dan jejak audit menunggu alur verifikasi tersebut.
                    </p>
                </section>
            )}
        </div>
    );
}
