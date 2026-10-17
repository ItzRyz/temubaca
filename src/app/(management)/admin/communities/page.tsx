import { Ban, CircleCheck, Clock, ExternalLink, Info, Search, UsersRound, XCircle, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
    countCommunitiesByStatus,
    listCommunitiesForAdmin,
    listCommunityManagers,
    listCommunityRegions,
} from "@/lib/db/queries/communities";
import { listCommunityVerifications } from "@/lib/db/queries/verifications";
import type { communityStatusValues } from "@/lib/db/schema";
import { availableCommunityDecisions } from "@/features/verification/community-review";
import { CommunityDecisionPanel } from "@/features/verification/components/community-decision-panel";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Data komunitas" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type CommunityStatus = (typeof communityStatusValues)[number];

const statusUi: Record<CommunityStatus, { label: string; tab: string; icon: LucideIcon; badge: string; stat: string }> = {
    VERIFIED: { label: "Terverifikasi", tab: "Terverifikasi", icon: CircleCheck, badge: "bg-[#d6efdf] text-primary", stat: "bg-[#d6efdf] text-primary" },
    PENDING: { label: "Menunggu", tab: "Menunggu", icon: Clock, badge: "bg-[#fbecc4] text-[#7a5300]", stat: "bg-[#fbecc4] text-[#7a5300]" },
    REJECTED: { label: "Ditolak", tab: "Ditolak", icon: XCircle, badge: "bg-[#ebe9e1] text-foreground/80", stat: "bg-[#ebe9e1] text-foreground/80" },
    SUSPENDED: { label: "Ditangguhkan", tab: "Ditangguhkan", icon: Ban, badge: "bg-destructive/10 text-destructive", stat: "bg-destructive/10 text-destructive" },
};
const statusOrder: CommunityStatus[] = ["VERIFIED", "PENDING", "REJECTED", "SUSPENDED"];

const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

function single(value: string | string[] | undefined) {
    return typeof value === "string" ? value : undefined;
}

function initialsOf(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function StatusBadge({ status }: { status: CommunityStatus }) {
    const { label, icon: Icon, badge } = statusUi[status];
    return (
        <span className={cn("inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", badge)}>
            <Icon aria-hidden="true" className="size-3" /> {label}
        </span>
    );
}

export default async function AdminCommunitiesPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const statusParam = single(params.status);
    const status = statusOrder.includes(statusParam as CommunityStatus) ? statusParam as CommunityStatus : undefined;
    const query = (single(params.q) ?? "").trim().slice(0, 100);
    const region = (single(params.region) ?? "").trim().slice(0, 200) || undefined;
    const selected = single(params.item);

    const [counts, regions, rows] = await Promise.all([
        Promise.all(statusOrder.map((value) => countCommunitiesByStatus(value))),
        listCommunityRegions(),
        listCommunitiesForAdmin({ status, query, region }),
    ]);
    const countByStatus = Object.fromEntries(statusOrder.map((value, index) => [value, counts[index]])) as Record<CommunityStatus, number>;
    const total = counts.reduce((sum, value) => sum + value, 0);

    const active = rows.find((row) => row.id === selected) ?? rows[0];
    const [managers, history] = active
        ? await Promise.all([listCommunityManagers(active.id, active.ownerId), listCommunityVerifications(active.id, 5)])
        : [[], []];
    const lastApproval = history.find((entry) => entry.status === "APPROVED");
    const lastDecision = history[0];

    const hrefFor = (next: Record<string, string | undefined>) => {
        const search = new URLSearchParams();
        const merged = { status, q: query || undefined, region, item: selected, ...next };
        for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value);
        const value = search.toString();
        return value ? `/admin/communities?${value}` : "/admin/communities";
    };

    const stats = [
        { label: "Total Komunitas", value: total, icon: UsersRound, tone: "bg-[#ebe9e1] text-foreground/80" },
        { label: "Terverifikasi", value: countByStatus.VERIFIED, icon: statusUi.VERIFIED.icon, tone: statusUi.VERIFIED.stat },
        { label: "Menunggu Verifikasi", value: countByStatus.PENDING, icon: statusUi.PENDING.icon, tone: statusUi.PENDING.stat },
        { label: "Ditangguhkan", value: countByStatus.SUSPENDED, icon: statusUi.SUSPENDED.icon, tone: statusUi.SUSPENDED.stat },
    ];

    return (
        <main className="px-4 py-8 sm:px-8 sm:py-10">
            <header>
                <h1 className="font-heading text-[28px] leading-tight font-semibold text-primary sm:text-[34px]">Data Komunitas</h1>
                <p className="mt-2 max-w-2xl text-base text-muted-foreground">
                    Kelola profil komunitas, status verifikasi, dan pengelolanya. Pengajuan baru ditinjau di menu{" "}
                    <Link href="/moderation/reports?tab=communities" className="font-semibold text-primary hover:underline">Peninjauan</Link>.
                </p>
            </header>

            <ul aria-label="Ringkasan komunitas" className="mt-6 grid list-none grid-cols-2 gap-3 p-0 xl:grid-cols-4">
                {stats.map(({ label, value, icon: Icon, tone }) => (
                    <li key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                        <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tone)}><Icon className="size-4" /></span>
                        <span>
                            <span className="block font-heading text-2xl leading-none font-semibold">{value}</span>
                            <span className="mt-1 block text-sm text-muted-foreground">{label}</span>
                        </span>
                    </li>
                ))}
            </ul>

            <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
                <nav aria-label="Filter status komunitas" className="flex flex-wrap gap-2">
                    {[{ value: undefined, label: "Semua" }, ...statusOrder.map((value) => ({ value, label: statusUi[value].tab }))].map((item) => {
                        const isActive = status === item.value;
                        return (
                            <Link key={item.label} href={hrefFor({ status: item.value, item: undefined })} aria-current={isActive ? "true" : undefined}
                                className={cn("rounded-lg border px-4 py-2 text-sm font-semibold", isActive ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
                <form action="/admin/communities" method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
                    {status && <input type="hidden" name="status" value={status} />}
                    <label className="flex h-10 items-center gap-2 rounded-lg border border-input px-3 focus-within:ring-2 focus-within:ring-ring/30 sm:w-60">
                        <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        <span className="sr-only">Cari nama komunitas atau pemilik</span>
                        <input name="q" type="search" maxLength={100} defaultValue={query} placeholder="Cari nama komunitas..." className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                    </label>
                    <label className="sr-only" htmlFor="region-filter">Wilayah</label>
                    <select id="region-filter" name="region" defaultValue={region ?? ""} className="h-10 rounded-lg border border-input bg-card px-3 text-sm">
                        <option value="">Semua Wilayah</option>
                        {regions.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                    <button type="submit" className="h-10 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/5">Terapkan</button>
                </form>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_400px]">
                <section aria-labelledby="community-list-title" className="h-fit overflow-hidden rounded-xl border border-border bg-card">
                    <h2 id="community-list-title" className="bg-[#f1f0ea] px-5 py-3 font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Daftar komunitas</h2>
                    {rows.length > 0 ? (
                        <table className="w-full text-sm">
                            <thead className="hidden text-left text-xs text-muted-foreground sm:table-header-group">
                                <tr className="border-b border-border">
                                    <th scope="col" className="px-5 py-2.5 font-medium">Komunitas</th>
                                    <th scope="col" className="px-3 py-2.5 font-medium">Verifikasi</th>
                                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Acara</th>
                                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Merch</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {rows.map((row) => {
                                    const isActive = row.id === active?.id;
                                    return (
                                        <tr key={row.id} className={cn("relative grid grid-cols-[1fr_auto] gap-1 px-5 py-3 hover:bg-muted/60 sm:table-row sm:p-0", isActive && "bg-[#e7efe8] hover:bg-[#e7efe8]")}>
                                            <td className={cn("sm:px-5 sm:py-3", isActive && "sm:border-l-4 sm:border-primary sm:pl-4")}>
                                                <Link href={hrefFor({ item: row.id })} aria-current={isActive ? "true" : undefined} className="flex items-center gap-3 after:absolute after:inset-0">
                                                    <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg font-heading", isActive ? "bg-primary text-primary-foreground" : "bg-[#e7efe8] text-primary")}>{row.name[0]?.toUpperCase()}</span>
                                                    <span className="min-w-0">
                                                        <span className="block truncate font-semibold">{row.name}</span>
                                                        <span className="block truncate text-xs text-muted-foreground">{row.publicLocation ?? "Wilayah belum diisi"}</span>
                                                    </span>
                                                </Link>
                                            </td>
                                            <td className="sm:px-3 sm:py-3"><StatusBadge status={row.status} /></td>
                                            <td className="col-span-2 text-xs text-muted-foreground sm:col-span-1 sm:px-3 sm:py-3 sm:text-right sm:text-sm sm:text-foreground">
                                                <span className="sm:hidden">Acara terbit: </span>{row.publishedEventCount}
                                            </td>
                                            <td className="col-span-2 text-xs text-muted-foreground sm:col-span-1 sm:px-5 sm:py-3 sm:text-right sm:text-sm sm:text-foreground">
                                                <span className="sm:hidden">Merchandise: </span>{row.publishedMerchandiseCount}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <p className="p-8 text-center text-sm text-muted-foreground">Tidak ada komunitas yang cocok dengan filter ini.</p>
                    )}
                </section>

                {active && (
                    <section aria-labelledby="community-detail-title" className="h-fit overflow-hidden rounded-xl border border-border bg-card xl:sticky xl:top-6">
                        <div className="flex items-start justify-between gap-3 bg-[#f1f0ea] p-5">
                            <div className="min-w-0">
                                <h2 id="community-detail-title" className="font-heading text-xl font-semibold">{active.name}</h2>
                                <p className="mt-1 text-xs text-muted-foreground">ID Komunitas: #{active.id.slice(-8).toUpperCase()}</p>
                            </div>
                            <StatusBadge status={active.status} />
                        </div>

                        <div className="border-t border-border p-5">
                            <h3 className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Profil</h3>
                            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <dt className="text-xs text-muted-foreground">Wilayah umum</dt>
                                    <dd className="mt-0.5 font-semibold">{active.publicLocation ?? "Belum diisi"}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">Terdaftar</dt>
                                    <dd className="mt-0.5 font-semibold">{date.format(active.createdAt)}</dd>
                                </div>
                            </dl>
                            {active.description && <p className="mt-3 line-clamp-4 text-sm whitespace-pre-line text-foreground/85">{active.description}</p>}
                        </div>

                        <div className="border-t border-border p-5">
                            <h3 className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Pengelola</h3>
                            <ul className="mt-3 flex list-none flex-col gap-3 p-0">
                                {managers.map((manager) => (
                                    <li key={manager.userId} className="flex items-center gap-3 text-sm">
                                        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e7efe8] text-xs font-semibold text-primary">{initialsOf(manager.name)}</span>
                                        <span className="min-w-0 flex-1 truncate font-semibold">{manager.name}</span>
                                        <span className="rounded-full bg-[#f1f0ea] px-2.5 py-0.5 text-xs font-semibold">{manager.role === "OWNER" ? "Pemilik" : "Pengelola"}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="border-t border-border p-5">
                            <h3 className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Konten komunitas</h3>
                            <dl className="mt-3 grid grid-cols-3 gap-2">
                                {[
                                    { label: "Acara terbit", value: active.publishedEventCount },
                                    { label: "Merchandise", value: active.publishedMerchandiseCount },
                                    { label: "Laporan", value: active.reportCount },
                                ].map((item) => (
                                    <div key={item.label} className="flex flex-col-reverse rounded-lg bg-[#f1f0ea] p-3">
                                        <dt className="text-xs text-muted-foreground">{item.label}</dt>
                                        <dd className="font-heading text-xl font-semibold">{item.value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>

                        <div className="border-t border-border p-5">
                            <h3 className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Verifikasi</h3>
                            <p className="mt-2 text-sm font-semibold">
                                {lastApproval
                                    ? `Diverifikasi oleh ${lastApproval.reviewerName ?? "peninjau tidak diketahui"} • ${date.format(lastApproval.reviewedAt ?? lastApproval.createdAt)}`
                                    : active.status === "VERIFIED"
                                        ? "Terverifikasi tanpa catatan peninjauan (data awal)"
                                        : "Belum pernah diverifikasi"}
                            </p>
                            {lastDecision && lastDecision !== lastApproval && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Keputusan terakhir: {statusUi[active.status].label} • {date.format(lastDecision.reviewedAt ?? lastDecision.createdAt)}
                                    {lastDecision.note ? ` — ${lastDecision.note}` : ""}
                                </p>
                            )}
                            <p className="mt-2 text-xs leading-5 text-muted-foreground">Verifikasi berarti profil telah ditinjau pengelola platform, bukan jaminan atas seluruh kegiatan komunitas.</p>
                        </div>

                        {active.status === "PENDING" ? (
                            <div className="flex flex-col gap-2 border-t border-border bg-[#f1f0ea] p-5 text-sm">
                                <p className="text-muted-foreground">Pengajuan ini menunggu keputusan di antrean peninjauan.</p>
                                <Link href={`/moderation/reports?tab=communities&view=PENDING&item=${active.id}`} className="flex h-11 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                                    Tinjau di Peninjauan
                                </Link>
                            </div>
                        ) : (
                            <CommunityDecisionPanel
                                key={active.id}
                                communityId={active.id}
                                decisions={availableCommunityDecisions(active.status)}
                                nextHref="/admin/communities?status={status}&item={id}"
                            />
                        )}

                        <div className="flex flex-col gap-3 border-t border-border p-5">
                            {active.status === "VERIFIED" && (
                                <Link href={`/communities/${active.id}`} target="_blank" className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted">
                                    Profil Publik <ExternalLink aria-hidden="true" className="size-4" /><span className="sr-only">(tab baru)</span>
                                </Link>
                            )}
                            <p className="flex gap-2 text-xs leading-5 text-muted-foreground">
                                <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                                Tindakan tercatat di jejak audit. Acara dan merchandise komunitas ikut disembunyikan dari halaman publik selama komunitas tidak terverifikasi.
                            </p>
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
