/**
 * ML Service book contract without env access, so tests can drive it directly.
 * App code imports `./client`, which supplies the configured URL and key.
 */
import { z } from "zod";

import { ML_MAX_TOP_N, postToMlService, type MlServiceConfig } from "./request";

export { ML_MAX_TOP_N, MlServiceError, type MlServiceConfig, type MlServiceErrorKind } from "./request";

const bookRecommendationsSchema = z.object({
    recommendations: z.array(z.object({
        book_id: z.uuid(),
        title: z.string(),
        score: z.number().nullable(),
        reason: z.string(),
        source: z.enum(["interest", "popularity"]),
    })),
    unmatched_interests: z.array(z.string()).default([]),
});

export type MlBookRecommendation = z.infer<typeof bookRecommendationsSchema>["recommendations"][number];

/**
 * Book recommendations from the TemuBaca ML Service (TB-056). Only the interests and `top_n` leave
 * the app: no user id, email, or location. Throws `MlServiceError` so callers can fall back.
 */
export async function recommendBooks(
    input: { interests: string[]; topN: number },
    config: MlServiceConfig,
) {
    const body = await postToMlService(
        "/api/recommendations/books",
        { user_interests: input.interests, top_n: Math.min(input.topN, ML_MAX_TOP_N) },
        bookRecommendationsSchema,
        config,
    );
    return { items: body.recommendations, unmatchedInterests: body.unmatched_interests };
}
