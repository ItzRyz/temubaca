import { apiSuccess, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { requireCommunityCapability } from "@/features/community-management/api";
import { deleteCommunityMerchandise, updateCommunityMerchandise } from "@/lib/db/queries/community-content";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { communityMerchandiseIdSchema, communityMerchandiseSchema } from "@/lib/validation/schemas/community-management.schema";

type RouteContext = { params: Promise<{ communityId: string; itemId: string }> };

async function authorize(context: RouteContext) {
    const { communityId, itemId } = await parseParams(context.params, communityMerchandiseIdSchema);
    const { user } = await requireCommunityCapability(communityId, "manageContent");
    await requireApiRateLimit({ key: createUserRateLimitKey("community-write", user.id), ...RATE_LIMITS.WRITE });
    return { communityId, itemId };
}

export const PUT = withApiHandler(async (request, context: RouteContext) => {
    const { communityId, itemId } = await authorize(context);
    const input = await parseBody(request, communityMerchandiseSchema);
    return apiSuccess(await updateCommunityMerchandise(communityId, itemId, input));
});

export const DELETE = withApiHandler(async (_request, context: RouteContext) => {
    const { communityId, itemId } = await authorize(context);
    return apiSuccess(await deleteCommunityMerchandise(communityId, itemId));
});
