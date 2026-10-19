/**
 * Community management rules agreed in DEC-04 / DEC-05 (18 Okt 2026):
 * - any signed-in account may apply for a community; it stays PENDING until an admin approves it,
 *   and one account may have at most three applications waiting;
 * - the owner edits the profile and contacts, invites managers (one-time link, 7 days), and asks
 *   for re-verification; managers handle events and merchandise;
 * - evidence is a required link plus an optional note or file (PDF/JPG/PNG, up to 5 MB);
 * - a VERIFIED community publishes events, merchandise, and profile edits without prior review;
 *   reports and admin suspension remain the safety net. Re-verification never lowers the status.
 */

export type CommunityRole = "owner" | "manager";
export type CommunityStatus = "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED";

export const MAX_PENDING_APPLICATIONS = 3;
export const INVITE_TTL_DAYS = 7;
export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
export const EVIDENCE_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

export function communityCapabilities(role: CommunityRole | null, status: CommunityStatus) {
    const owner = role === "owner";
    const verified = status === "VERIFIED";
    return {
        view: role !== null,
        editProfile: owner && status !== "SUSPENDED",
        manageTeam: owner && verified,
        submitVerification: owner && (verified || status === "REJECTED"),
        manageContent: role !== null && verified,
    };
}

/** Why a new verification request cannot be sent now, or null. */
export function submissionBlocker(status: CommunityStatus, hasPendingSubmission: boolean) {
    if (status === "SUSPENDED") return "Komunitas yang ditangguhkan tidak dapat mengajukan verifikasi.";
    if (status === "PENDING") return "Pengajuan komunitas ini masih ditinjau.";
    if (hasPendingSubmission) return "Masih ada pengajuan pembaruan yang menunggu ditinjau.";
    return null;
}

export function evidenceFileError(file: { size: number; type: string }) {
    if (!(EVIDENCE_TYPES as readonly string[]).includes(file.type)) return "Berkas harus PDF, JPG, atau PNG.";
    if (file.size > EVIDENCE_MAX_BYTES) return "Ukuran berkas maksimal 5 MB.";
    if (file.size === 0) return "Berkas kosong.";
    return null;
}

/** "@klub", "instagram.com/klub/", or "klub" → "klub". */
export function normalizeInstagram(value: string | null | undefined) {
    const raw = value?.trim();
    if (!raw) return null;
    const handle = raw.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
    return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? handle : undefined;
}

/** Indonesian numbers in any common notation → "+62…"; undefined when it is not a phone number. */
export function normalizeWhatsapp(value: string | null | undefined) {
    const digits = value?.replace(/[\s().-]/g, "");
    if (!digits) return null;
    const local = digits.replace(/^\+?62/, "").replace(/^0/, "");
    return /^8\d{7,12}$/.test(local) ? `+62${local}` : undefined;
}

/** "+6281298421102" → "0812-••••-1102" for listings that should not show the full number. */
export function maskWhatsapp(value: string) {
    const local = `0${value.replace(/^\+62/, "")}`;
    return `${local.slice(0, 4)}-••••-${local.slice(-4)}`;
}

export type EventDisplayStatus = "DRAFT" | "PUBLISHED" | "DONE" | "ARCHIVED";

export function eventDisplayStatus(event: { publicationStatus: string; startsAt: Date | null; endsAt: Date | null }, now = new Date()): EventDisplayStatus {
    if (event.publicationStatus === "ARCHIVED") return "ARCHIVED";
    if (event.publicationStatus === "DRAFT") return "DRAFT";
    const end = event.endsAt ?? event.startsAt;
    return end && end.getTime() < now.getTime() ? "DONE" : "PUBLISHED";
}

/** What a draft still lacks before it can be published. */
export function eventMissingFields(event: { startsAt: Date | null; endsAt: Date | null; locationType: string; venueName: string | null; publicLocation: string | null; eventUrl: string | null }) {
    const missing: ("schedule" | "location")[] = [];
    if (!event.startsAt || !event.endsAt) missing.push("schedule");
    if (event.locationType === "ONLINE" ? !event.eventUrl : !event.venueName || !event.publicLocation) missing.push("location");
    return missing;
}

/** Date + "HH:MM" entered in WIB → an absolute instant. */
export function wibDateTime(date: string, time: string) {
    return new Date(`${date}T${time}:00+07:00`);
}

/** DEC-12: up to three product photos per item, public once saved. */
export const MERCH_PHOTO_LIMIT = 3;
export const MERCH_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const MERCH_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MERCH_VARIANT_LIMIT = 10;

export function merchPhotoError(file: { size: number; type: string }) {
    if (!(MERCH_PHOTO_TYPES as readonly string[]).includes(file.type)) return "Foto harus JPG, PNG, atau WebP.";
    if (file.size > MERCH_PHOTO_MAX_BYTES) return "Ukuran foto maksimal 2 MB.";
    if (file.size === 0) return "Berkas kosong.";
    return null;
}

/** "S, M, L" or one per line → ["S", "M", "L"], trimmed, without blanks or repeats. */
export function parseVariants(value: string) {
    return [...new Set(value.split(/[,\n]/).map((part) => part.trim()).filter(Boolean))];
}

export const merchandiseCategories =["Tote Bag", "Aksesori Koleksi", "Rilisan Cetak", "Pakaian", "Lainnya"] as const;
