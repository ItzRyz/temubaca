import "server-only";

import { env } from "@/env";

const GRAPH_API = "https://graph.facebook.com/v25.0";
const TIMEOUT_MS = 5_000;

/** Whether follower counts can be fetched at all (both settings present). */
export function isInstagramConfigured() {
    return Boolean(env.INSTAGRAM_BUSINESS_ACCOUNT_ID && env.INSTAGRAM_ACCESS_TOKEN);
}

/** `followers_count` from a Business Discovery response, or null when absent or malformed. */
export function followersFromResponse(payload: unknown): number | null {
    const count = (payload as { business_discovery?: { followers_count?: unknown } } | null)?.business_discovery?.followers_count;
    return typeof count === "number" && Number.isInteger(count) && count >= 0 ? count : null;
}

/**
 * Follower count of a public Instagram Business or Creator account, through the official Business
 * Discovery API (owner's decision 29 Okt 2026; no scraping). Null when not configured, when the account is
 * personal, private, age-gated or missing, or on any error: the page then shows only the profile link.
 */
export async function fetchInstagramFollowers(handle: string, fetchImpl: typeof fetch = fetch): Promise<number | null> {
    if (!isInstagramConfigured() || !/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null;
    const url = new URL(`${GRAPH_API}/${env.INSTAGRAM_BUSINESS_ACCOUNT_ID}`);
    url.searchParams.set("fields", `business_discovery.username(${handle}){followers_count}`);
    try {
        const response = await fetchImpl(url, {
            headers: { Authorization: `Bearer ${env.INSTAGRAM_ACCESS_TOKEN}` },
            signal: AbortSignal.timeout(TIMEOUT_MS),
            cache: "no-store",
        });
        if (!response.ok) return null;
        return followersFromResponse(await response.json());
    } catch {
        return null;
    }
}
