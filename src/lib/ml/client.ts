import "server-only";

import { env } from "@/env";

import { recommendBooks as requestBooks, type MlServiceConfig } from "./books";

export { ML_MAX_TOP_N, MlServiceError, type MlBookRecommendation, type MlServiceConfig, type MlServiceErrorKind } from "./books";

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
