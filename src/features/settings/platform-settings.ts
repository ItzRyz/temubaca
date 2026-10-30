import { z } from "zod";

import { catalogSettingsSchema, defaultCatalogSettings, staleDayOptions } from "./catalog-settings";

/**
 * Every admin setting (Figma "Pengaturan — TemuBaca", 30 Okt 2026). Each section is one jsonb row in
 * `app_settings`; defaults equal the behaviour before the setting existed, so saving untouched values
 * changes nothing. Shared by the server (validation, effects) and the admin form (labels, controls).
 */

const literals = <T extends number>(values: readonly T[]) =>
    z.union(values.map((value) => z.literal(value)) as unknown as [z.ZodLiteral<T>, z.ZodLiteral<T>, ...z.ZodLiteral<T>[]]);

export const tileProviders = ["OSM", "CARTO"] as const;
export const locationPrecisions = ["DISTRICT", "CITY", "PROVINCE"] as const;
export const defaultLoanDayOptions = [7, 14, 21, 30] as const;
export const maxExtensionOptions = [1, 2, 3] as const;
export const deletionGraceOptions = [7, 14, 30] as const;
export const reportRetentionOptions = [6, 12, 24] as const;
export const auditRetentionOptions = [12, 24, 36] as const;

export const mapSettingsSchema = z.object({
    tileProvider: z.enum(tileProviders),
    locationPrecision: z.enum(locationPrecisions),
    allowDeviceLocation: z.boolean(),
}).strict();

export const moderationSettingsSchema = z.object({
    reviewNewCommunities: z.boolean(),
    reviewNewEvents: z.boolean(),
    reviewNewMerchandise: z.boolean(),
    notifyReporters: z.boolean(),
    hideReporterIdentity: z.boolean(),
}).strict();

export const borrowingSettingsSchema = z.object({
    defaultLoanDays: literals(defaultLoanDayOptions),
    maxExtensions: literals(maxExtensionOptions),
    meetingPointsFromMapOnly: z.boolean(),
}).strict();

export const retentionSettingsSchema = z.object({
    deletionGraceDays: literals(deletionGraceOptions),
    reportRetentionMonths: literals(reportRetentionOptions),
    auditRetentionMonths: literals(auditRetentionOptions),
    allowDataExport: z.boolean(),
}).strict();

export const settingsSections = {
    catalog: { label: "Katalog Buku", schema: catalogSettingsSchema, defaults: defaultCatalogSettings },
    map: {
        label: "Peta & Lokasi",
        schema: mapSettingsSchema,
        defaults: { tileProvider: "OSM", locationPrecision: "CITY", allowDeviceLocation: true } as z.infer<typeof mapSettingsSchema>,
    },
    moderation: {
        label: "Moderasi & Publikasi",
        schema: moderationSettingsSchema,
        // DEC-04/05: communities are verified first; events and merchandise publish without prior review.
        defaults: { reviewNewCommunities: true, reviewNewEvents: false, reviewNewMerchandise: false, notifyReporters: true, hideReporterIdentity: true } as z.infer<typeof moderationSettingsSchema>,
    },
    borrowing: {
        label: "Aturan Pinjam",
        schema: borrowingSettingsSchema,
        // DEC-02: 14 days by default, one extension, meeting points typed or picked from the map.
        defaults: { defaultLoanDays: 14, maxExtensions: 1, meetingPointsFromMapOnly: false } as z.infer<typeof borrowingSettingsSchema>,
    },
    retention: {
        label: "Retensi & Data",
        schema: retentionSettingsSchema,
        // DEC-11 periods.
        defaults: { deletionGraceDays: 14, reportRetentionMonths: 12, auditRetentionMonths: 24, allowDataExport: true } as z.infer<typeof retentionSettingsSchema>,
    },
} as const;

export type SettingsSection = keyof typeof settingsSections;
export type SettingsOf<S extends SettingsSection> = z.infer<(typeof settingsSections)[S]["schema"]>;
export const settingsSectionKeys = Object.keys(settingsSections) as SettingsSection[];

export function isSettingsSection(value: string): value is SettingsSection {
    return value in settingsSections;
}

/** Stored JSON may predate a field or be hand-edited; unknown or invalid values fall back to the defaults. */
export function parseSettings<S extends SettingsSection>(section: S, value: unknown): SettingsOf<S> {
    const { schema, defaults } = settingsSections[section];
    const stored = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const merged: Record<string, unknown> = { ...defaults };
    // Field by field, so one bad value does not reset the whole section.
    for (const key of Object.keys(defaults)) {
        if (!(key in stored)) continue;
        const candidate = { ...merged, [key]: stored[key] };
        if (schema.safeParse(candidate).success) merged[key] = stored[key];
    }
    return schema.parse(merged) as SettingsOf<S>;
}

/** Field-level diff for the audit log. */
export function changedFields<T extends Record<string, unknown>>(before: T, after: T) {
    return Object.keys(after)
        .filter((key) => before[key] !== after[key])
        .map((key) => ({ key, from: before[key], to: after[key] }));
}

/** One row of the admin form. */
export type SettingField =
    | { key: string; label: string; description: string; kind: "switch" }
    | { key: string; label: string; description: string; kind: "select"; options: readonly { value: string | number; label: string }[] };

export const tileProviderLabels: Record<(typeof tileProviders)[number], string> = { OSM: "OpenStreetMap (Leaflet)", CARTO: "CARTO Voyager (Leaflet)" };
export const locationPrecisionLabels: Record<(typeof locationPrecisions)[number], string> = { DISTRICT: "Kecamatan", CITY: "Kab/Kota", PROVINCE: "Provinsi" };

/** Rows of each section's form, in the order of the design. */
export const settingFields: Record<SettingsSection, readonly SettingField[]> = {
    catalog: [
        { key: "primaryProvider", label: "Provider utama", description: "Dicoba lebih dulu saat mencocokkan dan melengkapi rekaman buku.", kind: "select", options: [{ value: "OPEN_LIBRARY", label: "Open Library" }, { value: "GOOGLE_BOOKS", label: "Google Books" }] },
        { key: "fallbackEnabled", label: "Provider cadangan", description: "Provider lain dipakai jika provider utama tidak punya data, gagal, atau membatasi permintaan.", kind: "switch" },
        { key: "staleAfterDays", label: "Tandai data usang setelah", description: "Admin melihat label usang pada rekaman yang belum disinkronkan ulang selama periode ini.", kind: "select", options: staleDayOptions.map((days) => ({ value: days, label: `${days} hari` })) },
        { key: "showAttribution", label: "Tampilkan atribusi provider", description: "Sumber data tampil pada detail buku sesuai ketentuan provider.", kind: "switch" },
    ],
    map: [
        { key: "tileProvider", label: "Penyedia peta", description: "Tile dan pencarian lokasi di Peta Literasi. Atribusi menyesuaikan penyedia.", kind: "select", options: tileProviders.map((value) => ({ value, label: tileProviderLabels[value] })) },
        { key: "locationPrecision", label: "Lokasi pengguna ditampilkan sebagai", description: "Titik presisi tidak pernah ditampilkan kepada pengguna lain; ini tingkat wilayah di profil peminjam.", kind: "select", options: locationPrecisions.map((value) => ({ value, label: locationPrecisionLabels[value] })) },
        { key: "allowDeviceLocation", label: "Izinkan lokasi perangkat", description: "Opsional bagi pengguna. Pencarian manual selalu tersedia.", kind: "switch" },
    ],
    moderation: [
        { key: "reviewNewCommunities", label: "Tinjau komunitas baru sebelum tayang", description: "Profil baru tampil setelah disetujui admin. Mati: komunitas baru langsung terverifikasi.", kind: "switch" },
        { key: "reviewNewEvents", label: "Tinjau acara baru sebelum tayang", description: "Acara yang diterbitkan menunggu persetujuan admin di Peninjauan.", kind: "switch" },
        { key: "reviewNewMerchandise", label: "Tinjau merchandise baru sebelum tayang", description: "Merchandise yang ditampilkan menunggu persetujuan admin di Peninjauan.", kind: "switch" },
        { key: "notifyReporters", label: "Kirim konfirmasi ke pelapor", description: "Pelapor mendapat tanda di menu dan melihat hasil keputusan di Laporan Saya.", kind: "switch" },
        { key: "hideReporterIdentity", label: "Sembunyikan identitas pelapor", description: "Nama pelapor tidak tampil di panel peninjauan admin. Pemilik konten tidak pernah melihat siapa yang melapor.", kind: "switch" },
    ],
    borrowing: [
        { key: "defaultLoanDays", label: "Lama pinjam bawaan", description: "Nilai awal saat pemilik menambahkan buku; pemilik dapat mengubahnya.", kind: "select", options: defaultLoanDayOptions.map((days) => ({ value: days, label: `${days} hari` })) },
        { key: "maxExtensions", label: "Perpanjangan maksimal", description: "Berapa kali peminjam dapat memperpanjang satu pinjaman.", kind: "select", options: maxExtensionOptions.map((count) => ({ value: count, label: `${count} kali` })) },
        { key: "meetingPointsFromMapOnly", label: "Titik temu hanya dari daftar aman", description: "Pemilik hanya dapat memilih titik dari Peta Literasi. Mati: pemilik dapat menulis tempat umum sendiri.", kind: "switch" },
    ],
    retention: [
        { key: "deletionGraceDays", label: "Masa tunggu penghapusan akun", description: "Pengguna dapat membatalkan permintaan selama masa tunggu.", kind: "select", options: deletionGraceOptions.map((days) => ({ value: days, label: `${days} hari` })) },
        { key: "reportRetentionMonths", label: "Simpan laporan moderasi selama", description: "Setelah diputus, detail laporan dihapus; alasan dan hasil tetap tersimpan.", kind: "select", options: reportRetentionOptions.map((months) => ({ value: months, label: `${months} bulan` })) },
        { key: "auditRetentionMonths", label: "Simpan jejak audit selama", description: "Catatan tindakan admin dan bukti verifikasi komunitas.", kind: "select", options: auditRetentionOptions.map((months) => ({ value: months, label: `${months} bulan` })) },
        { key: "allowDataExport", label: "Izinkan pengguna mengunduh datanya", description: "Ekspor data pribadi dari halaman Profil. UU PDP memberi hak akses data; matikan hanya dengan alasan kuat.", kind: "switch" },
    ],
};
