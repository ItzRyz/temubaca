import "server-only";

import { RateLimitError } from "./errors";
import { enforceRateLimit } from "@/lib/rate-limit";

export interface ApiRateLimitOptions {
    /**
     * Unique identifier for the endpoint or operation.
     */
    key: string;

    /**
     * Maximum requests allowed in the configured window.
     */
    limit: number;

    /**
     * Window duration in seconds.
     */
    windowSeconds: number;
}

/**
 * Enforce rate limiting for an API operation.
 *
 * The underlying provider must use shared storage in production.
 */
export async function requireApiRateLimit(
    options: ApiRateLimitOptions,
) {
    const result = await enforceRateLimit(
        options.key,
        options.limit,
        options.windowSeconds,
    );

    if (!result.success) {
        throw new RateLimitError(
            "Too many requests. Please try again later.",
        );
    }

    return result;
}