import { Ban, CircleCheck, ExternalLink, Info, Search, Trash2, UsersRound, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { accountLabel, maskEmail, type AccountLabel } from "@/features/admin-users/account-rules";
import { AccountActionPanel } from "@/features/admin-users/components/account-action-panel";
import { EmailReveal } from "@/features/admin-users/components/email-reveal";
import { getCurrentUser } from "@/lib/auth";
import { countUsers, listReportsAboutUser, listUserAuditTrail, listUsersForAdmin } from "@/lib/db/queries/admin-users";
import { listAuthEmails } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Data pengguna" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const labelText: Record<AccountLabel, string> = {
    ADMIN: "Admin",
    COMMUNITY_MANAGER: "Pengelola Komunitas",
    BOOK_OWNER: "Pemilik Buku",
    READER: "Pembaca",
};
const statusViews = { all: "Semua", active: "Aktif", suspended: "Ditangguhkan", deletion: "Menunggu Penghapusan", deleted: "Dihapus" } as const;
type StatusView = keyof typeof statusViews;

const auditText: Record<string, string> = {
    USER_SUSPENDED: "Akun ditangguhkan",
    USER_REINSTATED: "Akun dipulihkan",
    USER_ROLE_CHANGED: "Peran diubah",
    USER_EMAIL_REVEALED: "Email lengkap ditampilkan",
};
const reportStatusText: Record<string, string> = { PENDING: "Menunggu tinjauan", REVIEWING: "Sedang ditinjau", RESOLVED: "Ditindaklanjuti", REJECTED: "Diabaikan" };

const date = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const dateTime = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

function single(value: string | string[] | undefined) {
    return typeof value === "string" ? value : undefined;
}

function initialsOf(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function StatusBadge({ suspended }: { suspended: boolean }) {
    const Icon = suspended ? Ban : CircleCheck;
    return (
        <span className={cn("inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", suspended ? "bg-destructive/10 text-destructive" : "bg-[#d6efdf] text-primary")}>
            <Icon aria-hidden="true" className="size-3" /> {suspended ? "Ditangguhkan" : "Aktif"}
        </span>
    );
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const viewParam = single(params.status);
    const view: StatusView = viewParam && viewParam in statusViews ? viewParam as StatusView : "all";
    const roleParam = single(params.role);
    const role = roleParam === "ADMIN" || roleParam === "MEMBER" ? roleParam : undefined;
    const query = (single(params.q) ?? "").trim().slice(0, 100);
    const selected = single(params.item);

    const [me, counts, all, auth] = await Promise.all([getCurrentUser(), countUsers(), listUsersForAdmin({ query, role }), listAuthEmails()]);
    const rows = all
        .filter((row) => {
            if (view === "deleted") return Boolean(row.deletedAt);
            if (row.deletedAt) return view === "all";
            if (view === "deletion") return Boolean(row.deletionScheduledFor);
            if (view === "suspended") return Boolean(row.suspendedAt);
            return view === "all" || !row.suspendedAt;
        })
        .map((row) => ({ ...row, label: accountLabel(row), maskedEmail: maskEmail(auth.emails.get(row.id)) }));
    const active = rows.find((row) => row.id === selected) ?? rows[0];
    const [trail, reportsAbout] = active ? await Promise.all([listUserAuditTrail(active.id), listReportsAboutUser(active.id)]) : [[], []];

    const hrefFor = (next: Record<string, string | undefined>) => {
        const search = new URLSearchParams();
        const merged = { status: view === "all" ? undefined : view, role, q: query || undefined, item: selected, ...next };
        for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value);
        const value = search.toString();
        return value ? `/admin/users?${value}` : "/admin/users";
    };

    const stats: { label: string; value: React.ReactNode; icon: LucideIcon; tone: string }[] = [
        { label: "Total Pengguna", value: counts.total, icon: UsersRound, tone: "bg-[#ebe9e1] text-foreground/80" },
        { label: "Aktif", value: counts.total - counts.suspended - counts.deleted, icon: CircleCheck, tone: "bg-[#d6efdf] text-primary" },
        { label: "Ditangguhkan", value: counts.suspended, icon: Ban, tone: "bg-destructive/10 text-destructive" },
        { label: "Menunggu Penghapusan", value: counts.pendingDeletion, icon: Trash2, tone: "bg-[#ebe9e1] text-foreground/80" },
    ];

    return (
        <main className="px-4 py-8 sm:px-8 sm:py-10">
            <header>
                <h1 className="font-heading text-[28px] leading-tight font-semibold text-primary sm:text-[34px]">Data Pengguna</h1>
                <p className="mt-2 max-w-2xl text-base text-muted-foreground">Kelola status akun dan peran pengguna. Data pribadi ditampilkan seminimal mungkin dan setiap tindakan tercatat.</p>
            </header>

            {!auth.available && (
                <p role="status" className="mt-4 flex gap-2 rounded-lg border border-[#fbecc4] bg-[#fdf6e3] p-3 text-sm text-[#7a5300]">
                    <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    Email pengguna tidak dapat dimuat. Tambahkan <code className="font-mono break-all">SUPABASE_SERVICE_ROLE_KEY</code> di server agar email tersamar tampil.
                </p>
            )}

            <ul aria-label="Ringkasan pengguna" className="mt-6 grid list-none grid-cols-2 gap-3 p-0 xl:grid-cols-4">
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
                <nav aria-label="Filter status akun" className="flex flex-wrap gap-2">
                    {(Object.keys(statusViews) as StatusView[]).map((value) => (
                        <Link key={value} href={hrefFor({ status: value === "all" ? undefined : value, item: undefined })} aria-current={view === value ? "true" : undefined}
                            className={cn("rounded-lg border px-4 py-2 text-sm font-semibold", view === value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                            {statusViews[value]}
                        </Link>
                    ))}
                </nav>
                <form action="/admin/users" method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
                    {view !== "all" && <input type="hidden" name="status" value={view} />}
                    <label className="flex h-11 items-center gap-2 rounded-lg border border-input px-3 focus-within:ring-2 focus-within:ring-ring/30 sm:w-60">
                        <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        <span className="sr-only">Cari nama pengguna</span>
                        <input name="q" type="search" maxLength={100} defaultValue={query} placeholder="Cari nama pengguna..." className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                    </label>
                    <label className="sr-only" htmlFor="role-filter">Peran</label>
                    <select id="role-filter" name="role" defaultValue={role ?? ""} className="h-11 rounded-lg border border-input bg-card px-3 text-sm">
                        <option value="">Semua Peran</option>
                        <option value="ADMIN">Admin</option>
                        <option value="MEMBER">Anggota</option>
                    </select>
                    <button type="submit" className="h-11 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/5">Terapkan</button>
                </form>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_400px]">
                <section aria-labelledby="user-list-title" className="h-fit overflow-hidden rounded-xl border border-border bg-card">
                    <h2 id="user-list-title" className="bg-[#f1f0ea] px-5 py-3 font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Daftar pengguna</h2>
                    {rows.length > 0 ? (
                        <ul className="list-none divide-y divide-border p-0">
                            {rows.map((row) => {
                                const isActive = row.id === active?.id;
                                return (
                                    <li key={row.id}>
                                        <Link href={hrefFor({ item: row.id })} aria-current={isActive ? "true" : undefined}
                                            className={cn("grid grid-cols-[40px_1fr_auto] items-center gap-x-3 gap-y-1 px-5 py-3 hover:bg-muted/60 md:grid-cols-[40px_1fr_150px_130px_100px]", isActive && "border-l-4 border-primary bg-[#e7efe8] pl-4 hover:bg-[#e7efe8]")}>
                                            <span aria-hidden="true" className={cn("flex size-10 items-center justify-center rounded-full text-sm font-semibold", isActive ? "bg-primary text-primary-foreground" : "bg-[#e7efe8] text-primary")}>{initialsOf(row.displayName)}</span>
                                            <span className="min-w-0">
                                                <span className="block truncate font-semibold">{row.displayName}</span>
                                                <span className="block truncate text-xs text-muted-foreground">{row.maskedEmail ?? "Email tidak tersedia"}</span>
                                            </span>
                                            <span className="hidden text-sm md:block">{labelText[row.label]}</span>
                                            <StatusBadge suspended={Boolean(row.suspendedAt)} />
                                            <span className="col-start-2 text-xs text-muted-foreground md:col-start-auto">{date.format(row.createdAt)}</span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="p-8 text-center text-sm text-muted-foreground">Tidak ada pengguna yang cocok dengan filter ini.</p>
                    )}
                </section>

                {active && (
                    <section aria-labelledby="user-detail-title" className="h-fit overflow-hidden rounded-xl border border-border bg-card xl:sticky xl:top-6">
                        <div className="flex items-start justify-between gap-3 bg-[#f1f0ea] p-5">
                            <div className="min-w-0">
                                <h2 id="user-detail-title" className="font-heading text-xl font-semibold">{active.displayName}</h2>
                                <p className="mt-1 text-xs text-muted-foreground">ID Pengguna: #{active.id.slice(-8).toUpperCase()}</p>
                            </div>
                            <StatusBadge suspended={Boolean(active.suspendedAt)} />
                        </div>

                        <div className="p-5">
                            <h3 className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Profil</h3>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                <dl><dt className="text-xs text-muted-foreground">Peran</dt><dd className="mt-0.5 font-semibold">{labelText[active.label]}</dd></dl>
                                <dl><dt className="text-xs text-muted-foreground">Terdaftar</dt><dd className="mt-0.5 font-semibold">{date.format(active.createdAt)}</dd></dl>
                                {active.maskedEmail
                                    ? <EmailReveal key={active.id} userId={active.id} masked={active.maskedEmail} />
                                    : <dl className="col-span-2"><dt className="text-xs text-muted-foreground">Email</dt><dd className="mt-0.5 text-muted-foreground">Tidak tersedia</dd></dl>}
                            </div>
                            {active.deletedAt ? (
                                <p className="mt-3 rounded-lg bg-[#ebe9e1] px-3 py-2 text-sm">Akun dihapus dan dianonimkan {dateTime.format(active.deletedAt)}.</p>
                            ) : active.deletionScheduledFor && (
                                <p className="mt-3 rounded-lg bg-[#fbecc4] px-3 py-2 text-sm text-[#5c3d00]">Pengguna meminta hapus akun. Dihapus otomatis {dateTime.format(active.deletionScheduledFor)} bila tidak dibatalkan.</p>
                            )}
                            {active.suspendedAt && (
                                <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                    Ditangguhkan {dateTime.format(active.suspendedAt)}: {active.suspendedReason ?? "tanpa alasan tercatat"}
                                </p>
                            )}
                        </div>

                        <div className="border-t border-border p-5">
                            <h3 className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Aktivitas</h3>
                            <dl className="mt-3 grid grid-cols-3 gap-2">
                                {[
                                    { label: "Listing", value: active.listingCount, alert: false },
                                    { label: "Komunitas dikelola", value: active.managedCommunityCount, alert: false },
                                    { label: "Dilaporkan", value: active.reportCount, alert: active.reportCount > 0 },
                                ].map((item) => (
                                    <div key={item.label} className="flex flex-col-reverse rounded-lg bg-[#f1f0ea] p-3">
                                        <dt className="text-xs text-muted-foreground">{item.label}</dt>
                                        <dd className={cn("font-heading text-xl font-semibold", item.alert && "text-destructive")}>{item.value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>

                        <div className="border-t border-border p-5">
                            <h3 className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Riwayat moderasi</h3>
                            {reportsAbout.length > 0 && (
                                <ul className="mt-3 flex list-none flex-col gap-2 p-0">
                                    {reportsAbout.map((report) => (
                                        <li key={report.id}>
                                            <Link href={`/moderation/reports?item=${encodeURIComponent(`USER:${active.id}`)}`} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm hover:bg-muted">
                                                <span>
                                                    <span className="block font-semibold">Laporan akun: {report.reason}</span>
                                                    <span className="block text-xs text-muted-foreground">{dateTime.format(report.createdAt)} • {reportStatusText[report.status] ?? report.status}</span>
                                                </span>
                                                <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {trail.length > 0 ? (
                                <ol className="mt-3 flex list-none flex-col gap-2 p-0 text-xs text-muted-foreground">
                                    {trail.map((entry) => {
                                        const change = entry.metadata as { from?: string; to?: string } | null;
                                        return (
                                            <li key={entry.id}>
                                                <span className="font-semibold text-foreground">{auditText[entry.action] ?? entry.action}</span>
                                                {change?.to ? ` (${change.from} → ${change.to})` : ""} oleh {entry.actorName ?? "admin"} • {dateTime.format(entry.createdAt)}
                                                {entry.note ? ` — ${entry.note}` : ""}
                                            </li>
                                        );
                                    })}
                                </ol>
                            ) : (
                                reportsAbout.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Belum ada laporan atau tindakan moderasi pada akun ini.</p>
                            )}
                        </div>

                        <AccountActionPanel key={active.id} userId={active.id} role={active.role} suspended={Boolean(active.suspendedAt)} isSelf={active.id === me?.id} />
                        <p className="flex gap-2 border-t border-border p-5 text-xs leading-5 text-muted-foreground">
                            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                            Hapus akun dilakukan sendiri oleh pengguna (DEC-11): masa tenggang 14 hari, lalu data pribadi dihapus oleh tugas retensi di Pengaturan → Retensi &amp; Data.
                        </p>
                    </section>
                )}
            </div>
        </main>
    );
}
