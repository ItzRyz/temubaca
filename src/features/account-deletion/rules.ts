/**
 * Account deletion and data retention agreed in DEC-11 (18 Okt 2026):
 * - "Hapus Akun Saya" deactivates the account at once (read-only, listings hidden) and schedules
 *   deletion after 14 days; signing in during that time lets the person cancel;
 * - deletion waits while the person is part of an accepted, ongoing, or disputed loan, or owns a
 *   verified community (hand it to a manager or ask an admin to suspend it first);
 * - personal data is removed; records other people rely on (loan history, reports, audit trails)
 *   stay with the name replaced by "Akun dihapus";
 * - details of decided reports are erased after 12 months; admin audit entries, finished loan
 *   history, and reviewed community evidence after 24 months;
 * - backups follow the hosting provider's default policy (documented in SECURITY.md).
 */

export const DELETION_GRACE_DAYS = 14;
export const REPORT_DETAILS_RETENTION_MONTHS = 12;
export const AUDIT_RETENTION_MONTHS = 24;
export const LOAN_HISTORY_RETENTION_MONTHS = 24;
export const CONFIRM_WORD = "HAPUS";
export const DELETED_ACCOUNT_NAME = "Akun dihapus";
export const OWNER_CLOSED_REASON = "Pemilik menutup akunnya";

const DAY_MS = 24 * 60 * 60 * 1000;

/** `graceDays` comes from Pengaturan → Retensi & Data (30 Okt 2026); 14 days before it was configurable. */
export function deletionDate(requestedAt: Date, graceDays = DELETION_GRACE_DAYS) {
    return new Date(requestedAt.getTime() + graceDays * DAY_MS);
}

export function monthsBefore(now: Date, months: number) {
    const date = new Date(now);
    date.setUTCMonth(date.getUTCMonth() - months);
    return date;
}

export type DeletionBlockers = { activeLoans: number; verifiedCommunities: string[] };

/** Plain-language reasons the account cannot be scheduled for deletion yet. */
export function deletionBlockerMessages(blockers: DeletionBlockers) {
    const messages: string[] = [];
    if (blockers.activeLoans > 0) {
        messages.push(`Selesaikan ${blockers.activeLoans} pinjaman yang sudah diterima, sedang berjalan, atau dalam sengketa.`);
    }
    if (blockers.verifiedCommunities.length > 0) {
        messages.push(`Serahkan kepemilikan ${blockers.verifiedCommunities.join(", ")} ke pengurus lain, atau minta admin menangguhkannya.`);
    }
    return messages;
}
