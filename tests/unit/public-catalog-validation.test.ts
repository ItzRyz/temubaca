import { describe, expect, test } from "bun:test";

import {
    publicCommunityQuerySchema,
    publicEventQuerySchema,
} from "@/lib/validation/schemas/public-catalog.schema";

describe("public catalog query validation", () => {
    test("accepts bounded pagination and normalized community search", () => {
        expect(publicCommunityQuerySchema.parse({ q: "  baca  ", page: "2", limit: "25" })).toEqual({
            q: "baca",
            page: 2,
            limit: 25,
        });
        expect(publicEventQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    });

    test("rejects unknown fields and oversized search terms", () => {
        expect(publicCommunityQuerySchema.safeParse({ admin: "true" }).success).toBe(false);
        expect(publicCommunityQuerySchema.safeParse({ q: "a".repeat(101) }).success).toBe(false);
    });
});
