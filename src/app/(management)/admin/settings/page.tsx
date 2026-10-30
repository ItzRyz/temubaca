import type { Metadata } from "next";
import Link from "next/link";

import { GUARANTEE_MAX_LENGTH } from "@/features/book-listings/listing-draft";
import { borrowBlockDayOptions, DISPUTE_REVIEW_HOURS, EXTENSION_MAX_DAYS, problemReasons, REMINDER_COOLDOWN_HOURS } from "@/features/borrowing/lifecycle";
import { EVIDENCE_MAX_BYTES, MAX_PENDING_APPLICATIONS } from "@/features/community-management/rules";
import { SettingsForm } from "@/features/settings/components/settings-form";
import type { SettingsSection as SettingsKey } from "@/features/settings/platform-settings";
import { footerLinkClass, RuleList, SectionFooter, SettingsSection, StatusStrip } from "@/features/settings/components/settings-layout";
import { RunRetentionButton } from "@/features/account-deletion/components/retention-panel";
import { LOAN_HISTORY_RETENTION_MONTHS } from "@/features/account-deletion/rules";
import { countPendingDeletions, getLastRetentionRun } from "@/lib/db/queries/account-deletion";
import { PLACE_TYPES, placeTypeLabels } from "@/features/places/places";
import { routeModeLabels, ROUTE_MODES } from "@/features/places/route";
import { countUsers } from "@/lib/db/queries/admin-users";
import { countOpenLoans } from "@/lib/db/queries/borrowing";
import { countHiddenListings } from "@/lib/db/queries/catalog-admin";
import { countCommunitiesByStatus } from "@/lib/db/queries/communities";
import { countPendingAppeals } from "@/lib/db/queries/listing-appeals";
import { listPlacesForAdmin } from "@/lib/db/queries/places";
import { countPendingCommunityContent } from "@/lib/db/queries/community-content";
import { getSettings } from "@/lib/db/queries/settings";
import { countReportsByStatus } from "@/lib/db/queries/reports";
import { isMlServiceConfigured } from "@/lib/ml/client";
import { RATE_LIMITS } from "@/lib/rate-limit/config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pengaturan" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Sections from the "Pengaturan" design (30 Okt 2026): every section is editable, with its live numbers and the rules that stay fixed. */
const sections = {
    catalog: { label: "Katalog Buku", hint: "Sumber data buku dan sinkronisasi", Content: CatalogSection },
    // map: { label: "Peta & Lokasi", hint: "Peta Literasi, titik, dan rute", Content: MapSection },
    // moderation: { label: "Moderasi & Publikasi", hint: "Laporan, verifikasi, dan banding", Content: ModerationSection },
    // borrowing: { label: "Aturan Pinjam", hint: "Alur pinjam, sengketa, dan sanksi", Content: BorrowingSection },
    // retention: { label: "Retensi & Data", hint: "Penghapusan akun dan masa simpan", Content: RetentionSection },
} as const;
type Section = keyof typeof sections;

const dateTime = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

export default async function AdminSettingsPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const requested = typeof params.section === "string" ? params.section : undefined;
    const section: Section = requested && requested in sections ? requested as Section : "catalog";
    const { Content } = sections[section];

    return (
        <main className="px-4 py-8 sm:px-8 sm:py-10">
            <header className="flex flex-col gap-1">
                <h1 className="font-heading text-[28px] leading-tight font-semibold text-primary sm:text-[34px]">Pengaturan</h1>
                <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">Atur sumber data, aturan platform, dan kebijakan moderasi. Setiap perubahan berlaku untuk seluruh pengguna setelah disimpan dan tercatat di jejak audit.</p>
            </header>

            <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
                <nav aria-label="Bagian pengaturan" className="h-fit min-w-0 lg:sticky lg:top-6">
                    <ul className="-mx-4 flex list-none gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
                        {(Object.keys(sections) as Section[]).map((key) => (
                            <li key={key} className="shrink-0">
                                <Link href={key === "catalog" ? "/admin/settings" : `/admin/settings?section=${key}`} aria-current={section === key ? "page" : undefined}
                                    className={cn(
                                        "flex flex-col rounded-lg border-l-2 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring lg:py-2.5",
                                        section === key ? "border-primary bg-[#e7efe8] text-primary" : "border-transparent text-foreground hover:bg-muted",
                                    )}>
                                    <span className={cn(section === key && "font-semibold")}>{sections[key].label}</span>
                                    <span className="hidden text-xs text-muted-foreground lg:block">{sections[key].hint}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="min-w-0">
                    <Content />
                </div>
            </div>
        </main>
    );
}

/** The section's form with who changed it last; every section follows the same pattern. */
async function EditableForm({ section }: { section: SettingsKey }) {
    const { settings } = await getSettings(section);
    return (
        <div className="px-5 py-5 sm:px-6">
            <SettingsForm section={section} initial={settings as Record<string, string | number | boolean>} />
        </div>
    );
}

async function lastChange(section: SettingsKey) {
    const { updatedAt, updatedByName } = await getSettings(section);
    return updatedAt ? `Terakhir diubah ${updatedByName ?? "admin"} · ${dateTime.format(updatedAt)}` : "Memakai pengaturan bawaan";
}

/** Rules that stay fixed in code, folded under the form. */
function FixedRules({ rules }: { rules: [string, string][] }) {
    return (
        <details className="group border-t border-border">
            <summary className="flex min-h-11 cursor-pointer list-none items-center px-5 text-sm font-semibold text-primary sm:px-6">
                Aturan lain yang berlaku <span aria-hidden="true" className="ml-1 transition-transform group-open:rotate-90">›</span>
            </summary>
            <RuleList rules={rules} />
        </details>
    );
}

async function CatalogSection() {
    return (
        <SettingsSection id="catalog" title="Katalog Buku" purpose="Sumber data buku dan aturan pembaruan data tersimpan." source={{ kind: "editable", note: await lastChange("catalog") }}>
            <EditableForm section="catalog" />
        </SettingsSection>
    );
}

/** DEC-07 plus what is on the Peta Literasi right now. */
async function MapSection() {
    const places = await listPlacesForAdmin();
    const routing = isMlServiceConfigured();
    const rules: [string, string][] = [
        ["Pencarian alamat", "Tanpa geocoding. Pembaca menyaring jenis, provinsi atau kab/kota, dan nama tempat; titik dipasang dengan mengeklik peta atau mengisi koordinat."],
        ["Lokasi perangkat", "Bila diizinkan, “Gunakan lokasiku” hanya dipakai di peramban untuk memusatkan peta dan mengurutkan jarak; tidak dikirim ke server dan tidak disimpan."],
        ["Rute", `${ROUTE_MODES.map((mode) => routeModeLabels[mode]).join(" dan ")} lewat ML Service, untuk DKI Jakarta daratan, Kota/Kab. Tangerang, dan Tangerang Selatan. Di luar cakupan, pembaca diarahkan ke Google Maps.`],
        ["Titik di peta", "Perpustakaan dan titik temu publik dikurasi admin. Titik komunitas tampil selama komunitas terverifikasi; titik acara selama acara terbit, tatap muka, dan belum selesai. Listing buku warga tidak pernah tampil di peta."],
    ];
    return (
        <SettingsSection id="map" title="Peta & Lokasi" purpose="Penyedia peta dan cara lokasi ditampilkan." source={{ kind: "editable", note: await lastChange("map") }}>
            <StatusStrip label="Saat ini" items={[
                ...PLACE_TYPES.map((type) => {
                    const ofType = places.filter((place) => place.type === type);
                    return { label: `${placeTypeLabels[type]} di peta`, value: `${ofType.filter((place) => place.onMap).length} / ${ofType.length}` };
                }),
                { label: "Disembunyikan", value: places.filter((place) => place.hiddenAt).length, href: "/admin/places" },
                { label: "Layanan rute", value: routing ? "Aktif" : "Mati" },
            ]} />
            <EditableForm section="map" />
            <FixedRules rules={rules} />
            <SectionFooter>
                <Link href="/admin/places" className={footerLinkClass}>Kelola Data Tempat</Link>
            </SectionFooter>
        </SettingsSection>
    );
}

/** DEC-04/05/11 plus the queues right now. */
async function ModerationSection() {
    const [pendingReports, reviewingReports, pendingCommunities, pendingAppeals, hiddenListings, users, pendingContent] = await Promise.all([
        countReportsByStatus("PENDING"),
        countReportsByStatus("REVIEWING"),
        countCommunitiesByStatus("PENDING"),
        countPendingAppeals(),
        countHiddenListings(),
        countUsers(),
        countPendingCommunityContent(),
    ]);
    const rules: [string, string][] = [
        ["Listing buku warga", "Langsung tampil; pengawasan lewat laporan pengguna."],
        ["Pengajuan komunitas", `Bukti aktivitas berupa tautan wajib, berkas opsional (PDF/JPG/PNG, maks. ${EVIDENCE_MAX_BYTES / 1024 / 1024} MB). Satu akun maksimal ${MAX_PENDING_APPLICATIONS} pengajuan yang menunggu.`],
        ["Laporan", `Akun yang masuk dapat melaporkan konten dengan alasan tetap per jenis, maksimal ${RATE_LIMITS.REPORT.limit} laporan per ${RATE_LIMITS.REPORT.windowSeconds} detik.`],
        ["Tindakan admin", "Menyembunyikan listing atau titik peta, menangguhkan komunitas atau akun, selalu dengan alasan, dan tercatat di jejak audit."],
    ];
    return (
        <SettingsSection id="moderation" title="Moderasi & Publikasi" purpose="Konten mana yang ditinjau sebelum tayang dan bagaimana laporan ditangani." source={{ kind: "editable", note: await lastChange("moderation") }}>
            <StatusStrip label="Antrean saat ini" items={[
                { label: "Laporan menunggu", value: pendingReports, href: "/moderation/reports", alert: true },
                { label: "Sedang ditinjau", value: reviewingReports, href: "/moderation/reports" },
                { label: "Pengajuan komunitas", value: pendingCommunities, href: "/moderation/reports?tab=communities", alert: true },
                { label: "Acara & merchandise", value: pendingContent, href: "/moderation/reports?tab=content", alert: true },
                { label: "Banding listing", value: pendingAppeals, href: "/admin/books?view=banding", alert: true },
                { label: "Listing disembunyikan", value: hiddenListings, href: "/admin/books" },
                { label: "Akun ditangguhkan", value: users.suspended, href: "/admin/users" },
            ]} />
            <EditableForm section="moderation" />
            <FixedRules rules={rules} />
            <SectionFooter>
                <Link href="/moderation/reports" className={footerLinkClass}>Buka Peninjauan</Link>
            </SectionFooter>
        </SettingsSection>
    );
}

/** DEC-02 plus the loans open right now. */
async function BorrowingSection() {
    const open = await countOpenLoans();
    const rules: [string, string][] = [
        ["Batas lama pinjam", "Pemilik menetapkan batas di listing (1–60 hari); tenggat dihitung dari serah terima."],
        ["Pembatalan", "Peminjam dapat membatalkan selama permintaan belum ditanggapi. Setelah diterima, kedua pihak dapat membatalkan sebelum serah terima."],
        ["Serah terima & pengembalian", "Masing-masing butuh konfirmasi kedua pihak. Saat mengonfirmasi pengembalian, pemilik dapat memberi ulasan untuk peminjam."],
        ["Perpanjangan", `Diajukan peminjam sebelum tenggat, paling lama ${EXTENSION_MAX_DAYS} hari per pengajuan; batas jumlahnya diatur di atas.`],
        ["Keterlambatan", `Pemilik dapat mengirim pengingat sekali per ${REMINDER_COOLDOWN_HOURS} jam. Tanpa denda atau ganti rugi uang di platform.`],
        ["Jaminan", `Opsional dari pemilik, bukan uang, maksimal ${GUARANTEE_MAX_LENGTH} karakter.`],
        ["Sengketa", `Salah satu pihak melaporkan masalah (${problemReasons.map((reason) => reason.value).join(", ")}). Admin memutuskan dengan target ${DISPUTE_REVIEW_HOURS} jam; konsekuensi: tanpa sanksi, peringatan, tidak dapat meminjam ${borrowBlockDayOptions.join("/")} hari, atau penangguhan akun.`],
    ];
    return (
        <SettingsSection id="borrowing" title="Aturan Pinjam" purpose="Nilai bawaan untuk listing buku baru dan alur pinjam." source={{ kind: "editable", note: await lastChange("borrowing") }}>
            <StatusStrip label="Pinjaman berjalan" items={[
                { label: "Menunggu pemilik", value: open.pending },
                { label: "Menunggu serah terima", value: open.awaitingHandover },
                { label: "Sedang dipinjam", value: open.active },
                { label: "Terlambat", value: open.overdue, alert: true },
                { label: "Perpanjangan menunggu", value: open.extensionPending },
                { label: "Sengketa terbuka", value: open.disputed, href: "/admin/loans", alert: true },
            ]} />
            <EditableForm section="borrowing" />
            <FixedRules rules={rules} />
            <SectionFooter>
                <Link href="/admin/loans" className={footerLinkClass}>Tinjau sengketa pinjam</Link>
            </SectionFooter>
        </SettingsSection>
    );
}

/** DEC-11 plus the last run of the retention job. */
async function RetentionSection() {
    const [lastRun, pendingDeletions] = await Promise.all([getLastRetentionRun(), countPendingDeletions()]);
    const rules: [string, string][] = [
        ["Hapus akun", "Setelah masa tunggu, data pribadi dihapus dan riwayat bersama dianonimkan (\"Akun dihapus\"). Ditolak selama ada pinjaman berjalan/sengketa atau komunitas terverifikasi milik akun."],
        ["Riwayat pinjam selesai", `Dihapus ${LOAN_HISTORY_RETENTION_MONTHS} bulan setelah pinjaman ditolak, dibatalkan, dikembalikan, atau dinyatakan hilang.`],
        ["Backup", "Mengikuti kebijakan bawaan Supabase; data yang sudah dihapus bisa tetap ada di backup sampai backup itu kedaluwarsa."],
    ];
    return (
        <SettingsSection id="retention" title="Retensi & Data" purpose="Berapa lama data disimpan dan bagaimana penghapusan akun diproses." source={{ kind: "editable", note: await lastChange("retention") }}>
            <StatusStrip label="Tugas retensi" items={[
                { label: "Akun menunggu dihapus", value: pendingDeletions },
                { label: "Terakhir dijalankan", value: lastRun ? dateTime.format(new Date(lastRun.ranAt)) : "Belum pernah" },
                ...(lastRun ? [
                    { label: "Akun dihapus", value: lastRun.accountsDeleted },
                    { label: "Akun tertahan", value: lastRun.accountsBlocked ?? 0, alert: true },
                    { label: "Riwayat pinjam dihapus", value: lastRun.loans },
                    { label: "Catatan audit dihapus", value: lastRun.auditEntries },
                ] : []),
            ]} />
            <EditableForm section="retention" />
            <FixedRules rules={rules} />
            <SectionFooter>
                <RunRetentionButton />
                <p className="text-xs text-muted-foreground">Berjalan otomatis setiap hari (Vercel Cron); tombol ini menjalankannya sekarang.</p>
            </SectionFooter>
        </SettingsSection>
    );
}
