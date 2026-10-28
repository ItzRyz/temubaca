/**
 * Library holdings and access requests (TB-023, DEC-13, owner's decision 28 Okt 2026). No server-only imports.
 *
 * - A holding says "this library holds this book" and comes from the library's manager or from admin
 *   curation of the library's official catalog, in that order of trust. No open source broadcasts copy
 *   status, so only a manager may say a copy is available or on loan, and that claim goes stale after 24 hours.
 * - A reader asks a library that opted in; its manager approves (with a pick-up deadline), rejects with a
 *   reason, or marks the book collected. The reader may cancel until collection. Past the deadline an
 *   approved request reads as expired; that state is never stored.
 */

export const accessStatuses = ["PENDING", "APPROVED", "REJECTED", "CANCELLED", "COLLECTED"] as const;
export type AccessStatus = (typeof accessStatuses)[number];
export type AccessState = AccessStatus | "EXPIRED";
export type AccessRole = "requester" | "manager";
export type AccessAction = "approve" | "reject" | "collected" | "cancel";

export const ACCESS_MESSAGE_MAX = 300;
export const ACCESS_NOTE_MAX = 300;

export const accessStateLabels: Record<AccessState, string> = {
    PENDING: "Menunggu jawaban perpustakaan",
    APPROVED: "Siap diambil",
    REJECTED: "Ditolak",
    CANCELLED: "Dibatalkan",
    COLLECTED: "Sudah diambil",
    EXPIRED: "Lewat batas ambil",
};

export function accessState(request: { status: string; expiresAt: Date | null }, now = new Date()): AccessState {
    if (request.status === "APPROVED" && request.expiresAt && request.expiresAt.getTime() < now.getTime()) return "EXPIRED";
    return request.status as AccessStatus;
}

/** Why `role` may not take `action` now, or null when it is allowed. */
export function accessActionBlocker(request: { status: string; expiresAt: Date | null }, role: AccessRole, action: AccessAction, now = new Date()): string | null {
    const state = accessState(request, now);
    switch (action) {
        case "approve":
        case "reject":
            if (role !== "manager") return "Hanya pengelola perpustakaan yang dapat menanggapi pengajuan.";
            return state === "PENDING" ? null : "Pengajuan ini sudah ditanggapi.";
        case "collected":
            if (role !== "manager") return "Hanya pengelola perpustakaan yang dapat menandai buku sudah diambil.";
            // A reader who comes a little late may still be served; the library decides.
            return state === "APPROVED" || state === "EXPIRED" ? null : "Hanya pengajuan yang diterima yang dapat ditandai diambil.";
        case "cancel":
            if (role !== "requester") return "Hanya pembaca yang dapat membatalkan pengajuannya.";
            return state === "PENDING" || state === "APPROVED" ? null : "Pengajuan ini tidak dapat dibatalkan lagi.";
    }
}

export function pickupDeadline(approvedAt: Date, pickupDays: number) {
    return new Date(approvedAt.getTime() + pickupDays * 24 * 60 * 60 * 1000);
}

export const holdingSources = ["CURATED", "MANAGER"] as const;
export type HoldingSource = (typeof holdingSources)[number];
export const holdingStatuses = ["LISTED", "AVAILABLE", "ON_LOAN", "UNKNOWN"] as const;
export type HoldingStatus = (typeof holdingStatuses)[number];

export const holdingSourceLabels: Record<HoldingSource, string> = {
    MANAGER: "Pengelola perpustakaan",
    CURATED: "Katalog resmi, dicatat admin TemuBaca",
};

/** Higher wins when one library has the same book from several sources. */
const SOURCE_PRIORITY: Record<HoldingSource, number> = { MANAGER: 2, CURATED: 1 };
/** "Tercatat di koleksi" is re-checked after 30 days; a copy status is trusted for 24 hours. */
export const LISTED_FRESH_DAYS = 30;
export const COPY_STATUS_FRESH_HOURS = 24;

export type HoldingLabel = { tone: "available" | "on_loan" | "listed" | "unknown"; text: string; stale: boolean };

export function holdingLabel(holding: { status: string; copiesTotal?: number | null; copiesAvailable: number | null; checkedAt: Date }, now = new Date()): HoldingLabel {
    const ageHours = (now.getTime() - holding.checkedAt.getTime()) / (60 * 60 * 1000);
    if (holding.status === "AVAILABLE" || holding.status === "ON_LOAN") {
        if (ageHours > COPY_STATUS_FRESH_HOURS) return { tone: "unknown", text: "Status eksemplar belum diperbarui", stale: true };
        if (holding.status === "ON_LOAN") return { tone: "on_loan", text: "Sedang dipinjam", stale: false };
        return { tone: "available", text: holding.copiesAvailable ? `Tersedia ${holding.copiesAvailable} eksemplar` : "Tersedia", stale: false };
    }
    if (holding.status === "LISTED") {
        // Counts copied from a library catalog are shown as the catalog's, next to when they were checked.
        const counts = holding.copiesTotal ? ` · ${holding.copiesAvailable ?? 0} dari ${holding.copiesTotal} eksemplar tidak sedang dipinjam, menurut katalog` : "";
        return { tone: "listed", text: `Tercatat di koleksi${counts}`, stale: ageHours > LISTED_FRESH_DAYS * 24 };
    }
    return { tone: "unknown", text: "Status tidak diketahui", stale: false };
}

/** One row per library: the most trusted source's status, and the latest check across all sources. */
export function mergeHoldings<T extends { libraryId: string; source: string; checkedAt: Date; sourceUrl: string | null }>(holdings: T[]): (T & { sources: HoldingSource[] })[] {
    const byLibrary = new Map<string, T[]>();
    for (const holding of holdings) byLibrary.set(holding.libraryId, [...(byLibrary.get(holding.libraryId) ?? []), holding]);
    return [...byLibrary.values()].map((rows) => {
        const best = [...rows].sort((a, b) =>
            SOURCE_PRIORITY[b.source as HoldingSource] - SOURCE_PRIORITY[a.source as HoldingSource] || b.checkedAt.getTime() - a.checkedAt.getTime())[0];
        const latest = Math.max(...rows.map((row) => row.checkedAt.getTime()));
        return {
            ...best,
            checkedAt: new Date(latest),
            sourceUrl: best.sourceUrl ?? rows.find((row) => row.sourceUrl)?.sourceUrl ?? null,
            sources: [...new Set(rows.map((row) => row.source as HoldingSource))],
        };
    });
}
