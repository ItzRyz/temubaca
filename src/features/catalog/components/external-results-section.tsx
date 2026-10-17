import { clientIp } from "@/features/catalog/client-ip";
import { searchExternalCatalog } from "@/features/catalog/external-search";
import { createIpRateLimitKey, enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

import { ExternalResults } from "./external-results";

/** Server part of TB-021: rate limited per visitor, then provider search (cached 10 minutes). */
export async function ExternalResultsSection({ query, isAuthenticated, returnTo }: { query: string; isAuthenticated: boolean; returnTo: string }) {
    const limit = await enforceRateLimit(createIpRateLimitKey("external-book-search", await clientIp()), RATE_LIMITS.SEARCH.limit, RATE_LIMITS.SEARCH.windowSeconds);
    const outcome = limit.success ? await searchExternalCatalog(query) : { limited: true as const };
    return <ExternalResults query={query} outcome={outcome} isAuthenticated={isAuthenticated} returnTo={returnTo} />;
}
