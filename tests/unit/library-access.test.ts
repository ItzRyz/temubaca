import { describe, expect, test } from "bun:test";

import { accessActionBlocker, accessState, holdingLabel, mergeHoldings, pickupDeadline } from "../../src/features/libraries/access";
import { accessActionSchema, holdingInputSchema } from "../../src/lib/validation/schemas/library.schema";

const now = new Date("2026-10-28T10:00:00Z");
const hour = 3_600_000;

describe("access requests (TB-023)", () => {
    test("an approved request past its pick-up deadline reads as expired, without storing it", () => {
        const approved = { status: "APPROVED", expiresAt: pickupDeadline(now, 3) };
        expect(accessState(approved, now)).toBe("APPROVED");
        expect(accessState(approved, new Date(now.getTime() + 3 * 24 * hour + 1))).toBe("EXPIRED");
        expect(accessState({ status: "PENDING", expiresAt: null }, now)).toBe("PENDING");
    });

    test("who may do what", () => {
        const pending = { status: "PENDING", expiresAt: null };
        const late = { status: "APPROVED", expiresAt: new Date(now.getTime() - hour) };
        expect(accessActionBlocker(pending, "manager", "approve", now)).toBeNull();
        expect(accessActionBlocker(pending, "requester", "approve", now)).not.toBeNull();
        expect(accessActionBlocker(pending, "requester", "cancel", now)).toBeNull();
        expect(accessActionBlocker(pending, "manager", "collected", now)).not.toBeNull();
        expect(accessActionBlocker(late, "manager", "collected", now)).toBeNull();
        expect(accessActionBlocker(late, "requester", "cancel", now)).not.toBeNull();
        expect(accessActionBlocker({ status: "COLLECTED", expiresAt: null }, "requester", "cancel", now)).not.toBeNull();
    });

    test("a rejection needs a reason; copies available cannot exceed the total", () => {
        expect(accessActionSchema.safeParse({ action: "reject", note: "" }).success).toBe(false);
        expect(accessActionSchema.safeParse({ action: "reject", note: "Buku sedang diperbaiki." }).success).toBe(true);
        const holding = { bookId: crypto.randomUUID(), status: "AVAILABLE", callNumber: "" };
        expect(holdingInputSchema.safeParse({ ...holding, copiesTotal: "2", copiesAvailable: "3" }).success).toBe(false);
        expect(holdingInputSchema.parse({ ...holding, copiesTotal: "2", copiesAvailable: "" })).toMatchObject({ copiesTotal: 2, copiesAvailable: null, callNumber: null });
    });
});

describe("holdings (DEC-13)", () => {
    test("only a fresh manager status says available; listed stays honest about its age", () => {
        expect(holdingLabel({ status: "AVAILABLE", copiesAvailable: 2, checkedAt: new Date(now.getTime() - hour) }, now)).toEqual({ tone: "available", text: "Tersedia 2 eksemplar", stale: false });
        expect(holdingLabel({ status: "AVAILABLE", copiesAvailable: 2, checkedAt: new Date(now.getTime() - 25 * hour) }, now).tone).toBe("unknown");
        expect(holdingLabel({ status: "LISTED", copiesAvailable: null, checkedAt: new Date(now.getTime() - 31 * 24 * hour) }, now)).toEqual({ tone: "listed", text: "Tercatat di koleksi", stale: true });
        expect(holdingLabel({ status: "LISTED", copiesTotal: 3, copiesAvailable: 1, checkedAt: now }, now).text).toBe("Tercatat di koleksi · 1 dari 3 eksemplar tidak sedang dipinjam, menurut katalog");
    });

    test("merging keeps one row per library: manager over curation, latest check", () => {
        const at = (hours: number) => new Date(now.getTime() - hours * hour);
        const merged = mergeHoldings([
            { libraryId: "a", source: "CURATED", checkedAt: at(1), sourceUrl: "https://katalog.example/record/1" },
            { libraryId: "a", source: "MANAGER", checkedAt: at(5), sourceUrl: null },
            { libraryId: "b", source: "CURATED", checkedAt: at(2), sourceUrl: null },
        ]);
        expect(merged.map((row) => [row.libraryId, row.source, row.checkedAt.getTime(), row.sourceUrl])).toEqual([
            ["a", "MANAGER", at(1).getTime(), "https://katalog.example/record/1"],
            ["b", "CURATED", at(2).getTime(), null],
        ]);
    });
});
