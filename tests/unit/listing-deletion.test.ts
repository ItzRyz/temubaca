import { describe, expect, test } from "bun:test";

import { listingDeletionBlocker } from "../../src/features/book-listings/listing-deletion";

describe("book listing deletion rules", () => {
    test("allows deleting listings no borrower depends on", () => {
        expect(listingDeletionBlocker({ availability: "AVAILABLE", borrowRequestCount: 0 })).toBeNull();
        expect(listingDeletionBlocker({ availability: "UNAVAILABLE", borrowRequestCount: 0 })).toBeNull();
    });

    test("blocks reserved listings and listings with borrow history", () => {
        expect(listingDeletionBlocker({ availability: "RESERVED", borrowRequestCount: 0 })).toBe("reserved");
        expect(listingDeletionBlocker({ availability: "AVAILABLE", borrowRequestCount: 2 })).toBe("has_requests");
    });
});
