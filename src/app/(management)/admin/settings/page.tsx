import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { loanDayOptions } from "@/features/book-listings/listing-draft";
import { EXTENSION_MAX_DAYS, problemReasons, rejectionReasons, REMINDER_COOLDOWN_HOURS } from "@/features/borrowing/lifecycle";
import { EVIDENCE_MAX_BYTES, MAX_PENDING_APPLICATIONS } from "@/features/community-management/rules";
import { CatalogSettingsForm } from "@/features/settings/components/catalog-settings-form";
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

/** Sections from Figma 161:859. Only "Katalog Buku" has settings the app actually uses today; the other sections show their fixed policy. */
const sections = {
    catalog: { label: "Katalog Buku", Content: CatalogSection },
    map: { label: "Peta & Lokasi", Content: MapSection },
    moderation: { label: "Moderasi & Publikasi", Content: ModerationSection },
    borrowing: { label: "Aturan Pinjam", Content: BorrowingSection },
    retention: { label: "Retensi & Data", Content: RetentionSection },
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
            <header>
                <h1 className="font-heading text-[28px] leading-tight font-semibold text-primary sm:text-[34px]">Pengaturan</h1>
                <p className="mt-2 max-w-2xl text-base text-muted-foreground">Atur sumber data, aturan platform, dan kebijakan moderasi. Setiap perubahan tercatat di jejak audit.</p>
            </header>

            <div className="mt-6 grid gap-6 lg:grid-cols-[232px_1fr]">
                <nav aria-label="Bagian pengaturan" className="h-fit min-w-0 rounded-xl border border-border bg-card p-3">
                    <ul className="flex list-none gap-1 overflow-x-auto p-0 [scrollbar-width:none] lg:flex-col">
                        {(Object.keys(sections) as Section[]).map((key) => (
                            <li key={key} className="shrink-0">
                                <Link href={key === "catalog" ? "/admin/settings" : `/admin/settings?section=${key}`} aria-current={section === key ? "page" : undefined}
                                    className={cn("flex h-10 items-center rounded-lg px-3 text-sm", section === key ? "bg-[#e7efe8] font-semibold text-primary" : "text-foreground hover:bg-muted")}>
                                    {sections[key].label}
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
        <>
            <p className="mb-4 flex gap-2 rounded-lg bg-[#f1f0ea] px-4 py-3 text-sm text-muted-foreground">
                <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                Perubahan berlaku untuk seluruh pengguna setelah disimpan.
                {updatedAt ? ` Terakhir diubah oleh ${updatedByName ?? "admin"} • ${dateTime.format(updatedAt)}.` : " Saat ini memakai pengaturan bawaan."}
            </p>
            <CatalogSettingsForm key={updatedAt?.toISOString() ?? "default"} initial={settings} />
        </>
    );
}

/** DEC-07 policy (fixed in code and env) plus what is on the Peta Literasi right now. */
async function MapSection() {
    const places = await listPlacesForAdmin();
    const tileHost = MAP_TILE_URL.match(/^https?:\/\/([^/]+)/)?.[1] ?? MAP_TILE_URL;
    const routing = isMlServiceConfigured();
    const rules = [
        ["Peta", `Leaflet dengan tile ${tileHost}${tileHost === "tile.openstreetmap.org" ? ", beratribusi “© kontributor OpenStreetMap”. Kebijakan tile OSM hanya untuk trafik rendah; bila trafik naik, ganti provider lewat NEXT_PUBLIC_MAP_TILE_URL" : " (NEXT_PUBLIC_MAP_TILE_URL)"}. Daftar tempat tetap berfungsi tanpa peta.`],
        ["Pencarian alamat", "Tanpa geocoding. Pembaca menyaring jenis, provinsi atau kab/kota, dan nama tempat; titik dipasang dengan mengeklik peta atau mengisi koordinat."],
        ["Lokasi pembaca", "Opsional. “Gunakan lokasiku” hanya dipakai di peramban untuk memusatkan peta dan mengurutkan jarak; tidak dikirim ke server dan tidak disimpan."],
        ["Rute", `${ROUTE_MODES.map((mode) => routeModeLabels[mode]).join(" dan ")} lewat ML Service, untuk DKI Jakarta daratan, Kota/Kab. Tangerang, dan Tangerang Selatan. Titik asal dikirim hanya saat pembaca menekan Rute, dipakai sekali, tidak disimpan dan tidak dicatat di log. Di luar cakupan, pembaca diarahkan ke Google Maps.`],
        ["Titik di peta", "Perpustakaan dan titik temu publik dikurasi admin. Titik komunitas tampil selama komunitas terverifikasi; titik acara selama acara terbit, tatap muka, dan belum selesai. Listing buku warga tidak pernah tampil di peta."],
        ["Wilayah", "Koordinat dibatasi ke kotak wilayah Indonesia, enam desimal."],
    ];
    return (
        <section aria-labelledby="map-title" className="rounded-xl border border-border bg-card p-6">
            <h2 id="map-title" className="font-heading text-xl font-semibold">Peta &amp; Lokasi</h2>
            <p className="mt-1 text-sm text-muted-foreground">Kebijakan DEC-07 (23 dan 25 Okt 2026). Ditetapkan di kode dan environment, tidak dapat diubah dari sini.</p>
            <dl className="mt-4 divide-y divide-border rounded-lg border border-border text-sm">
                {rules.map(([term, detail]) => (
                    <div key={term} className="grid gap-1 px-4 py-3 sm:grid-cols-[200px_1fr]">
                        <dt className="font-medium">{term}</dt>
                        <dd className="text-muted-foreground">{detail}</dd>
                    </div>
                ))}
            </dl>
            <div className="mt-6 flex flex-col gap-3">
                <h3 className="font-heading text-base font-semibold">Status saat ini</h3>
                <p className="text-sm text-muted-foreground">
                    Layanan rute: {routing ? "terhubung ke ML Service" : "ML Service belum dikonfigurasi (RECOMMENDATION_API_URL); tombol Rute menampilkan tautan Google Maps"}.
                </p>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50 text-xs text-muted-foreground">
                            <tr><th scope="col" className="px-4 py-2 font-medium">Jenis</th><th scope="col" className="px-4 py-2 text-right font-medium">Total</th><th scope="col" className="px-4 py-2 text-right font-medium">Tampil di peta</th><th scope="col" className="px-4 py-2 text-right font-medium">Disembunyikan</th></tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {PLACE_TYPES.map((type) => {
                                const ofType = places.filter((place) => place.type === type);
                                return (
                                    <tr key={type}>
                                        <th scope="row" className="px-4 py-2 font-medium">{placeTypeLabels[type]}</th>
                                        <td className="px-4 py-2 text-right tabular-nums">{ofType.length}</td>
                                        <td className="px-4 py-2 text-right tabular-nums">{ofType.filter((place) => place.onMap).length}</td>
                                        <td className="px-4 py-2 text-right tabular-nums">{ofType.filter((place) => place.hiddenAt).length}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <Link href="/admin/places" className="flex min-h-10 w-fit items-center rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted">Kelola di Data Tempat</Link>
            </div>
        </section>
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
    const rules = [
        ["Tanpa tinjauan lebih dulu", "Listing buku warga, serta acara, merchandise, dan perubahan profil komunitas terverifikasi langsung tampil. Pengawasan lewat laporan pengguna."],
        ["Pengajuan komunitas", `Menunggu persetujuan admin di Peninjauan. Bukti aktivitas berupa tautan wajib, berkas opsional (PDF/JPG/PNG, maks. ${EVIDENCE_MAX_BYTES / 1024 / 1024} MB). Satu akun maksimal ${MAX_PENDING_APPLICATIONS} pengajuan yang menunggu. Pembaruan verifikasi tidak menurunkan status.`],
        ["Laporan", `Akun yang masuk dapat melaporkan buku, salinan, komunitas, acara, merchandise, atau akun lain dengan alasan tetap per jenis, maksimal ${RATE_LIMITS.REPORT.limit} laporan per ${RATE_LIMITS.REPORT.windowSeconds} detik. Detail laporan dihapus ${REPORT_DETAILS_RETENTION_MONTHS} bulan setelah diputus.`],
        ["Tindakan admin", "Menyembunyikan listing atau titik peta, menangguhkan komunitas atau akun, selalu dengan alasan. Akun yang ditangguhkan tetap dapat masuk dan membaca, tetapi tidak dapat menulis, dan listingnya tidak tampil."],
        ["Banding", "Pemilik listing yang disembunyikan dapat mengajukan satu banding yang ditinjau sekaligus. Banding yang diterima memulihkan listing."],
        ["Jejak", "Keputusan atas komunitas, listing, dan banding tercatat di riwayat verifikasi; penangguhan akun, penyembunyian titik peta, ubah peran, dan ubah pengaturan tercatat di jejak audit. Semua keputusan dilakukan manual oleh admin, tanpa filter otomatis."],
    ];
    const queues = [
        ["Laporan menunggu", pendingReports],
        ["Laporan sedang ditinjau", reviewingReports],
        ["Pengajuan komunitas", pendingCommunities],
        ["Banding listing", pendingAppeals],
        ["Listing disembunyikan", hiddenListings],
        ["Akun ditangguhkan", users.suspended],
    ] as const;
    return (
        <section aria-labelledby="moderation-title" className="rounded-xl border border-border bg-card p-6">
            <h2 id="moderation-title" className="font-heading text-xl font-semibold">Moderasi &amp; Publikasi</h2>
            <p className="mt-1 text-sm text-muted-foreground">Kebijakan DEC-04/DEC-05 (18 Okt 2026). Ditetapkan di kode dan tidak dapat diubah dari sini.</p>
            <dl className="mt-4 divide-y divide-border rounded-lg border border-border text-sm">
                {rules.map(([term, detail]) => (
                    <div key={term} className="grid gap-1 px-4 py-3 sm:grid-cols-[200px_1fr]">
                        <dt className="font-medium">{term}</dt>
                        <dd className="text-muted-foreground">{detail}</dd>
                    </div>
                ))}
            </dl>
            <div className="mt-6 flex flex-col gap-3">
                <h3 className="font-heading text-base font-semibold">Antrean saat ini</h3>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {queues.map(([label, total]) => (
                        <div key={label} className="rounded-lg border border-border px-4 py-3">
                            <dt className="text-xs text-muted-foreground">{label}</dt>
                            <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums">{total}</dd>
                        </div>
                    ))}
                </dl>
                <Link href="/moderation/reports" className="flex min-h-10 w-fit items-center rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted">Buka Peninjauan</Link>
            </div>
        </section>
    );
}

/** DEC-02 loan lifecycle (fixed in code) plus the loans open right now. */
async function BorrowingSection() {
    const open = await countOpenLoans();
    const rules = [
        ["Lama pinjam", `${loanDayOptions.join("/")} hari, maksimal sesuai batas yang ditetapkan pemilik di listing. Tenggat dihitung dari serah terima.`],
        ["Permintaan", `Peminjam memilih titik temu dari daftar pemilik (tempat umum atau titik di Peta Literasi), waktu bertemu opsional, dan pesan. Pemilik menerima, atau menolak dengan alasan tetap (${rejectionReasons.join(", ")}). Menerima satu permintaan memesan salinan dan menolak otomatis permintaan lain yang menunggu.`],
        ["Pembatalan", "Peminjam dapat membatalkan selama permintaan belum ditanggapi. Setelah diterima, kedua pihak dapat membatalkan sebelum serah terima."],
        ["Serah terima & pengembalian", "Masing-masing butuh konfirmasi kedua pihak. Pinjaman baru berjalan, atau selesai, setelah dua konfirmasi."],
        ["Perpanjangan", `Satu kali, diajukan peminjam sebelum tenggat, paling lama ${EXTENSION_MAX_DAYS} hari dari tenggat lama. Pemilik menerima atau menolak.`],
        ["Keterlambatan", `Ditampilkan “Terlambat N hari”. Pemilik dapat mengirim pengingat di aplikasi, sekali per ${REMINDER_COOLDOWN_HOURS} jam. Tanpa denda dan tanpa ganti rugi uang di platform.`],
        ["Sengketa", `Salah satu pihak melaporkan masalah (${problemReasons.map((reason) => reason.value).join(", ")}). Pinjaman terkunci sampai admin memutuskan Dikembalikan atau Hilang; keputusan tercatat di riwayat pinjaman dan jejak audit.`],
    ];
    const status = [
        ["Menunggu tanggapan pemilik", open.pending],
        ["Menunggu serah terima", open.awaitingHandover],
        ["Sedang dipinjam", open.active],
        ["Terlambat", open.overdue],
        ["Perpanjangan menunggu jawaban", open.extensionPending],
        ["Sengketa terbuka", open.disputed],
    ] as const;
    return (
        <section aria-labelledby="borrowing-title" className="rounded-xl border border-border bg-card p-6">
            <h2 id="borrowing-title" className="font-heading text-xl font-semibold">Aturan Pinjam</h2>
            <p className="mt-1 text-sm text-muted-foreground">Kebijakan DEC-02 (18 Okt 2026). Ditetapkan di kode dan tidak dapat diubah dari sini.</p>
            <dl className="mt-4 divide-y divide-border rounded-lg border border-border text-sm">
                {rules.map(([term, detail]) => (
                    <div key={term} className="grid gap-1 px-4 py-3 sm:grid-cols-[200px_1fr]">
                        <dt className="font-medium">{term}</dt>
                        <dd className="text-muted-foreground">{detail}</dd>
                    </div>
                ))}
            </dl>
            <div className="mt-6 flex flex-col gap-3">
                <h3 className="font-heading text-base font-semibold">Pinjaman berjalan saat ini</h3>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {status.map(([label, total]) => (
                        <div key={label} className="rounded-lg border border-border px-4 py-3">
                            <dt className="text-xs text-muted-foreground">{label}</dt>
                            <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums">{total}</dd>
                        </div>
                    ))}
                </dl>
                <Link href="/admin/loans" className="flex min-h-10 w-fit items-center rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted">Tinjau sengketa pinjam</Link>
            </div>
        </section>
    );
}

/** DEC-11 policy (fixed in code) plus the last run of the retention job. */
async function RetentionSection() {
    const [lastRun, pendingDeletions] = await Promise.all([getLastRetentionRun(), countPendingDeletions()]);
    const rules = [
        ["Hapus akun", `Akun dinonaktifkan ${DELETION_GRACE_DAYS} hari dan dapat dibatalkan pengguna, lalu data pribadi dihapus dan riwayat bersama dianonimkan ("Akun dihapus"). Ditolak selama ada pinjaman berjalan/sengketa atau komunitas terverifikasi milik akun.`],
        ["Detail laporan", `Dihapus ${REPORT_DETAILS_RETENTION_MONTHS} bulan setelah laporan diputus; alasan dan hasil tetap disimpan.`],
        ["Jejak audit admin", `Dihapus setelah ${AUDIT_RETENTION_MONTHS} bulan.`],
        ["Riwayat pinjam selesai", `Dihapus ${LOAN_HISTORY_RETENTION_MONTHS} bulan setelah pinjaman ditolak, dibatalkan, dikembalikan, atau dinyatakan hilang.`],
        ["Bukti verifikasi komunitas", `Dihapus ${AUDIT_RETENTION_MONTHS} bulan setelah ditinjau, termasuk berkasnya.`],
        ["Ekspor data", "Pengguna dapat mengunduh salinan JSON datanya dari Profil atau Kendali Data Saya."],
        ["Backup", "Mengikuti kebijakan bawaan Supabase; data yang sudah dihapus bisa tetap ada di backup sampai backup itu kedaluwarsa."],
    ];
    return (
        <section aria-labelledby="retention-title" className="rounded-xl border border-border bg-card p-6">
            <h2 id="retention-title" className="font-heading text-xl font-semibold">Retensi &amp; Data</h2>
            <p className="mt-1 text-sm text-muted-foreground">Kebijakan DEC-11 (18 Okt 2026). Batas waktu ditetapkan di kode dan tidak dapat diubah dari sini.</p>
            <dl className="mt-4 divide-y divide-border rounded-lg border border-border text-sm">
                {rules.map(([term, detail]) => (
                    <div key={term} className="grid gap-1 px-4 py-3 sm:grid-cols-[200px_1fr]">
                        <dt className="font-medium">{term}</dt>
                        <dd className="text-muted-foreground">{detail}</dd>
                    </div>
                ))}
            </dl>
            <div className="mt-6 flex flex-col gap-3">
                <h3 className="font-heading text-base font-semibold">Tugas retensi</h3>
                <p className="text-sm text-muted-foreground">
                    {pendingDeletions} akun menunggu penghapusan.{" "}
                    {lastRun
                        ? `Terakhir dijalankan ${dateTime.format(new Date(lastRun.ranAt))}: ${lastRun.accountsDeleted} akun dihapus${lastRun.accountsBlocked ? `, ${lastRun.accountsBlocked} tertahan` : ""}, ${lastRun.reportDetails} detail laporan, ${lastRun.auditEntries} catatan audit, ${lastRun.loans} riwayat pinjam, ${lastRun.evidence} bukti komunitas.`
                        : "Belum pernah dijalankan."}
                </p>
                <p className="flex gap-2 rounded-lg bg-[#f1f0ea] p-3 text-xs leading-5 text-muted-foreground">
                    <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    Penjadwal harian dapat memanggil POST /api/internal/retention dengan INTERNAL_API_SECRET setelah hosting diputuskan (DEC-01). Sampai saat itu jalankan manual di sini.
                </p>
                <RunRetentionButton />
            </div>
        </section>
    );
}
