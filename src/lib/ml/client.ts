import "server-only";

import { env } from "@/env";

import { recommendBooks as requestBooks, type MlServiceConfig } from "./books";
import { recommendCommunities as requestCommunities } from "./communities";
import { requestRoute } from "./routes";

export { ML_MAX_TOP_N, MlServiceError, type MlBookRecommendation, type MlServiceConfig, type MlServiceErrorKind } from "./books";
export type { MlCommunityRecommendation } from "./communities";

function defaultConfig(): MlServiceConfig {
    return { url: env.RECOMMENDATION_API_URL, apiKey: env.RECOMMENDATION_API_KEY };
}

export function isMlServiceConfigured() {
    return Boolean(env.RECOMMENDATION_API_URL);
}

/** Book recommendations from the configured TemuBaca ML Service (TB-056); see `./books`. */
export function recommendBooks(input: { interests: string[]; topN: number }) {
    return requestBooks(input, defaultConfig());
}

/** Community recommendations from the configured TemuBaca ML Service (TB-060); see `./communities`. */
export function recommendCommunities(input: { interests: string[]; regionCode: string | null; topN: number }) {
    return requestCommunities(input, defaultConfig());
}

/** Road route from the configured ML Service (TB-064); see `./routes`. */
export function routeBetween(input: Parameters<typeof requestRoute>[0]) {
    return requestRoute(input, defaultConfig());
}
