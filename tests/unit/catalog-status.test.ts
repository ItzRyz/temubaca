import { describe, expect, test } from "bun:test";

import { catalogRecordStatus, listingAdminStatus } from "../../src/features/catalog/catalog-status";
import { listingVisibilitySchema } from "../../src/lib/validation/schemas/book.schema";

const now = new Date("2026-10-17T00:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

describe("catalog record status", () => {
    test("ranks a failed sync, then duplicates, then age", () => {
        expect(catalogRecordStatus({ createdAt: daysAgo(1), syncedAt: null, lastSyncFailed: true, duplicateCount: 2 }, now)).toBe("FAILED");
        expect(catalogRecordStatus({ createdAt: daysAgo(1), syncedAt: null, lastSyncFailed: false, duplicateCount: 1 }, now)).toBe("DUPLICATE");
        expect(catalogRecordStatus({ createdAt: daysAgo(90), syncedAt: daysAgo(31), lastSyncFailed: false, duplicateCount: 0 }, now)).toBe("STALE");
        expect(catalogRecordStatus({ createdAt: daysAgo(90), syncedAt: daysAgo(3), lastSyncFailed: false, duplicateCount: 0 }, now)).toBe("FRESH");
        expect(catalogRecordStatus({ createdAt: daysAgo(40), syncedAt: null, lastSyncFailed: false, duplicateCount: 0 }, now)).toBe("STALE");
    });
});

describe("listing moderation", () => {
    test("an admin hide outranks the owner's availability", () => {
        expect(listingAdminStatus({ availability: "AVAILABLE", hiddenAt: now })).toBe("HIDDEN");
        expect(listingAdminStatus({ availability: "RESERVED", hiddenAt: null })).toBe("RESERVED");
    });

    test("hiding requires a reason, restoring does not", () => {
        expect(listingVisibilitySchema.safeParse({ hidden: true }).success).toBe(false);
        expect(listingVisibilitySchema.safeParse({ hidden: true, reason: "  " }).success).toBe(false);
        expect(listingVisibilitySchema.safeParse({ hidden: true, reason: "Foto menyesatkan" }).success).toBe(true);
        expect(listingVisibilitySchema.safeParse({ hidden: false }).success).toBe(true);
        expect(listingVisibilitySchema.safeParse({ hidden: false, extra: 1 }).success).toBe(false);
    });
});
