import { describe, expect, test } from "bun:test";

import {
    actionBlocker,
    allowedActions,
    dueDateFrom,
    loanDayChoices,
    loanState,
    maxLoanDaysFromRules,
    meetingPointsOf,
    overdueDays,
    type LoanSnapshot,
} from "../../src/features/borrowing/lifecycle";
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
        expect(allowedActions(active, "requester", now)).toEqual(["confirm_return", "report_problem"]);
        expect(actionBlocker(active, "requester", "cancel", now)).not.toBeNull();
    });

    test("reminders are for overdue loans, owner only, once per 24 hours", () => {
        expect(allowedActions(overdue, "owner", now)).toContain("remind");
        expect(allowedActions(overdue, "requester", now)).not.toContain("remind");
        expect(actionBlocker({ ...overdue, lastReminderAt: new Date(now.getTime() - 3_600_000) }, "owner", "remind", now)).not.toBeNull();
        expect(actionBlocker({ ...overdue, lastReminderAt: new Date(now.getTime() - 25 * 3_600_000) }, "owner", "remind", now)).toBeNull();
    });

    test("disputed and finished loans allow nothing", () => {
        expect(allowedActions({ ...active, borrowingStatus: "DISPUTED" }, "owner", now)).toEqual([]);
        expect(allowedActions({ ...active, borrowingStatus: "RETURNED" }, "requester", now)).toEqual([]);
        expect(allowedActions({ ...base, requestStatus: "REJECTED" }, "requester", now)).toEqual([]);
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
