import { apiSuccess, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { requireCommunityCapability } from "@/features/community-management/api";
import { removeCommunityManager } from "@/lib/db/queries/community-management";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { managerIdSchema } from "@/lib/validation/schemas/community-management.schema";

type RouteContext = { params: Promise<{ communityId: string; userId: string }> };

export const DELETE = withApiHandler(async (_request, context: RouteContext) => {
    const { communityId, userId } = await parseParams(context.params, managerIdSchema);
    const { user } = await requireCommunityCapability(communityId, "manageTeam");
    await requireApiRateLimit({ key: createUserRateLimitKey("community-write", user.id), ...RATE_LIMITS.WRITE });
    return apiSuccess(await removeCommunityManager(communityId, userId));
});
