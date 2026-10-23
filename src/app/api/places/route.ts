import { apiSuccess, parseQuery, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { clientIp } from "@/features/catalog/client-ip";
import { listPublicPlaces } from "@/lib/db/queries/places";
import { createIpRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { placesQuerySchema } from "@/lib/validation/schemas/place.schema";

/** Public places on the Peta Literasi (DEC-07). The reader's position is never sent here; distance is computed in the browser. */
export const GET = withApiHandler(async (request) => {
    await requireApiRateLimit({ key: createIpRateLimitKey("places-read", await clientIp()), ...RATE_LIMITS.READ });
    const filter = parseQuery(request, placesQuerySchema);
    return apiSuccess({ items: await listPublicPlaces(filter) });
});
