import type { Metadata } from "next";
import Link from "next/link";

import { GUARANTEE_MAX_LENGTH, loanDayOptions } from "@/features/book-listings/listing-draft";
import { borrowBlockDayOptions, DISPUTE_REVIEW_HOURS, EXTENSION_MAX_DAYS, problemReasons, rejectionReasons, REMINDER_COOLDOWN_HOURS } from "@/features/borrowing/lifecycle";
import { EVIDENCE_MAX_BYTES, MAX_PENDING_APPLICATIONS } from "@/features/community-management/rules";
import { CatalogSettingsForm } from "@/features/settings/components/catalog-settings-form";
import { footerLinkClass, RuleList, SectionFooter, SettingsSection, StatusStrip } from "@/features/settings/components/settings-layout";
import { RunRetentionButton } from "@/features/account-deletion/components/retention-panel";
import { AUDIT_RETENTION_MONTHS, DELETION_GRACE_DAYS, LOAN_HISTORY_RETENTION_MONTHS, REPORT_DETAILS_RETENTION_MONTHS } from "@/features/account-deletion/rules";
import { countPendingDeletions, getLastRetentionRun } from "@/lib/db/queries/account-deletion";
import { MAP_TILE_URL, PLACE_TYPES, placeTypeLabels } from "@/features/places/places";
import { routeModeLabels, ROUTE_MODES } from "@/features/places/route";
import { countUsers } from "@/lib/db/queries/admin-users";
import { countOpenLoans } from "@/lib/db/queries/borrowing";
import { countHiddenListings } from "@/lib/db/queries/catalog-admin";
import { countCommunitiesByStatus } from "@/lib/db/queries/communities";
import { countPendingAppeals } from "@/lib/db/queries/listing-appeals";
import { listPlacesForAdmin } from "@/lib/db/queries/places";
import { getCatalogSettings } from "@/lib/db/queries/settings";
import { countReportsByStatus } from "@/lib/db/queries/reports";
import { isMlServiceConfigured } from "@/lib/ml/client";
import { RATE_LIMITS } from "@/lib/rate-limit/config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pengaturan" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Sections from Figma 161:859, redesigned 30 Okt 2026. Only "Katalog Buku" is editable; the others show the rules in force and live numbers. */
const sections = {
    catalog: { label: "Katalog Buku", hint: "Sumber data buku dan sinkronisasi", Content: CatalogSection },
    map: { label: "Peta & Lokasi", hint: "Peta Literasi, titik, dan rute", Content: MapSection },
    moderation: { label: "Moderasi & Publikasi", hint: "Laporan, verifikasi, dan banding", Content: ModerationSection },
    borrowing: { label: "Aturan Pinjam", hint: "Alur pinjam, sengketa, dan sanksi", Content: BorrowingSection },
    retention: { label: "Retensi & Data", hint: "Penghapusan akun dan masa simpan", Content: RetentionSection },
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
                <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">Hanya Katalog Buku yang bisa diubah dari sini dan tercatat di jejak audit. Bagian lain menampilkan aturan yang berlaku beserta keadaan platform saat ini.</p>
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

/** Saved catalog settings; the only section an admin can change. */
async function CatalogSection() {
    const { settings, updatedAt, updatedByName } = await getCatalogSettings();
    return (
        <SettingsSection id="catalog" title="Katalog Buku" purpose="Menentukan dari mana data buku diambil saat pengguna mencari dan menambah buku, dan kapan data katalog disinkronkan."
            source={{ kind: "editable", note: updatedAt ? `Terakhir diubah ${updatedByName ?? "admin"} · ${dateTime.format(updatedAt)}` : "Memakai pengaturan bawaan" }}>
            <div className="px-5 py-5 sm:px-6">
                <CatalogSettingsForm key={updatedAt?.toISOString() ?? "default"} initial={settings} />
            </div>
        </SettingsSection>
    );
}

/** DEC-07 policy (fixed in code and env) plus what is on the Peta Literasi right now. */
async function MapSection() {
    const places = await listPlacesForAdmin();
    const tileHost = MAP_TILE_URL.match(/^https?:\/\/([^/]+)/)?.[1] ?? MAP_TILE_URL;
    const routing = isMlServiceConfigured();
    const rules: [string, string][] = [
        ["Peta", `Leaflet dengan tile ${tileHost}${tileHost === "tile.openstreetmap.org" ? ", beratribusi “© kontributor OpenStreetMap”. Kebijakan tile OSM hanya untuk trafik rendah; bila trafik naik, ganti provider lewat NEXT_PUBLIC_MAP_TILE_URL" : " (NEXT_PUBLIC_MAP_TILE_URL)"}. Daftar tempat tetap berfungsi tanpa peta.`],
        ["Pencarian alamat", "Tanpa geocoding. Pembaca menyaring jenis, provinsi atau kab/kota, dan nama tempat; titik dipasang dengan mengeklik peta atau mengisi koordinat."],
        ["Lokasi pembaca", "Opsional. “Gunakan lokasiku” hanya dipakai di peramban untuk memusatkan peta dan mengurutkan jarak; tidak dikirim ke server dan tidak disimpan."],
        ["Rute", `${ROUTE_MODES.map((mode) => routeModeLabels[mode]).join(" dan ")} lewat ML Service, untuk DKI Jakarta daratan, Kota/Kab. Tangerang, dan Tangerang Selatan. Titik asal dikirim hanya saat pembaca menekan Rute, dipakai sekali, tidak disimpan dan tidak dicatat di log. Di luar cakupan, pembaca diarahkan ke Google Maps.`],
        ["Titik di peta", "Perpustakaan dan titik temu publik dikurasi admin. Titik komunitas tampil selama komunitas terverifikasi; titik acara selama acara terbit, tatap muka, dan belum selesai. Listing buku warga tidak pernah tampil di peta."],
        ["Wilayah", "Koordinat dibatasi ke kotak wilayah Indonesia, enam desimal."],
    ];
    return (
        <SettingsSection id="map" title="Peta & Lokasi" purpose="Cara Peta Literasi menampilkan tempat, melindungi lokasi pembaca, dan menghitung rute." source={{ kind: "policy", decision: "DEC-07" }}>
            <StatusStrip label="Saat ini" items={[
                ...PLACE_TYPES.map((type) => {
                    const ofType = places.filter((place) => place.type === type);
                    return { label: `${placeTypeLabels[type]} di peta`, value: `${ofType.filter((place) => place.onMap).length} / ${ofType.length}` };
                }),
                { label: "Disembunyikan", value: places.filter((place) => place.hiddenAt).length, href: "/admin/places" },
                { label: "Layanan rute", value: routing ? "Aktif" : "Mati" },
            ]} />
            <RuleList rules={rules} />
            <SectionFooter>
                <Link href="/admin/places" className={footerLinkClass}>Kelola Data Tempat</Link>
                {!routing && <p className="text-xs text-muted-foreground">ML Service belum dikonfigurasi (RECOMMENDATION_API_URL); tombol Rute membuka Google Maps.</p>}
            </SectionFooter>
        </SettingsSection>
    );
}

/** What publishes without review, what an admin decides (DEC-04/05, DEC-11), and the queues right now. */
async function ModerationSection() {
    const [pendingReports, reviewingReports, pendingCommunities, pendingAppeals, hiddenListings, users] = await Promise.all([
        countReportsByStatus("PENDING"),
        countReportsByStatus("REVIEWING"),
        countCommunitiesByStatus("PENDING"),
        countPendingAppeals(),
        countHiddenListings(),
        countUsers(),
    ]);
    const rules: [string, string][] = [
        ["Tanpa tinjauan lebih dulu", "Listing buku warga, serta acara, merchandise, dan perubahan profil komunitas terverifikasi langsung tampil. Pengawasan lewat laporan pengguna."],
        ["Pengajuan komunitas", `Menunggu persetujuan admin di Peninjauan. Bukti aktivitas berupa tautan wajib, berkas opsional (PDF/JPG/PNG, maks. ${EVIDENCE_MAX_BYTES / 1024 / 1024} MB). Satu akun maksimal ${MAX_PENDING_APPLICATIONS} pengajuan yang menunggu. Pembaruan verifikasi tidak menurunkan status.`],
        ["Laporan", `Akun yang masuk dapat melaporkan buku, salinan, komunitas, acara, merchandise, atau akun lain dengan alasan tetap per jenis, maksimal ${RATE_LIMITS.REPORT.limit} laporan per ${RATE_LIMITS.REPORT.windowSeconds} detik. Detail laporan dihapus ${REPORT_DETAILS_RETENTION_MONTHS} bulan setelah diputus.`],
        ["Tindakan admin", "Menyembunyikan listing atau titik peta, menangguhkan komunitas atau akun, selalu dengan alasan. Akun yang ditangguhkan tetap dapat masuk dan membaca, tetapi tidak dapat menulis, dan listingnya tidak tampil."],
        ["Banding", "Pemilik listing yang disembunyikan dapat mengajukan satu banding yang ditinjau sekaligus. Banding yang diterima memulihkan listing."],
        ["Jejak", "Keputusan atas komunitas, listing, dan banding tercatat di riwayat verifikasi; penangguhan akun, penyembunyian titik peta, ubah peran, dan ubah pengaturan tercatat di jejak audit. Semua keputusan dilakukan manual oleh admin, tanpa filter otomatis."],
    ];
    return (
        <SettingsSection id="moderation" title="Moderasi & Publikasi" purpose="Apa yang langsung tampil, apa yang diputus admin, dan bagaimana keputusan dicatat." source={{ kind: "policy", decision: "DEC-04, DEC-05, DEC-11" }}>
            <StatusStrip label="Antrean saat ini" items={[
                { label: "Laporan menunggu", value: pendingReports, href: "/moderation/reports", alert: true },
                { label: "Sedang ditinjau", value: reviewingReports, href: "/moderation/reports" },
                { label: "Pengajuan komunitas", value: pendingCommunities, href: "/admin/communities", alert: true },
                { label: "Banding listing", value: pendingAppeals, alert: true },
                { label: "Listing disembunyikan", value: hiddenListings, href: "/admin/books" },
                { label: "Akun ditangguhkan", value: users.suspended, href: "/admin/users" },
            ]} />
            <RuleList rules={rules} />
            <SectionFooter>
                <Link href="/moderation/reports" className={footerLinkClass}>Buka Peninjauan</Link>
            </SectionFooter>
        </SettingsSection>
    );
}

/** DEC-02 loan lifecycle (fixed in code) plus the loans open right now. */
async function BorrowingSection() {
    const open = await countOpenLoans();
    const rules: [string, string][] = [
        ["Lama pinjam", `${loanDayOptions.join("/")} hari, maksimal sesuai batas yang ditetapkan pemilik di listing. Tenggat dihitung dari serah terima.`],
        ["Permintaan", `Peminjam memilih titik temu dari daftar pemilik (tempat umum atau titik di Peta Literasi), waktu bertemu opsional, dan pesan. Pemilik menerima, atau menolak dengan alasan tetap (${rejectionReasons.join(", ")}). Menerima satu permintaan memesan salinan dan menolak otomatis permintaan lain yang menunggu.`],
        ["Pembatalan", "Peminjam dapat membatalkan selama permintaan belum ditanggapi. Setelah diterima, kedua pihak dapat membatalkan sebelum serah terima."],
        ["Serah terima & pengembalian", "Masing-masing butuh konfirmasi kedua pihak. Pinjaman baru berjalan, atau selesai, setelah dua konfirmasi."],
        ["Perpanjangan", `Satu kali, diajukan peminjam sebelum tenggat, paling lama ${EXTENSION_MAX_DAYS} hari dari tenggat lama. Pemilik menerima atau menolak.`],
        ["Keterlambatan", `Ditampilkan “Terlambat N hari”. Pemilik dapat mengirim pengingat di aplikasi, sekali per ${REMINDER_COOLDOWN_HOURS} jam. Tanpa denda dan tanpa ganti rugi uang di platform.`],
        ["Jaminan", `Opsional dari pemilik, bukan uang, maksimal ${GUARANTEE_MAX_LENGTH} karakter, cukup ditunjukkan saat serah terima. Disalin ke permintaan saat diajukan.`],
        ["Sengketa", `Salah satu pihak melaporkan masalah (${problemReasons.map((reason) => reason.value).join(", ")}). Pinjaman terkunci sampai admin memutuskan Dikembalikan atau Hilang, dengan target ${DISPUTE_REVIEW_HOURS} jam. Selama ditinjau, kedua pihak dapat menambah keterangan dan admin dapat bertanya ke salah satu atau kedua pihak. Keputusan tercatat di riwayat pinjaman dan jejak audit.`],
        ["Konsekuensi", `Dipilih admin per kasus untuk salah satu pihak: tanpa sanksi, peringatan, tidak dapat meminjam ${borrowBlockDayOptions.join("/")} hari, atau penangguhan akun.`],
    ];
    return (
        <SettingsSection id="borrowing" title="Aturan Pinjam" purpose="Alur pinjam-meminjam dari permintaan sampai pengembalian, termasuk sengketa dan sanksinya." source={{ kind: "policy", decision: "DEC-02" }}>
            <StatusStrip label="Pinjaman berjalan" items={[
                { label: "Menunggu pemilik", value: open.pending },
                { label: "Menunggu serah terima", value: open.awaitingHandover },
                { label: "Sedang dipinjam", value: open.active },
                { label: "Terlambat", value: open.overdue, alert: true },
                { label: "Perpanjangan menunggu", value: open.extensionPending },
                { label: "Sengketa terbuka", value: open.disputed, href: "/admin/loans", alert: true },
            ]} />
            <RuleList rules={rules} />
            <SectionFooter>
                <Link href="/admin/loans" className={footerLinkClass}>Tinjau sengketa pinjam</Link>
            </SectionFooter>
        </SettingsSection>
    );
}

/** DEC-11 policy (fixed in code) plus the last run of the retention job. */
async function RetentionSection() {
    const [lastRun, pendingDeletions] = await Promise.all([getLastRetentionRun(), countPendingDeletions()]);
    const rules: [string, string][] = [
        ["Hapus akun", `Akun dinonaktifkan ${DELETION_GRACE_DAYS} hari dan dapat dibatalkan pengguna, lalu data pribadi dihapus dan riwayat bersama dianonimkan ("Akun dihapus"). Ditolak selama ada pinjaman berjalan/sengketa atau komunitas terverifikasi milik akun.`],
        ["Detail laporan", `Dihapus ${REPORT_DETAILS_RETENTION_MONTHS} bulan setelah laporan diputus; alasan dan hasil tetap disimpan.`],
        ["Jejak audit admin", `Dihapus setelah ${AUDIT_RETENTION_MONTHS} bulan.`],
        ["Riwayat pinjam selesai", `Dihapus ${LOAN_HISTORY_RETENTION_MONTHS} bulan setelah pinjaman ditolak, dibatalkan, dikembalikan, atau dinyatakan hilang. Pengajuan ke perpustakaan yang selesai mengikuti batas yang sama.`],
        ["Bukti verifikasi komunitas", `Dihapus ${AUDIT_RETENTION_MONTHS} bulan setelah ditinjau, termasuk berkasnya.`],
        ["Ekspor data", "Pengguna dapat mengunduh salinan JSON datanya dari Profil atau Kendali Data Saya."],
        ["Backup", "Mengikuti kebijakan bawaan Supabase; data yang sudah dihapus bisa tetap ada di backup sampai backup itu kedaluwarsa."],
    ];
    return (
        <SettingsSection id="retention" title="Retensi & Data" purpose="Berapa lama data disimpan, kapan dihapus, dan tugas yang menjalankannya." source={{ kind: "policy", decision: "DEC-11" }}>
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
            <RuleList rules={rules} />
            <SectionFooter>
                <RunRetentionButton />
                <p className="text-xs text-muted-foreground">Belum terjadwal otomatis: penjadwal harian dapat memanggil POST /api/internal/retention dengan INTERNAL_API_SECRET setelah hosting diputuskan (DEC-01).</p>
            </SectionFooter>
        </SettingsSection>
    );
}
