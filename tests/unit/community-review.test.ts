import { describe, expect, test } from "bun:test";

import {
    availableCommunityDecisions,
    resolveCommunityReview,
} from "@/features/verification/community-review";
import { communityReviewSchema } from "@/lib/validation/schemas/verification.schema";

describe("community review transitions", () => {
    test("approves and rejects only pending communities", () => {
        expect(resolveCommunityReview("PENDING", "APPROVE")).toEqual({ status: "VERIFIED", verificationStatus: "APPROVED" });
        expect(resolveCommunityReview("PENDING", "REJECT")).toEqual({ status: "REJECTED", verificationStatus: "REJECTED" });
        expect(resolveCommunityReview("VERIFIED", "APPROVE")).toBeNull();
        expect(resolveCommunityReview("REJECTED", "APPROVE")).toBeNull();
    });

    test("suspends verified communities and reinstates suspended ones", () => {
        expect(resolveCommunityReview("VERIFIED", "SUSPEND")).toEqual({ status: "SUSPENDED", verificationStatus: "REVOKED" });
        expect(resolveCommunityReview("SUSPENDED", "REINSTATE")).toEqual({ status: "VERIFIED", verificationStatus: "APPROVED" });
        expect(resolveCommunityReview("PENDING", "SUSPEND")).toBeNull();
    });

    test("lists the decisions available for each status", () => {
        expect(availableCommunityDecisions("PENDING")).toEqual(["APPROVE", "REJECT"]);
        expect(availableCommunityDecisions("VERIFIED")).toEqual(["SUSPEND"]);
        expect(availableCommunityDecisions("SUSPENDED")).toEqual(["REINSTATE"]);
        expect(availableCommunityDecisions("REJECTED")).toEqual([]);
    });
});

describe("communityReviewSchema", () => {
    test("requires a reason to reject or suspend", () => {
        expect(communityReviewSchema.safeParse({ decision: "REJECT" }).success).toBe(false);
        expect(communityReviewSchema.safeParse({ decision: "SUSPEND", note: "  " }).success).toBe(false);
        expect(communityReviewSchema.safeParse({ decision: "REJECT", note: "Lokasi bukan ruang publik" }).success).toBe(true);
    });

    test("allows approval without a note and rejects unknown fields", () => {
        expect(communityReviewSchema.safeParse({ decision: "APPROVE" }).success).toBe(true);
        expect(communityReviewSchema.safeParse({ decision: "APPROVE", status: "VERIFIED" }).success).toBe(false);
        expect(communityReviewSchema.safeParse({ decision: "DELETE" }).success).toBe(false);
    });
});
