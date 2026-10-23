/**
 * ML Service community contract without env access, so tests can drive it directly.
 * App code imports `./client`, which supplies the configured URL and key.
 */
import { z } from "zod";

import { isKnownKabkota } from "@/features/regions/regions";

import { ML_MAX_TOP_N, postToMlService, type MlServiceConfig } from "./request";

const communityRecommendationsSchema = z.object({
    recommendations: z.array(z.object({
        community_id: z.uuid(),
        name: z.string(),
        region_code: z.string(),
        region_name: z.string(),
        interest_score: z.number(),
        location_score: z.number(),
        score: z.number(),
        reason: z.string(),
    })),
    unmatched_interests: z.array(z.string()).default([]),
    notice: z.enum(["NEEDS_INTERESTS_OR_LOCATION", "NO_MATCH"]).nullable().default(null),
});

export type MlCommunityRecommendation = z.infer<typeof communityRecommendationsSchema>["recommendations"][number];

/**
 * Community recommendations from the TemuBaca ML Service (TB-060). Only the interests, the profile
 * kab/kota code, and `top_n` leave the app (TB-057). Throws `MlServiceError` so callers can fall back.
 */
export async function recommendCommunities(
    input: { interests: string[]; regionCode: string | null; topN: number },
    config: MlServiceConfig,
) {
    // An unknown code would fail the whole request with 422, so it is left out instead.
    const region = input.regionCode && isKnownKabkota(input.regionCode) ? { user_region_code: input.regionCode } : {};
    const body = await postToMlService(
        "/api/recommendations/communities",
        { user_interests: input.interests, ...region, top_n: Math.min(input.topN, ML_MAX_TOP_N) },
        communityRecommendationsSchema,
        config,
    );
    return { items: body.recommendations, unmatchedInterests: body.unmatched_interests, notice: body.notice };
}
