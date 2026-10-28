import { describe, expect, test } from "bun:test";

import {
    actionBlocker,
    allowedActions,
    DISPUTE_REVIEW_HOURS,
    disputeDeadline,
    dueDateFrom,
    guaranteeFromRules,
    loanDayChoices,
    loanGroup,
    loanState,
    maxLoanDaysFromRules,
    meetingPointsOf,
    overdueDays,
    type LoanSnapshot,
} from "../../src/features/borrowing/lifecycle";
import { composeListingDetails, isMoneyGuarantee } from "../../src/features/book-listings/listing-draft";
import { borrowRequestActionSchema, createBorrowRequestSchema } from "../../src/lib/validation/schemas/borrowing.schema";

const now = new Date("2026-10-18T10:00:00Z");
const day = 24 * 60 * 60 * 1000;
const base: LoanSnapshot = {
    requestStatus: "PENDING",
    borrowingStatus: null,
    dueAt: null,
    ownerHandoverAt: null,
    requesterHandoverAt: null,
    ownerReturnAt: null,
    requesterReturnAt: null,
    lastReminderAt: null,
    extensionStatus: null,
    ownerReplyRequestedAt: null,
    requesterReplyRequestedAt: null,
};
const active = { ...base, requestStatus: "COMPLETED", borrowingStatus: "ACTIVE", dueAt: new Date(now.getTime() + 3 * day) };
const overdue = { ...active, dueAt: new Date(now.getTime() - 2 * day - 1000) };

describe("loan states", () => {
    test("derive from the request and borrowing rows", () => {
        expect(loanState(base, now)).toBe("PENDING");
        expect(loanState({ ...base, requestStatus: "APPROVED" }, now)).toBe("AWAITING_HANDOVER");
        expect(loanState(active, now)).toBe("ACTIVE");
        expect(loanState(overdue, now)).toBe("OVERDUE");
        expect(loanState({ ...active, borrowingStatus: "DISPUTED" }, now)).toBe("DISPUTED");
        expect(loanState({ ...active, borrowingStatus: "RETURNED" }, now)).toBe("RETURNED");
        expect(overdueDays(overdue.dueAt, now)).toBe(2);
        expect(dueDateFrom(now, 14).getTime() - now.getTime()).toBe(14 * day);
    });
});

describe("who may do what (DEC-02)", () => {
    test("only the owner answers a waiting request; the reader may cancel it", () => {
        expect(allowedActions(base, "owner", now)).toEqual(["approve", "reject"]);
        expect(allowedActions(base, "requester", now)).toEqual(["cancel"]);
    });

    test("after acceptance both sides may cancel or confirm the handover, once each", () => {
        const approved = { ...base, requestStatus: "APPROVED" };
        expect(allowedActions(approved, "owner", now)).toEqual(["cancel", "confirm_handover"]);
        expect(allowedActions(approved, "requester", now)).toEqual(["cancel", "confirm_handover"]);
        expect(actionBlocker({ ...approved, ownerHandoverAt: now }, "owner", "confirm_handover", now)).not.toBeNull();
        expect(actionBlocker({ ...approved, ownerHandoverAt: now }, "requester", "confirm_handover", now)).toBeNull();
    });

    test("handed-over loans cannot be cancelled; both confirm the return and either may report a problem", () => {
        expect(allowedActions(active, "owner", now)).toEqual(["confirm_return", "report_problem"]);
        expect(allowedActions(active, "requester", now)).toEqual(["confirm_return", "report_problem", "request_extension"]);
        expect(actionBlocker(active, "requester", "cancel", now)).not.toBeNull();
    });

    test("reminders are for overdue loans, owner only, once per 24 hours", () => {
        expect(allowedActions(overdue, "owner", now)).toContain("remind");
        expect(allowedActions(overdue, "requester", now)).not.toContain("remind");
        expect(actionBlocker({ ...overdue, lastReminderAt: new Date(now.getTime() - 3_600_000) }, "owner", "remind", now)).not.toBeNull();
        expect(actionBlocker({ ...overdue, lastReminderAt: new Date(now.getTime() - 25 * 3_600_000) }, "owner", "remind", now)).toBeNull();
    });

    test("a disputed loan only takes more details; finished loans allow nothing", () => {
        expect(allowedActions({ ...active, borrowingStatus: "DISPUTED" }, "owner", now)).toEqual(["add_dispute_info"]);
        expect(allowedActions({ ...active, borrowingStatus: "DISPUTED" }, "requester", now)).toEqual(["add_dispute_info"]);
        expect(allowedActions({ ...active, borrowingStatus: "RETURNED" }, "requester", now)).toEqual([]);
        expect(allowedActions({ ...base, requestStatus: "REJECTED" }, "requester", now)).toEqual([]);
    });
});

describe("disputes and guarantees (28 Okt 2026)", () => {
    test("an admin question puts the dispute under Perlu Tindakan for the asked party only", () => {
        const disputed = { ...active, borrowingStatus: "DISPUTED" };
        expect(loanGroup(disputed, "owner", now)).toBe("ongoing");
        const asked = { ...disputed, requesterReplyRequestedAt: now };
        expect(loanGroup(asked, "requester", now)).toBe("action");
        expect(loanGroup(asked, "owner", now)).toBe("ongoing");
    });

    test("the decision target is 72 hours after the report", () => {
        expect(disputeDeadline(now).getTime() - now.getTime()).toBe(DISPUTE_REVIEW_HOURS * 3_600_000);
        expect(DISPUTE_REVIEW_HOURS).toBe(72);
    });

    test("the guarantee line round-trips through the listing rules and may not be money", () => {
        const { borrowingRules } = composeListingDetails({ meetingPoints: ["Taman Suropati"], loanDays: 14, guarantee: "  Tunjukkan   kartu pelajar " });
        expect(guaranteeFromRules(borrowingRules)).toBe("Tunjukkan kartu pelajar");
        expect(guaranteeFromRules("Lama pinjam: 7 hari.")).toBeNull();
        for (const money of ["Rp 50.000", "uang jaminan", "deposit 100rb", "transfer dulu", "50k", "dua juta"]) expect(isMoneyGuarantee(money)).toBe(true);
        for (const fine of ["Tunjukkan kartu pelajar", "Kartu anggota perpustakaan", "Kenalan lewat komunitas"]) expect(isMoneyGuarantee(fine)).toBe(false);
    });
});

describe("listing rules", () => {
    test("loan period comes from the listing text, capped choices", () => {
        expect(maxLoanDaysFromRules("Lama pinjam: 21 hari.\nCatatan kondisi: bagus")).toBe(21);
        expect(maxLoanDaysFromRules(null)).toBe(14);
        expect(maxLoanDaysFromRules("Lama pinjam: 90 hari.")).toBe(14);
        expect(loanDayChoices(21)).toEqual([7, 14, 21]);
        expect(loanDayChoices(10)).toEqual([7, 10]);
        expect(meetingPointsOf("Taman Suropati & TIM Cikini")).toEqual(["Taman Suropati", "TIM Cikini"]);
        expect(meetingPointsOf(null)).toEqual([]);
    });
});

describe("request validation", () => {
    const listingId = "00000000-0000-4000-8000-000000000001";

    test("the ethics agreement is required", () => {
        expect(createBorrowRequestSchema.safeParse({ listingId, loanDays: 14, agreed: false }).success).toBe(false);
        const parsed = createBorrowRequestSchema.parse({ listingId, loanDays: "14", agreed: true, note: "  " });
        expect(parsed.loanDays).toBe(14);
        expect(parsed.note).toBeUndefined();
    });

    test("rejecting with \"Lainnya\" needs a note", () => {
        expect(borrowRequestActionSchema.safeParse({ action: "reject", reason: "Lainnya" }).success).toBe(false);
        expect(borrowRequestActionSchema.safeParse({ action: "reject", reason: "Lainnya", note: "Sedang dipakai." }).success).toBe(true);
        expect(borrowRequestActionSchema.safeParse({ action: "reject", reason: "Alasan karangan" }).success).toBe(false);
    });
});

describe("loan groups", () => {
    test("each side sees what waits on them", async () => {
        const { loanGroup } = await import("../../src/features/borrowing/lifecycle");
        expect(loanGroup(base, "owner", now)).toBe("action");
        expect(loanGroup(base, "requester", now)).toBe("waiting");
        const approved = { ...base, requestStatus: "APPROVED", ownerHandoverAt: now };
        expect(loanGroup(approved, "owner", now)).toBe("ongoing");
        expect(loanGroup(approved, "requester", now)).toBe("action");
        expect(loanGroup(overdue, "requester", now)).toBe("action");
        expect(loanGroup({ ...active, requesterReturnAt: now }, "owner", now)).toBe("action");
        expect(loanGroup({ ...active, requesterReturnAt: now }, "requester", now)).toBe("ongoing");
        expect(loanGroup({ ...active, borrowingStatus: "RETURNED" }, "owner", now)).toBe("history");
    });
});

describe("loan extension rules", () => {
    test("only the reader asks, once, before the due date", () => {
        expect(actionBlocker(active, "requester", "request_extension", now)).toBeNull();
        expect(actionBlocker(active, "owner", "request_extension", now)).toContain("Hanya peminjam");
        expect(actionBlocker(overdue, "requester", "request_extension", now)).toContain("sebelum tenggat");
        expect(actionBlocker({ ...active, extensionStatus: "REJECTED" }, "requester", "request_extension", now)).toContain("satu kali");
        expect(actionBlocker({ ...active, requesterReturnAt: now }, "requester", "request_extension", now)).toContain("Pengembalian");
    });

    test("the owner answers a waiting request, also after the due date", async () => {
        const { loanGroup } = await import("../../src/features/borrowing/lifecycle");
        const asked = { ...active, extensionStatus: "PENDING" };
        expect(allowedActions(asked, "owner", now)).toEqual(expect.arrayContaining(["approve_extension", "reject_extension"]));
        expect(actionBlocker({ ...overdue, extensionStatus: "PENDING" }, "owner", "approve_extension", now)).toBeNull();
        expect(actionBlocker(asked, "requester", "approve_extension", now)).toContain("Hanya pemilik");
        expect(actionBlocker(active, "owner", "reject_extension", now)).toContain("Tidak ada permintaan");
        expect(loanGroup(asked, "owner", now)).toBe("action");
    });

    test("the period is capped at 14 days", async () => {
        const { borrowingActionSchema } = await import("../../src/lib/validation/schemas/borrowing.schema");
        expect(borrowingActionSchema.safeParse({ action: "request_extension", days: 14 }).success).toBe(true);
        expect(borrowingActionSchema.safeParse({ action: "request_extension", days: 15 }).success).toBe(false);
        expect(borrowingActionSchema.safeParse({ action: "request_extension", days: 0 }).success).toBe(false);
    });
});
