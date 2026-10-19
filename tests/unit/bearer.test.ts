import { describe, expect, test } from "bun:test";

import { matchesBearer } from "../../src/lib/api/bearer";

const secret = "s".repeat(32);

describe("matchesBearer", () => {
    test("accepts the exact bearer header", () => {
        expect(matchesBearer(`Bearer ${secret}`, secret)).toBe(true);
    });

    test("rejects a wrong secret of the same length", () => {
        expect(matchesBearer(`Bearer ${"t".repeat(32)}`, secret)).toBe(false);
    });

    test("rejects a different length, another scheme, and a missing header", () => {
        expect(matchesBearer(`Bearer ${secret}x`, secret)).toBe(false);
        expect(matchesBearer(secret, secret)).toBe(false);
        expect(matchesBearer(`Basic ${secret}`, secret)).toBe(false);
        expect(matchesBearer(null, secret)).toBe(false);
    });
});
