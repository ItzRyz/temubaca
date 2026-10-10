import { describe, expect, test } from "bun:test";

import {
    createReportSchema,
    reportIdParamSchema,
    reportListQuerySchema,
    updateReportSchema,
} from "@/lib/validation/schemas/report.schema";

describe("report validation", () => {
    test("accepts supported report payload fields and trims text", () => {
        const parsed = createReportSchema.parse({
            targetType: "BOOK",
            targetId: "7f441928-4950-498c-8418-3c2197640227",
            reason: "  Informasi menyesatkan  ",
            details: "  ISBN berbeda dari buku  ",
        });

        expect(parsed.reason).toBe("Informasi menyesatkan");
        expect(parsed.details).toBe("ISBN berbeda dari buku");
    });

    test("rejects invalid IDs and unexpected report fields", () => {
        expect(createReportSchema.safeParse({
            targetType: "BOOK",
            targetId: "invalid",
            reason: "Spam",
            admin: true,
        }).success).toBe(false);
    });

    test("validates admin status filters and review IDs", () => {
        expect(reportListQuerySchema.safeParse({ status: "PENDING", page: "2" }).success).toBe(true);
        expect(reportListQuerySchema.safeParse({ status: "UNKNOWN" }).success).toBe(false);
        expect(reportIdParamSchema.safeParse({ reportId: "7f441928-4950-498c-8418-3c2197640227" }).success).toBe(true);
        expect(updateReportSchema.safeParse({ status: "RESOLVED", outcome: "Ditinjau" }).success).toBe(true);
    });
});
