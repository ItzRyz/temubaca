import { apiSuccess, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { requireCommunityCapability } from "@/features/community-management/api";
import { deleteCommunityPlace, upsertCommunityPlace } from "@/lib/db/queries/places";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { communityIdSchema } from "@/lib/validation/schemas/community-management.schema";
import { communityPlaceSchema } from "@/lib/validation/schemas/place.schema";

type RouteContext = { params: Promise<{ communityId: string }> };

/**
 * The owner pins the community's public meeting place on the Peta Literasi (DEC-07). It shows on the
 * map only while the community is VERIFIED and an admin has not hidden it.
 */
export const PUT = withApiHandler(async (request, context: RouteContext) => {
    const { communityId } = await parseParams(context.params, communityIdSchema);
    const { user, community } = await requireCommunityCapability(communityId, "editProfile");
    await requireApiRateLimit({ key: createUserRateLimitKey("community-write", user.id), ...RATE_LIMITS.WRITE });
    const input = await parseBody(request, communityPlaceSchema);
    return apiSuccess(await upsertCommunityPlace(community, input, user.id));
});

/** Remove the pin; the community stays listed without a map point. */
export const DELETE = withApiHandler(async (_request, context: RouteContext) => {
    const { communityId } = await parseParams(context.params, communityIdSchema);
    const { user } = await requireCommunityCapability(communityId, "editProfile");
    await requireApiRateLimit({ key: createUserRateLimitKey("community-write", user.id), ...RATE_LIMITS.WRITE });
    return apiSuccess({ removed: await deleteCommunityPlace(communityId) });
});
