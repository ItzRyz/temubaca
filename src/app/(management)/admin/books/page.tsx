import { AlertTriangle, ArrowLeftRight, BookMarked, Check, CircleCheck, Clock, Copy, Database, ExternalLink, EyeOff, Info, Lock, MapPin, Search, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CatalogSyncButton } from "@/features/catalog/components/catalog-sync-button";
import { ListingVisibilityPanel } from "@/features/catalog/components/listing-visibility-panel";
import { catalogRecordStatus, listingAdminStatus, type CatalogRecordStatus, type ListingAdminStatus } from "@/features/catalog/catalog-status";
import {
    countHiddenListings,
    countVisibleListings,
    latestProviderActivity,
    listBookSyncLogs,
    listCatalogRecords,
    listListingModerationHistory,
    listListingsForAdmin,
} from "@/lib/db/queries/catalog-admin";
import type { bookProviderValues } from "@/lib/db/schema";
import { getCatalogSettings } from "@/lib/db/queries/settings";
import { hasGoogleBooksKey } from "@/lib/external/books/registry";
import { timeAgo } from "@/lib/format/relative-time";
import { cn } from "@/lib/utils";
import { AppealReviewPanel } from "@/features/listing-appeals/components/appeal-dialog";
import { listAppealsForListing, listPendingAppeals } from "@/lib/db/queries/listing-appeals";

export const metadata: Metadata = { title: "Data buku" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type Provider = (typeof bookProviderValues)[number];

const providerLabels: Record<Provider, string> = { OPEN_LIBRARY: "Open Library", GOOGLE_BOOKS: "Google Books", MANUAL: "Manual", OTHER: "Lainnya" };
const conditionLabels: Record<string, string> = { NEW: "Baru", LIKE_NEW: "Sangat baik", GOOD: "Baik", FAIR: "Layak baca", POOR: "Perlu perhatian" };

const listingStatusUi: Record<ListingAdminStatus, { label: string; icon: LucideIcon; className: string }> = {
    AVAILABLE: { label: "Tersedia", icon: CircleCheck, className: "bg-[#d6efdf] text-primary" },
    RESERVED: { label: "Dipesan", icon: ArrowLeftRight, className: "bg-[#dfe7f7] text-[#24407a]" },
    UNAVAILABLE: { label: "Tidak ditawarkan", icon: Lock, className: "bg-[#ebe9e1] text-foreground/80" },
    HIDDEN: { label: "Disembunyikan", icon: EyeOff, className: "bg-destructive/10 text-destructive" },
};
const catalogStatusUi: Record<CatalogRecordStatus, { label: string; icon: LucideIcon; className: string }> = {
    FRESH: { label: "Terbaru", icon: CircleCheck, className: "bg-[#d6efdf] text-primary" },
    STALE: { label: "Usang", icon: Clock, className: "bg-[#fbecc4] text-[#7a5300]" },
    FAILED: { label: "Gagal sinkron", icon: AlertTriangle, className: "bg-destructive/10 text-destructive" },
    DUPLICATE: { label: "Duplikat", icon: Copy, className: "bg-[#dfe7f7] text-[#24407a]" },
};

const listingViews = { all: "Semua", AVAILABLE: "Tersedia", RESERVED: "Dipesan", HIDDEN: "Disembunyikan", reported: "Dilaporkan", appeal: "Banding" } as const;
const appealStatusText: Record<string, string> = { PENDING: "Menunggu keputusan", APPROVED: "Diterima", REJECTED: "Ditolak", REVOKED: "Dicabut" };
const catalogViews = { all: "Semua", FRESH: "Terbaru", STALE: "Usang", FAILED: "Gagal", DUPLICATE: "Duplikat" } as const;
type ListingView = keyof typeof listingViews;
type CatalogView = keyof typeof catalogViews;

function single(value: string | string[] | undefined) {
    return typeof value === "string" ? value : undefined;
}

function Badge({ ui }: { ui: { label: string; icon: LucideIcon; className: string } }) {
    const Icon = ui.icon;
    return (
        <span className={cn("inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", ui.className)}>
            <Icon aria-hidden="true" className="size-3" /> {ui.label}
        </span>
    );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <h3 className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{children}</h3>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 font-semibold break-words">{value}</dd>
        </div>
    );
}

function providerUrl(provider: Provider, providerId: string) {
    if (provider === "OPEN_LIBRARY") return `https://openlibrary.org/works/${encodeURIComponent(providerId)}`;
    if (provider === "GOOGLE_BOOKS") return `https://books.google.com/books?id=${encodeURIComponent(providerId)}`;
    return null;
}

export default async function AdminBooksPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const tab = single(params.tab) === "catalog" ? "catalog" : "listings";
    const query = (single(params.q) ?? "").trim().slice(0, 100);
    const selected = single(params.item);
    const view = single(params.view);

    const hrefFor = (next: Record<string, string | undefined>) => {
        const search = new URLSearchParams();
        const merged = { tab: tab === "catalog" ? "catalog" : undefined, view, q: query || undefined, item: selected, ...next };
        for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value);
        const value = search.toString();
        return value ? `/admin/books?${value}` : "/admin/books";
    };

    return (
        <main className="px-4 py-8 sm:px-8 sm:py-10">
            <header>
                <h1 className="font-heading text-[28px] leading-tight font-semibold text-primary sm:text-[34px]">Data Buku</h1>
                <p className="mt-2 max-w-2xl text-base text-muted-foreground">
                    {tab === "listings"
                        ? "Pantau listing buku yang ditawarkan pengguna dan kualitas data katalog. Listing bermasalah dapat disembunyikan dengan alasan tercatat."
                        : "Pantau sumber katalog buku, status sinkronisasi, dan data yang perlu diperbaiki. Data dari provider tidak diubah manual."}
                </p>
            </header>
            {tab === "listings"
                ? <ListingsTab view={(view && view in listingViews ? view : "all") as ListingView} query={query} selected={selected} hrefFor={hrefFor} />
                : <CatalogTab view={(view && view in catalogViews ? view : "all") as CatalogView} query={query} selected={selected} hrefFor={hrefFor} />}
        </main>
    );
}

type TabProps<View> = { view: View; query: string; selected?: string; hrefFor: (next: Record<string, string | undefined>) => string };

function Toolbar<View extends string>({ tab, views, view, query, hrefFor, placeholder }: {
    tab: "listings" | "catalog";
    views: Record<View, string>;
    view: View;
    query: string;
    hrefFor: TabProps<View>["hrefFor"];
    placeholder: string;
}) {
    return (
        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <nav aria-label="Jenis data buku" className="flex w-fit rounded-lg bg-[#f1f0ea] p-1">
                    {([["listings", "Listing Buku"], ["catalog", "Katalog Eksternal"]] as const).map(([value, label]) => (
                        <Link key={value} href={hrefFor({ tab: value === "catalog" ? "catalog" : undefined, view: undefined, item: undefined, q: undefined })} aria-current={tab === value ? "page" : undefined}
                            className={cn("rounded-md px-3 py-1.5 text-sm font-medium", tab === value ? "bg-card font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                            {label}
                        </Link>
                    ))}
                </nav>
                <nav aria-label="Filter" className="flex flex-wrap gap-2">
                    {(Object.keys(views) as View[]).map((value) => (
                        <Link key={value} href={hrefFor({ view: value === "all" ? undefined : value, item: undefined })} aria-current={view === value ? "true" : undefined}
                            className={cn("rounded-lg border px-4 py-2 text-sm font-semibold", view === value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                            {views[value]}
                        </Link>
                    ))}
                </nav>
            </div>
            <form action="/admin/books" method="get" role="search" className="flex xl:w-64">
                {tab === "catalog" && <input type="hidden" name="tab" value="catalog" />}
                {view !== "all" && <input type="hidden" name="view" value={view} />}
                <label className="flex h-11 w-full items-center gap-2 rounded-lg border border-input px-3 focus-within:ring-2 focus-within:ring-ring">
                    <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    <span className="sr-only">{placeholder}</span>
                    <input name="q" type="search" maxLength={100} defaultValue={query} placeholder={placeholder} className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                </label>
            </form>
        </div>
    );
}

function StatCards({ items }: { items: { label: string; value: React.ReactNode; icon: LucideIcon; tone: string; caption?: string }[] }) {
    return (
        <ul aria-label="Ringkasan" className="mt-6 grid list-none grid-cols-2 gap-3 p-0 xl:grid-cols-4">
            {items.map(({ label, value, icon: Icon, tone, caption }) => (
                <li key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                    <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tone)}><Icon className="size-4" /></span>
                    <span className="min-w-0">
                        <span className="block font-heading text-2xl leading-none font-semibold">{value}</span>
                        <span className="mt-1 block text-sm text-muted-foreground">{label}</span>
                        {caption && <span className="block truncate text-xs text-muted-foreground">{caption}</span>}
                    </span>
                </li>
            ))}
        </ul>
    );
}

async function ListingsTab({ view, query, selected, hrefFor }: TabProps<ListingView>) {
    const [all, available, reserved, hidden, pendingAppeals] = await Promise.all([
        listListingsForAdmin({ query }),
        countVisibleListings("AVAILABLE"),
        countVisibleListings("RESERVED"),
        countHiddenListings(),
        listPendingAppeals(),
    ]);
    const appealed = new Set(pendingAppeals.map((appeal) => appeal.listingId));
    const rows = all
        .map((row) => ({ ...row, adminStatus: listingAdminStatus(row) }))
        .filter((row) => view === "all" || (view === "reported" ? row.reportCount > 0 : view === "appeal" ? appealed.has(row.id) : row.adminStatus === view));
    const active = rows.find((row) => row.id === selected) ?? rows[0];
    const [history, appeals] = active ? await Promise.all([listListingModerationHistory(active.id), listAppealsForListing(active.id)]) : [[], []];
    const now = new Date();

    return (
        <>
            <StatCards items={[
                { label: "Total Listing", value: available + reserved + hidden + all.filter((row) => !row.hiddenAt && row.availability === "UNAVAILABLE").length, icon: BookMarked, tone: "bg-[#ebe9e1] text-foreground/80" },
                { label: "Tersedia", value: available, icon: CircleCheck, tone: "bg-[#d6efdf] text-primary" },
                { label: "Sedang Dipesan", value: reserved, icon: ArrowLeftRight, tone: "bg-[#dfe7f7] text-[#24407a]" },
                { label: "Disembunyikan", value: hidden, icon: EyeOff, tone: "bg-destructive/10 text-destructive" },
            ]} />
            <Toolbar tab="listings" views={listingViews} view={view} query={query} hrefFor={hrefFor} placeholder="Cari judul, penulis, pemilik..." />

            <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_400px]">
                <section aria-labelledby="listing-table-title" className="h-fit overflow-hidden rounded-xl border border-border bg-card">
                    <h2 id="listing-table-title" className="bg-[#f1f0ea] px-5 py-3 font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Daftar listing buku</h2>
                    {rows.length > 0 ? (
                        <ul className="list-none divide-y divide-border p-0">
                            {rows.map((row) => {
                                const isActive = row.id === active?.id;
                                return (
                                    <li key={row.id}>
                                        <Link href={hrefFor({ item: row.id })} aria-current={isActive ? "true" : undefined}
                                            className={cn("grid grid-cols-[40px_1fr_auto] items-center gap-x-3 gap-y-1 px-5 py-3 hover:bg-muted/60 md:grid-cols-[40px_1fr_140px_150px_60px]", isActive && "border-l-4 border-primary bg-[#e7efe8] pl-4 hover:bg-[#e7efe8]")}>
                                            <span aria-hidden="true" className={cn("flex size-10 items-center justify-center rounded-lg", isActive ? "bg-primary text-primary-foreground" : "bg-[#e7efe8] text-primary")}><BookMarked className="size-4" /></span>
                                            <span className="min-w-0">
                                                <span className="block truncate font-heading font-semibold">{row.title}</span>
                                                <span className="block truncate text-xs text-muted-foreground">{row.authors.join(", ") || "Penulis belum tercatat"}</span>
                                            </span>
                                            <span className="hidden truncate text-sm md:block">{row.ownerName}</span>
                                            <Badge ui={listingStatusUi[row.adminStatus]} />
                                            <span className={cn("col-start-2 text-xs md:col-start-auto md:text-sm", row.openReportCount > 0 ? "font-semibold text-destructive" : "text-muted-foreground")}>
                                                <span className="md:hidden">Laporan: </span>{row.reportCount > 0 ? row.reportCount : "—"}
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="p-8 text-center text-sm text-muted-foreground">Tidak ada listing yang cocok dengan filter ini.</p>
                    )}
                </section>

                {active && (
                    <section aria-labelledby="listing-detail-title" className="h-fit overflow-hidden rounded-xl border border-border bg-card xl:sticky xl:top-6">
                        <div className="flex items-start justify-between gap-3 bg-[#f1f0ea] p-5">
                            <div className="min-w-0">
                                <h2 id="listing-detail-title" className="font-heading text-xl font-semibold">{active.title}</h2>
                                <p className="mt-1 text-xs text-muted-foreground">ID Listing: #{active.id.slice(-8).toUpperCase()}</p>
                            </div>
                            <Badge ui={listingStatusUi[active.adminStatus]} />
                        </div>
                        <div className="p-5">
                            <SectionTitle>Data buku</SectionTitle>
                            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                <Field label="Penulis" value={active.authors.join(", ") || "—"} />
                                <Field label="Tahun • Penerbit" value={[active.publishedAt, active.publisher].filter(Boolean).join(" • ") || "—"} />
                            </dl>
                            <div className="mt-3 flex flex-col gap-3 rounded-lg bg-[#f1f0ea] p-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm">
                                    <span className="block font-semibold">Sumber: {providerLabels[active.provider]}</span>
                                    <span className="block text-xs text-muted-foreground">Disinkronkan: {timeAgo(active.syncedAt, now)}</span>
                                </p>
                                <CatalogSyncButton bookId={active.bookId} label="Sinkronkan" variant="outline" />
                            </div>
                        </div>
                        <div className="border-t border-border p-5">
                            <SectionTitle>Listing</SectionTitle>
                            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                <Field label="Pemilik" value={active.ownerName} />
                                <Field label="Kondisi" value={conditionLabels[active.condition] ?? active.condition} />
                            </dl>
                            <p className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground">
                                <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> Titik temu publik: {active.publicLocation ?? "belum diisi"}
                            </p>
                            {active.hiddenAt && (
                                <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">Disembunyikan {timeAgo(active.hiddenAt, now)}: {active.hiddenReason ?? "tanpa alasan tercatat"}</p>
                            )}
                        </div>
                        {appeals.length > 0 && (
                            <div className="border-t border-border p-5">
                                <SectionTitle>Banding pemilik</SectionTitle>
                                <ol className="mt-3 flex list-none flex-col gap-3 p-0">
                                    {appeals.map((appeal) => (
                                        <li key={appeal.id} className="rounded-lg border border-border p-3 text-sm">
                                            <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                                <span>{timeAgo(appeal.createdAt, now)}</span>
                                                <span className="rounded-full bg-[#ebe9e1] px-2 py-0.5 font-semibold text-foreground">{appealStatusText[appeal.status] ?? appeal.status}</span>
                                            </p>
                                            <p className="mt-1.5 font-semibold">{appeal.reason}</p>
                                            <p className="mt-1 whitespace-pre-line text-foreground/85">{appeal.details}</p>
                                            {appeal.fileName && (
                                                <a href={`/api/listing-appeals/${appeal.id}/file`} className="mt-1.5 inline-flex text-xs font-semibold text-primary hover:underline">Lihat foto bukti: {appeal.fileName}</a>
                                            )}
                                            {appeal.reviewNote && <p className="mt-1.5 text-xs text-muted-foreground">Keputusan: {appeal.reviewNote}</p>}
                                            {appeal.status === "PENDING" && <AppealReviewPanel appealId={appeal.id} />}
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}
                        <div className="border-t border-border p-5">
                            <SectionTitle>Laporan terkait</SectionTitle>
                            {active.reportCount > 0 ? (
                                <Link href={`/moderation/reports?view=${active.openReportCount > 0 ? "open" : "resolved"}&item=${encodeURIComponent(`BOOK_LISTING:${active.id}`)}`}
                                    className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm hover:bg-muted">
                                    <span>
                                        <span className="block font-semibold">{active.reportCount} laporan</span>
                                        <span className="block text-xs text-muted-foreground">{active.openReportCount > 0 ? `${active.openReportCount} menunggu tinjauan` : "Sudah ditinjau"}</span>
                                    </span>
                                    <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
                                </Link>
                            ) : (
                                <p className="mt-2 text-sm text-muted-foreground">Belum ada laporan untuk listing ini.</p>
                            )}
                            {history.length > 0 && (
                                <ol className="mt-4 flex list-none flex-col gap-2 p-0 text-xs text-muted-foreground">
                                    {history.map((entry) => (
                                        <li key={entry.id}>
                                            <span className="font-semibold text-foreground">{entry.status === "REVOKED" ? "Disembunyikan" : "Ditampilkan kembali"}</span>
                                            {" "}oleh {entry.reviewerName ?? "admin"} • {timeAgo(entry.at, now)}{entry.note ? ` — ${entry.note}` : ""}
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </div>
                        <ListingVisibilityPanel key={active.id} listingId={active.id} bookId={active.bookId} hidden={Boolean(active.hiddenAt)} />
                    </section>
                )}
            </div>
        </>
    );
}

async function CatalogTab({ view, query, selected, hrefFor }: TabProps<CatalogView>) {
    const now = new Date();
    const [records, activity, { settings }] = await Promise.all([listCatalogRecords({ query }), latestProviderActivity(), getCatalogSettings()]);
    const withStatus = records.map((record) => ({
        ...record,
        recordStatus: catalogRecordStatus({ createdAt: record.createdAt, syncedAt: record.syncedAt, lastSyncFailed: record.lastSyncStatus === "FAILED", duplicateCount: record.duplicateCount }, now, settings.staleAfterDays),
    }));
    const rows = withStatus.filter((row) => view === "all" || row.recordStatus === view);
    const active = rows.find((row) => row.id === selected) ?? rows[0];
    const logs = active ? await listBookSyncLogs(active.id) : [];
    const staleCount = withStatus.filter((row) => row.recordStatus === "STALE").length;
    const failedCount = withStatus.filter((row) => row.recordStatus === "FAILED").length;
    const openLibrary = activity.get("OPEN_LIBRARY");
    const googleBooks = activity.get("GOOGLE_BOOKS");
    const externalUrl = active ? providerUrl(active.provider, active.providerId) : null;

    const roleOf = (provider: "OPEN_LIBRARY" | "GOOGLE_BOOKS") =>
        settings.primaryProvider === provider ? "Utama" : settings.fallbackEnabled ? "Cadangan" : "Nonaktif";
    const providerCard = (name: string, role: string, entry: typeof openLibrary, note: string) => role === "Nonaktif" ? (
        <li className="flex flex-col justify-center gap-1 rounded-xl border border-border bg-card p-4">
            <p className="flex flex-wrap items-center gap-2">
                <span className="font-heading text-lg font-semibold">{name}</span>
                <span className="rounded-full bg-[#ebe9e1] px-2 py-0.5 text-xs font-semibold text-foreground/80">Nonaktif</span>
            </p>
            <p className="text-xs text-muted-foreground">Provider cadangan dimatikan di Pengaturan.</p>
        </li>
    ) : (
        <li className="flex flex-col justify-center gap-1 rounded-xl border border-border bg-card p-4">
            <p className="flex flex-wrap items-center gap-2">
                <span className="font-heading text-lg font-semibold">{name}</span>
                <span className="text-xs text-muted-foreground">{role}</span>
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", !entry ? "bg-[#ebe9e1] text-foreground/80" : entry.status === "FAILED" ? "bg-destructive/10 text-destructive" : "bg-[#d6efdf] text-primary")}>
                    {entry?.status === "FAILED" ? <AlertTriangle aria-hidden="true" className="size-3" /> : <Check aria-hidden="true" className="size-3" />}
                    {!entry ? "Terhubung" : entry.status === "FAILED" ? "Gagal terakhir" : "Aktif"}
                </span>
            </p>
            {/* Logs record the provider that produced each sync, so a complement's failures show in that record's history instead. */}
            <p className="text-xs text-muted-foreground">{entry ? `Sumber sinkron terakhir ${timeAgo(entry.createdAt, now)}` : "Belum menjadi sumber sinkron"} • {note}</p>
        </li>
    );

    return (
        <>
            <ul aria-label="Sumber katalog" className="mt-6 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-4">
                {providerCard("Open Library", roleOf("OPEN_LIBRARY"), openLibrary, "data dimiliki sumber, sampul dari covers.openlibrary.org")}
                {providerCard("Google Books", roleOf("GOOGLE_BOOKS"), googleBooks, hasGoogleBooksKey() ? "dengan API key" : "tanpa API key (kuota bersama)")}
                <li className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#fbecc4] text-[#7a5300]"><Clock className="size-4" /></span>
                    <span><span className="block font-heading text-2xl leading-none font-semibold">{staleCount}</span><span className="mt-1 block text-sm text-muted-foreground">Data Usang</span></span>
                </li>
                <li className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><AlertTriangle className="size-4" /></span>
                    <span><span className="block font-heading text-2xl leading-none font-semibold">{failedCount}</span><span className="mt-1 block text-sm text-muted-foreground">Gagal Sinkron</span></span>
                </li>
            </ul>
            <Toolbar tab="catalog" views={catalogViews} view={view} query={query} hrefFor={hrefFor} placeholder="Cari judul, penulis, ISBN..." />

            <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_400px]">
                <section aria-labelledby="catalog-table-title" className="h-fit overflow-hidden rounded-xl border border-border bg-card">
                    <h2 id="catalog-table-title" className="bg-[#f1f0ea] px-5 py-3 font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Rekaman katalog tersimpan</h2>
                    {rows.length > 0 ? (
                        <ul className="list-none divide-y divide-border p-0">
                            {rows.map((row) => {
                                const isActive = row.id === active?.id;
                                return (
                                    <li key={row.id}>
                                        <Link href={hrefFor({ item: row.id })} aria-current={isActive ? "true" : undefined}
                                            className={cn("grid grid-cols-[40px_1fr_auto] items-center gap-x-3 gap-y-1 px-5 py-3 hover:bg-muted/60 md:grid-cols-[40px_1fr_110px_130px_90px]", isActive && "border-l-4 border-primary bg-[#e7efe8] pl-4 hover:bg-[#e7efe8]")}>
                                            <span aria-hidden="true" className={cn("flex size-10 items-center justify-center rounded-lg", isActive ? "bg-primary text-primary-foreground" : "bg-[#e7efe8] text-primary")}><BookMarked className="size-4" /></span>
                                            <span className="min-w-0">
                                                <span className="block truncate font-heading font-semibold">{row.title}</span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {[row.authors[0], row.publishedAt, row.duplicateCount > 0 ? `${row.duplicateCount + 1} rekaman` : null].filter(Boolean).join(" • ") || "Penulis belum tercatat"}
                                                </span>
                                            </span>
                                            <span className="hidden text-sm md:block">{providerLabels[row.provider]}</span>
                                            <Badge ui={catalogStatusUi[row.recordStatus]} />
                                            <span className="col-start-2 text-xs text-muted-foreground md:col-start-auto">{timeAgo(row.lastSyncAt ?? row.syncedAt ?? row.createdAt, now)}</span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="p-8 text-center text-sm text-muted-foreground">Tidak ada rekaman yang cocok dengan filter ini.</p>
                    )}
                </section>

                {active && (
                    <section aria-labelledby="catalog-detail-title" className="h-fit overflow-hidden rounded-xl border border-border bg-card xl:sticky xl:top-6">
                        <div className="flex items-start justify-between gap-3 bg-[#f1f0ea] p-5">
                            <div className="min-w-0">
                                <h2 id="catalog-detail-title" className="font-heading text-xl font-semibold">{active.title}</h2>
                                <p className="mt-1 text-xs text-muted-foreground">ID Rekaman: #{active.id.slice(-8).toUpperCase()}</p>
                            </div>
                            <Badge ui={catalogStatusUi[active.recordStatus]} />
                        </div>
                        <div className="p-5">
                            <SectionTitle>Data tersimpan</SectionTitle>
                            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                <Field label="Penulis" value={active.authors.join(", ") || "—"} />
                                <Field label="Tahun • Penerbit" value={[active.publishedAt, active.publisher].filter(Boolean).join(" • ") || "—"} />
                                <Field label="Sumber" value={providerLabels[active.provider]} />
                                <Field label="ID provider" value={<span className="font-mono text-xs">{active.providerId}</span>} />
                                <Field label="ISBN" value={active.isbn ?? "—"} />
                            </dl>
                        </div>
                        <div className="border-t border-border p-5">
                            <SectionTitle>Sinkronisasi</SectionTitle>
                            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                <Field label="Terakhir disinkronkan" value={timeAgo(active.syncedAt, now)} />
                                <Field label="Dipakai oleh" value={`${active.listingCount} listing`} />
                            </dl>
                            <p className="mt-3 flex gap-2 rounded-lg bg-[#f1f0ea] p-3 text-xs leading-5 text-muted-foreground">
                                <Database aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                                Data berasal dari provider dan dapat tidak lengkap. Rekaman berlabel usang bila tidak disinkronkan lebih dari {settings.staleAfterDays} hari. Provider lain hanya mengisi kolom yang masih kosong.
                            </p>
                            {active.duplicateCount > 0 && (
                                <p className="mt-3 flex gap-2 text-xs leading-5 text-[#24407a]">
                                    <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                                    Ada {active.duplicateCount} rekaman lain dengan ISBN atau judul dan penulis yang sama. Penggabungan rekaman belum tersedia.
                                </p>
                            )}
                        </div>
                        <div className="border-t border-border p-5">
                            <SectionTitle>Riwayat sinkron</SectionTitle>
                            {logs.length > 0 ? (
                                <ol className="mt-3 flex list-none flex-col gap-3 p-0">
                                    {logs.map((log) => (
                                        <li key={log.id} className="flex gap-3">
                                            <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", log.status === "SUCCESS" ? "bg-primary" : "bg-destructive")} />
                                            <span className="text-sm">
                                                <span className="block font-semibold">
                                                    {log.status === "SUCCESS" ? "Sinkron berhasil" : "Sinkron gagal"}
                                                    {log.status === "SUCCESS" && (log.changedFields.length ? ` • ${log.changedFields.length} kolom diperbarui` : " • tanpa perubahan")}
                                                </span>
                                                <span className="block text-xs text-muted-foreground">{timeAgo(log.createdAt, now)} • {providerLabels[log.provider]}</span>
                                                {log.message && <span className="mt-0.5 block text-xs text-foreground/80">{log.message}</span>}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            ) : (
                                <p className="mt-2 text-sm text-muted-foreground">Belum pernah disinkronkan. Rekaman disimpan {timeAgo(active.createdAt, now)}.</p>
                            )}
                        </div>
                        <div className="flex flex-col gap-3 bg-[#f1f0ea] p-5">
                            <SectionTitle>Tindakan</SectionTitle>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {externalUrl ? (
                                    <a href={externalUrl} target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-muted">
                                        Lihat di Provider <ExternalLink aria-hidden="true" className="size-4" /><span className="sr-only">(tab baru)</span>
                                    </a>
                                ) : (
                                    <span className="flex h-10 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">Rekaman manual</span>
                                )}
                                <CatalogSyncButton key={active.id} bookId={active.id} />
                            </div>
                            <p className="text-xs text-muted-foreground">Sinkron ulang mengikuti batas permintaan provider (maks. 6 per menit per admin). Data buku tidak diubah manual.</p>
                        </div>
                    </section>
                )}
            </div>
        </>
    );
}
