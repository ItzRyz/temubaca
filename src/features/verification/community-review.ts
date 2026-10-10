import type { communityStatusValues, verificationStatusValues } from "@/lib/db/schema";

export type CommunityStatus = (typeof communityStatusValues)[number];
export type VerificationStatus = (typeof verificationStatusValues)[number];

export const communityReviewDecisions = ["APPROVE", "REJECT", "SUSPEND", "REINSTATE"] as const;
export type CommunityReviewDecision = (typeof communityReviewDecisions)[number];

type Transition = { from: CommunityStatus; to: CommunityStatus; record: VerificationStatus; requiresNote: boolean };

/** Allowed human-review transitions (TB-031). Anything not listed is rejected by the server. */
const transitions: Record<CommunityReviewDecision, Transition> = {
    APPROVE: { from: "PENDING", to: "VERIFIED", record: "APPROVED", requiresNote: false },
    REJECT: { from: "PENDING", to: "REJECTED", record: "REJECTED", requiresNote: true },
    SUSPEND: { from: "VERIFIED", to: "SUSPENDED", record: "REVOKED", requiresNote: true },
    REINSTATE: { from: "SUSPENDED", to: "VERIFIED", record: "APPROVED", requiresNote: false },
};

export function decisionRequiresNote(decision: CommunityReviewDecision) {
    return transitions[decision].requiresNote;
}

/** Returns the resulting statuses, or null when the decision is not allowed from the current status. */
export function resolveCommunityReview(current: CommunityStatus, decision: CommunityReviewDecision) {
    const transition = transitions[decision];
    return transition.from === current ? { status: transition.to, verificationStatus: transition.record } : null;
}

/** Decisions an admin may take for a community in the given status. */
export function availableCommunityDecisions(current: CommunityStatus) {
    return communityReviewDecisions.filter((decision) => transitions[decision].from === current);
}
