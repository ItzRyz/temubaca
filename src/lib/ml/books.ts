/**
 * ML Service HTTP contract without env access, so tests can drive it directly.
 * App code imports `./client`, which supplies the configured URL and key.
 */
import { z } from "zod";

const DEFAULT_TIMEOUT_MS = 3_000;
/** The ML Service accepts at most 20 results per request (DEC-08). */
export const ML_MAX_TOP_N = 20;

export type MlServiceErrorKind = "not_configured" | "timeout" | "unavailable" | "invalid_response";

export class MlServiceError extends Error {
    constructor(readonly kind: MlServiceErrorKind, message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "MlServiceError";
    }
}

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

export type MlServiceConfig = {
    url?: string;
    apiKey?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
};


/**
 * Book recommendations from the TemuBaca ML Service (TB-056). Only the interests and `top_n` leave
 * the app: no user id, email, or location. Throws `MlServiceError` so callers can fall back.
 */
export async function recommendBooks(
    input: { interests: string[]; topN: number },
    config: MlServiceConfig,
) {
    if (!config.url) throw new MlServiceError("not_configured", "RECOMMENDATION_API_URL is not set.");

    const fetchImpl = config.fetchImpl ?? fetch;
    const headers: Record<string, string> = { accept: "application/json", "content-type": "application/json" };
    if (config.apiKey) headers["x-internal-token"] = config.apiKey;

    let response: Response;
    try {
        response = await fetchImpl(new URL("/api/recommendations/books", config.url), {
            method: "POST",
            headers,
            body: JSON.stringify({ user_interests: input.interests, top_n: Math.min(input.topN, ML_MAX_TOP_N) }),
            signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
            cache: "no-store",
        });
    } catch (error) {
        const timedOut = error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
        throw new MlServiceError(timedOut ? "timeout" : "unavailable", "ML Service request failed.", { cause: error });
    }

    if (!response.ok) throw new MlServiceError("unavailable", `ML Service responded with ${response.status}.`);

    let body: unknown;
    try {
        body = await response.json();
    } catch (error) {
        throw new MlServiceError("invalid_response", "ML Service returned invalid JSON.", { cause: error });
    }

    const parsed = bookRecommendationsSchema.safeParse(body);
    if (!parsed.success) throw new MlServiceError("invalid_response", "ML Service response did not match the contract.");

    return { items: parsed.data.recommendations, unmatchedInterests: parsed.data.unmatched_interests };
}
