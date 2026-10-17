import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { resolveCommunityReview, type CommunityReviewDecision } from "@/features/verification/community-review";

import { db } from "../client";
import { communities, userProfiles, verifications } from "../schema";

export class InvalidReviewTransitionError extends Error {}

/**
 * Apply an admin decision to a community and record it in `verifications` atomically.
 * The community row is locked so two reviewers cannot both act on the same status.
 */
export async function reviewCommunity(input: {
    communityId: string;
    reviewerId: string;
    decision: CommunityReviewDecision;
    note?: string;
}) {
    return db.transaction(async (tx) => {
        const [community] = await tx
            .select({ id: communities.id, status: communities.status })
            .from(communities)
            .where(eq(communities.id, input.communityId))
            .for("update");
        if (!community) return null;

        const next = resolveCommunityReview(community.status, input.decision);
        if (!next) throw new InvalidReviewTransitionError(`Cannot ${input.decision} a community with status ${community.status}.`);

        const now = new Date();
        await tx.update(communities).set({ status: next.status, updatedAt: now }).where(eq(communities.id, community.id));
        const [record] = await tx.insert(verifications).values({
            targetType: "COMMUNITY",
            targetId: community.id,
            status: next.verificationStatus,
            reviewerId: input.reviewerId,
            note: input.note || null,
            reviewedAt: now,
            createdAt: now,
            updatedAt: now,
        }).returning({ id: verifications.id });

        return { id: community.id, previousStatus: community.status, status: next.status, verificationId: record.id };
    });
}

/** Review history for one community, newest first (admin only). */
export async function listCommunityVerifications(communityId: string, limit = 20) {
    return db
        .select({
            id: verifications.id,
            status: verifications.status,
            note: verifications.note,
            reviewedAt: verifications.reviewedAt,
            createdAt: verifications.createdAt,
            reviewerName: userProfiles.displayName,
        })
        .from(verifications)
        .leftJoin(userProfiles, eq(verifications.reviewerId, userProfiles.id))
        .where(and(eq(verifications.targetType, "COMMUNITY"), eq(verifications.targetId, communityId)))
        .orderBy(desc(verifications.createdAt))
        .limit(Math.min(Math.max(limit, 1), 100));
}

/** When the platform last approved this community, for the public "Status profil" line. No reviewer name. */
export async function lastCommunityApproval(communityId: string) {
    const [row] = await db
        .select({ at: verifications.createdAt })
        .from(verifications)
        .where(and(eq(verifications.targetType, "COMMUNITY"), eq(verifications.targetId, communityId), eq(verifications.status, "APPROVED")))
        .orderBy(desc(verifications.createdAt))
        .limit(1);
    return row?.at ?? null;
}
