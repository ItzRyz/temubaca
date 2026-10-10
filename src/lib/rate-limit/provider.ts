import "server-only";

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
}

export interface RateLimitOptions {
    key: string;
    limit: number;
    windowSeconds: number;
}

export interface RateLimitProvider {
    limit(options: RateLimitOptions): Promise<RateLimitResult>;
}

let redis: Redis | undefined;

const limiters = new Map<string, Ratelimit>();

function getRedis(): Redis {
    if (redis) {
        return redis;
    }

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        throw new Error(
            "Rate limit provider is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
        );
    }

    redis = new Redis({ url, token });

    return redis;
}

function getLimiter(
    limit: number,
    windowSeconds: number,
): Ratelimit {
    const cacheKey = `${limit}:${windowSeconds}`;

    const existing = limiters.get(cacheKey);

    if (existing) {
        return existing;
    }

    const limiter = new Ratelimit({
        redis: getRedis(),
        limiter: Ratelimit.slidingWindow(
            limit,
            `${windowSeconds} s`,
        ),
        prefix: "temubaca:ratelimit",
        analytics: false,
    });

    limiters.set(cacheKey, limiter);

    return limiter;
}

export async function enforceRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
): Promise<RateLimitResult> {
    if (!key.trim()) {
        throw new Error("Rate limit key must not be empty.");
    }

    if (!Number.isInteger(limit) || limit < 1) {
        throw new Error(
            "Rate limit must be a positive integer.",
        );
    }

    if (
        !Number.isInteger(windowSeconds) ||
        windowSeconds < 1
    ) {
        throw new Error(
            "Rate limit window must be a positive integer.",
        );
    }

    const limiter = getLimiter(limit, windowSeconds);

    const result = await limiter.limit(key);

    return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
    };
}

export const rateLimitProvider: RateLimitProvider = {
    limit: ({ key, limit, windowSeconds }) =>
        enforceRateLimit(key, limit, windowSeconds),
};