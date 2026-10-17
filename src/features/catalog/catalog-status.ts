/** Days after which stored provider data is labelled stale (Figma Pengaturan default "30 hari"). */
export const CATALOG_STALE_DAYS = 30;

export const catalogRecordStatuses = ["FRESH", "STALE", "FAILED", "DUPLICATE"] as const;
export type CatalogRecordStatus = (typeof catalogRecordStatuses)[number];

/**
 * One label per stored record, most actionable first: a failed latest sync, then a likely
 * duplicate, then age. Age counts from the last successful sync, or from creation when never synced.
 */
export function catalogRecordStatus(record: {
    createdAt: Date;
    syncedAt: Date | null;
    lastSyncFailed: boolean;
    duplicateCount: number;
}, now = new Date()): CatalogRecordStatus {
    if (record.lastSyncFailed) return "FAILED";
    if (record.duplicateCount > 0) return "DUPLICATE";
    const freshSince = record.syncedAt ?? record.createdAt;
    const ageDays = (now.getTime() - freshSince.getTime()) / 86_400_000;
    return ageDays > CATALOG_STALE_DAYS ? "STALE" : "FRESH";
}

export type ListingAdminStatus = "AVAILABLE" | "RESERVED" | "UNAVAILABLE" | "HIDDEN";

/** Admin view of a listing: an admin hide outranks the owner's own availability switch. */
export function listingAdminStatus(listing: { availability: string; hiddenAt: Date | null }): ListingAdminStatus {
    if (listing.hiddenAt) return "HIDDEN";
    if (listing.availability === "RESERVED") return "RESERVED";
    if (listing.availability === "UNAVAILABLE") return "UNAVAILABLE";
    return "AVAILABLE";
}
