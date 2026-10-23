import "server-only";

import { listRecommendableCommunities } from "@/lib/db/queries/communities";
import { listUserInterests } from "@/lib/db/queries/interests";
import { findUserById } from "@/lib/db/queries/users";
import { isMlServiceConfigured, ML_MAX_TOP_N, MlServiceError, recommendCommunities, type MlCommunityRecommendation } from "@/lib/ml/client";

import { communityReason, locationScore, rankCommunities, sharedInterests } from "./community-matching";

export type CommunityRecommendationState = "needs_input" | "no_match" | "ok";

type Candidate = Awaited<ReturnType<typeof listRecommendableCommunities>>[number];

const toItem = (community: Candidate, matched: string[], location: 0 | 0.5 | 1) => ({
    ...community,
    matched,
    reason: communityReason(matched, location, community.regionCode),
});

/**
 * ML Service picks, in its order, that are still VERIFIED and that the user has not joined. Returns
 * null when the service is not configured, fails, or leaves nothing usable, so the baseline runs.
 */
async function mlCommunities(userId: string, subjects: string[], regionCode: string | null, limit: number) {
    if (!isMlServiceConfigured()) return null;

    let result: { items: MlCommunityRecommendation[]; unmatchedInterests: string[] };
    try {
        result = await recommendCommunities({ interests: subjects, regionCode, topN: ML_MAX_TOP_N });
    } catch (error) {
        // Only the failure kind is logged, never the interests or region.
        console.error("[ML_SERVICE_ERROR]", { kind: error instanceof MlServiceError ? error.kind : "unknown" });
        return null;
    }
    if (!result.items.length) return null;

    // The model can be older than the data: dropped, unverified, or joined communities fall out here.
    const rows = await listRecommendableCommunities(userId, result.items.map((item) => item.community_id));
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items = result.items
        .flatMap((item) => {
            const community = byId.get(item.community_id);
            if (!community) return [];
            // Tags and region come from the database, which may be newer than the model.
            return [toItem(community, sharedInterests(subjects, community.interests), locationScore(regionCode, community.regionCode))];
        })
        .slice(0, limit);

    return items.length ? { items, unmatchedInterests: result.unmatchedInterests } : null;
}

/** Community recommendations (TB-060, TB-041): ML Service first, SQL baseline as fallback (DEC-08). */
export async function getCommunityRecommendations(userId: string, limit = 3) {
    const [interests, profile] = await Promise.all([listUserInterests(userId), findUserById(userId)]);
    const subjects = interests.map(({ subject }) => subject);
    const regionCode = profile?.regionCode ?? null;

    if (!subjects.length && !regionCode) {
        return { state: "needs_input" as CommunityRecommendationState, items: [], engine: null, unmatchedInterests: [] as string[] };
    }

    const ml = await mlCommunities(userId, subjects, regionCode, limit);
    if (ml) return { state: "ok" as CommunityRecommendationState, items: ml.items, engine: "ml" as const, unmatchedInterests: ml.unmatchedInterests };

    const items = rankCommunities(subjects, regionCode, await listRecommendableCommunities(userId))
        .slice(0, limit)
        .map(({ community, matched, location }) => toItem(community, matched, location));
    return {
        state: (items.length ? "ok" : "no_match") as CommunityRecommendationState,
        items,
        engine: "baseline" as const,
        unmatchedInterests: [] as string[],
    };
}
