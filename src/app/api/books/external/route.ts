import { apiSuccess, parseQuery, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { clientIp } from "@/features/catalog/client-ip";
import { searchExternalCatalog } from "@/features/catalog/external-search";
import { createIpRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { externalBookSearchQuerySchema } from "@/lib/validation/schemas/book.schema";

/** Search Open Library / Google Books; results are cached 10 minutes and marked when already local. */
export const GET = withApiHandler(async (request) => {
    await requireApiRateLimit({ key: createIpRateLimitKey("external-book-search", await clientIp()), ...RATE_LIMITS.SEARCH });
    const { q } = parseQuery(request, externalBookSearchQuerySchema);
    return apiSuccess(await searchExternalCatalog(q));
});
