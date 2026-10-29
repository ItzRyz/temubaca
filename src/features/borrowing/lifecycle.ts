import { loanDayOptions } from "@/features/book-listings/listing-draft";

/**
 * Loan lifecycle agreed in DEC-02 (18 Okt 2026):
 * - the reader asks; the owner accepts or rejects with a reason;
 * - accepting reserves the copy and rejects the other waiting requests;
 * - the reader may cancel while waiting; either side may cancel after acceptance, before handover;
 * - handover and return each need a confirmation from both sides;
 * - the due date counts from handover; overdue loans get reminders, never fines;
 * - damage, loss, or a missing return becomes a dispute that an admin settles;
 * - the reader may ask once, before the due date, for up to 14 more days; the owner accepts or declines.
 *
 * Disputes (owner's decision, 28 Okt 2026): a target of 72 hours for the admin's decision; either party
 * may add details while it is open, and an admin question marks the asked party as needing action;
 * the decision may carry a consequence for one party. An owner may ask for a non-money guarantee.
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

export type LoanAction =
    | "approve" | "reject" | "cancel" | "confirm_handover" | "confirm_return" | "remind" | "report_problem"
    | "request_extension" | "approve_extension" | "reject_extension" | "add_dispute_info";

/** Toast after an action succeeds (29 Okt 2026). */
export const loanActionDone: Record<LoanAction, string> = {
    approve: "Permintaan pinjam disetujui.",
    reject: "Permintaan pinjam ditolak.",
    cancel: "Permintaan pinjam dibatalkan.",
    confirm_handover: "Serah terima buku dikonfirmasi.",
    confirm_return: "Pengembalian buku dikonfirmasi.",
    remind: "Pengingat dikirim.",
    report_problem: "Laporan masalah dikirim ke admin.",
    request_extension: "Permintaan perpanjangan dikirim.",
    approve_extension: "Perpanjangan disetujui.",
    reject_extension: "Perpanjangan ditolak.",
    add_dispute_info: "Keterangan tambahan dikirim ke admin.",
};

export type LoanSnapshot = {
    requestStatus: string;
    borrowingStatus: string | null;
    dueAt: Date | null;
    ownerHandoverAt: Date | null;
    requesterHandoverAt: Date | null;
    ownerReturnAt: Date | null;
    requesterReturnAt: Date | null;
    lastReminderAt: Date | null;
    /** null until the reader asks for an extension; one request per loan. */
    extensionStatus: string | null;
    /** Set while an admin waits for that party's answer in a dispute. */
    ownerReplyRequestedAt: Date | null;
    requesterReplyRequestedAt: Date | null;
};

export const REMINDER_COOLDOWN_HOURS = 24;
export const DEFAULT_LOAN_DAYS = 14;
export const EXTENSION_MAX_DAYS = 14;
export const extensionDayOptions = [7, 14] as const;
/** Target for an admin decision on a dispute, counted from the report. */
export const DISPUTE_REVIEW_HOURS = 72;
export const borrowBlockDayOptions = [30, 90, 180] as const;
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

export type DisputeConsequence = "NONE" | "WARNING" | "BORROW_BLOCK" | "SUSPENSION";

export const disputeConsequenceLabels: Record<DisputeConsequence, string> = {
    NONE: "Tanpa sanksi",
    WARNING: "Peringatan",
    BORROW_BLOCK: "Tidak dapat meminjam sementara",
    SUSPENSION: "Akun ditangguhkan",
};

export function disputeDeadline(disputedAt: Date) {
    return new Date(disputedAt.getTime() + DISPUTE_REVIEW_HOURS * 60 * 60 * 1000);
}

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
        case "request_extension":
            if (ownSide) return "Hanya peminjam yang dapat mengajukan perpanjangan.";
            if (state !== "ACTIVE") return "Perpanjangan hanya dapat diajukan sebelum tenggat.";
            if (loan.extensionStatus) return "Perpanjangan hanya dapat diajukan satu kali.";
            return loan.ownerReturnAt || loan.requesterReturnAt ? "Pengembalian sudah dikonfirmasi." : null;
        case "add_dispute_info":
            return state === "DISPUTED" ? null : "Keterangan hanya dapat ditambahkan selama sengketa ditinjau.";
        case "approve_extension":
        case "reject_extension":
            if (!ownSide) return "Hanya pemilik buku yang dapat menanggapi perpanjangan.";
            if (state !== "ACTIVE" && state !== "OVERDUE") return "Pinjaman ini tidak sedang berjalan.";
            return loan.extensionStatus === "PENDING" ? null : "Tidak ada permintaan perpanjangan yang menunggu.";
    }
}

const allActions: LoanAction[] = [
    "approve", "reject", "cancel", "confirm_handover", "confirm_return", "remind", "report_problem",
    "request_extension", "approve_extension", "reject_extension", "add_dispute_info",
];

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

/** The "Jaminan:" line the Tambah Buku dialog writes into the listing rules. */
export function guaranteeFromRules(rules: string | null | undefined) {
    return rules?.match(/Jaminan:\s*(.+)/i)?.[1]?.trim() || null;
}

/** The "Catatan kondisi:" line the Tambah Buku dialog writes into the listing rules. */
export function conditionNoteFromRules(rules: string | null | undefined) {
    return rules?.match(/Catatan kondisi:\s*(.+)/i)?.[1]?.trim() || null;
}

export type LoanGroup = "action" | "waiting" | "ongoing" | "history";

/** Figma 297:2494 / 298:2551 sections: Perlu Tindakan, Menunggu Jawaban, Sedang Berjalan, Riwayat. */
export function loanGroup(loan: LoanSnapshot, role: LoanRole, now = new Date()): LoanGroup {
    const state = loanState(loan, now);
    const mine = role === "owner"
        ? { handover: loan.ownerHandoverAt, returned: loan.ownerReturnAt }
        : { handover: loan.requesterHandoverAt, returned: loan.requesterReturnAt };
    const theirs = role === "owner" ? loan.requesterReturnAt : loan.ownerReturnAt;
    if (role === "owner" && loan.extensionStatus === "PENDING" && (state === "ACTIVE" || state === "OVERDUE")) return "action";
    switch (state) {
        case "PENDING":
            return role === "owner" ? "action" : "waiting";
        case "AWAITING_HANDOVER":
            return mine.handover ? "ongoing" : "action";
        case "OVERDUE":
            return mine.returned ? "ongoing" : "action";
        case "ACTIVE":
            return theirs && !mine.returned ? "action" : "ongoing";
        case "DISPUTED":
            return (role === "owner" ? loan.ownerReplyRequestedAt : loan.requesterReplyRequestedAt) ? "action" : "ongoing";
        default:
            return "history";
    }
}

/** Labels for `borrow_events.type`, shared by the loan cards and the admin dispute page. */
export const loanEventLabels: Record<string, string> = {
    REQUESTED: "Permintaan diajukan",
    APPROVED: "Permintaan diterima",
    REJECTED: "Permintaan ditolak",
    CANCELLED: "Dibatalkan",
    HANDOVER_CONFIRMED: "Serah terima dikonfirmasi",
    BORROWING_STARTED: "Pinjaman dimulai",
    RETURN_CONFIRMED: "Pengembalian dikonfirmasi",
    RETURNED: "Buku dikembalikan",
    REMINDER_SENT: "Pengingat dikirim",
    DISPUTE_OPENED: "Masalah dilaporkan",
    DISPUTE_RESOLVED: "Sengketa diputuskan",
    EXTENSION_REQUESTED: "Perpanjangan diajukan",
    EXTENSION_APPROVED: "Perpanjangan diterima",
    EXTENSION_REJECTED: "Perpanjangan ditolak",
    DISPUTE_INFO_REQUESTED: "Pengelola meminta keterangan",
    DISPUTE_INFO_ADDED: "Keterangan ditambahkan",
};
