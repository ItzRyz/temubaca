import { loanDayOptions } from "@/features/book-listings/listing-draft";

/**
 * Loan lifecycle agreed in DEC-02 (18 Okt 2026):
 * - the reader asks; the owner accepts or rejects with a reason;
 * - accepting reserves the copy and rejects the other waiting requests;
 * - the reader may cancel while waiting; either side may cancel after acceptance, before handover;
 * - handover and return each need a confirmation from both sides;
 * - the due date counts from handover; overdue loans get reminders, never fines;
 * - damage, loss, or a missing return becomes a dispute that an admin settles.
 */

export type LoanRole = "owner" | "requester";

export type LoanState =
    | "PENDING"
    | "AWAITING_HANDOVER"
    | "ACTIVE"
    | "OVERDUE"
    | "DISPUTED"
    | "RETURNED"
    | "LOST"
    | "REJECTED"
    | "CANCELLED";

export type LoanAction = "approve" | "reject" | "cancel" | "confirm_handover" | "confirm_return" | "remind" | "report_problem";

export type LoanSnapshot = {
    requestStatus: string;
    borrowingStatus: string | null;
    dueAt: Date | null;
    ownerHandoverAt: Date | null;
    requesterHandoverAt: Date | null;
    ownerReturnAt: Date | null;
    requesterReturnAt: Date | null;
    lastReminderAt: Date | null;
};

export const REMINDER_COOLDOWN_HOURS = 24;
export const DEFAULT_LOAN_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export const rejectionReasons = [
    "Buku sedang tidak tersedia",
    "Buku sedang dalam perawatan atau perbaikan",
    "Jadwal atau titik temu tidak cocok",
    "Saya belum bisa meminjamkan saat ini",
    "Lainnya",
] as const;

/** Used when accepting one request closes the others on the same copy. */
export const AUTO_REJECTION_REASON = rejectionReasons[0];

export const problemReasons = [
    { value: "Buku rusak", description: "Buku kembali dalam kondisi lebih buruk dari saat diserahkan." },
    { value: "Buku hilang", description: "Buku tidak dapat ditemukan atau dinyatakan hilang." },
    { value: "Buku tidak dikembalikan", description: "Tenggat sudah lewat dan buku belum diserahkan kembali." },
    { value: "Lainnya", description: "Masalah lain yang perlu ditinjau pengelola." },
] as const;

export function loanState(loan: LoanSnapshot, now = new Date()): LoanState {
    switch (loan.requestStatus) {
        case "PENDING": return "PENDING";
        case "APPROVED": return "AWAITING_HANDOVER";
        case "REJECTED": return "REJECTED";
        case "CANCELLED": return "CANCELLED";
    }
    switch (loan.borrowingStatus) {
        case "RETURNED": return "RETURNED";
        case "LOST": return "LOST";
        case "CANCELLED": return "CANCELLED";
        case "DISPUTED": return "DISPUTED";
    }
    return loan.dueAt && loan.dueAt.getTime() < now.getTime() ? "OVERDUE" : "ACTIVE";
}

/** Whole days past the due date, 0 when not yet due. */
export function overdueDays(dueAt: Date | null, now = new Date()) {
    if (!dueAt) return 0;
    return Math.max(0, Math.floor((now.getTime() - dueAt.getTime()) / DAY_MS));
}

export function dueDateFrom(handedOverAt: Date, loanDays: number) {
    return new Date(handedOverAt.getTime() + loanDays * DAY_MS);
}

/** Returns why `role` may not take `action` now, or null when it is allowed. */
export function actionBlocker(loan: LoanSnapshot, role: LoanRole, action: LoanAction, now = new Date()): string | null {
    const state = loanState(loan, now);
    const ownSide = role === "owner";
    switch (action) {
        case "approve":
        case "reject":
            if (!ownSide) return "Hanya pemilik buku yang dapat menanggapi permintaan.";
            return state === "PENDING" ? null : "Permintaan ini sudah ditanggapi.";
        case "cancel":
            if (state === "PENDING") return ownSide ? "Pemilik menolak permintaan, bukan membatalkannya." : null;
            return state === "AWAITING_HANDOVER" ? null : "Pinjaman yang sudah diserahkan tidak dapat dibatalkan.";
        case "confirm_handover":
            if (state !== "AWAITING_HANDOVER") return "Serah terima hanya untuk permintaan yang sudah diterima.";
            return (ownSide ? loan.ownerHandoverAt : loan.requesterHandoverAt) ? "Anda sudah mengonfirmasi serah terima." : null;
        case "confirm_return":
            if (state !== "ACTIVE" && state !== "OVERDUE") return "Pengembalian hanya untuk buku yang sedang dipinjam.";
            return (ownSide ? loan.ownerReturnAt : loan.requesterReturnAt) ? "Anda sudah mengonfirmasi pengembalian." : null;
        case "remind": {
            if (!ownSide) return "Hanya pemilik buku yang dapat mengirim pengingat.";
            if (state !== "OVERDUE") return "Pengingat hanya untuk pinjaman yang terlambat.";
            const last = loan.lastReminderAt?.getTime();
            return last && now.getTime() - last < REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000
                ? "Pengingat sudah dikirim dalam 24 jam terakhir."
                : null;
        }
        case "report_problem":
            return state === "ACTIVE" || state === "OVERDUE" ? null : "Masalah hanya dapat dilaporkan untuk buku yang sedang dipinjam.";
    }
}

const allActions: LoanAction[] = ["approve", "reject", "cancel", "confirm_handover", "confirm_return", "remind", "report_problem"];

export function allowedActions(loan: LoanSnapshot, role: LoanRole, now = new Date()) {
    return allActions.filter((action) => actionBlocker(loan, role, action, now) === null);
}

/** Listings keep the period as free text ("Lama pinjam: 14 hari."), written by the Tambah Buku dialog. */
export function maxLoanDaysFromRules(rules: string | null | undefined) {
    const match = rules?.match(/Lama pinjam:\s*(\d{1,2})\s*hari/i);
    const days = match ? Number(match[1]) : DEFAULT_LOAN_DAYS;
    return days >= 1 && days <= 60 ? days : DEFAULT_LOAN_DAYS;
}

/** The standard periods up to the owner's maximum; an unusual maximum is offered as-is. */
export function loanDayChoices(maxDays: number) {
    const choices: number[] = loanDayOptions.filter((days) => days <= maxDays);
    if (!choices.includes(maxDays)) choices.push(maxDays);
    return choices;
}

/** Meeting points are stored joined with " & " in `publicLocation`. */
export function meetingPointsOf(publicLocation: string | null | undefined) {
    return (publicLocation ?? "").split(" & ").map((point) => point.trim()).filter(Boolean);
}
