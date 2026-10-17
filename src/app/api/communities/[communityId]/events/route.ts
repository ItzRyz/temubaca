import { apiCreated, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { requireCommunityCapability } from "@/features/community-management/api";
import { createCommunityEvent } from "@/lib/db/queries/community-content";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { communityEventSchema, communityIdSchema } from "@/lib/validation/schemas/community-management.schema";

type RouteContext = { params: Promise<{ communityId: string }> };

export const POST = withApiHandler(async (request, context: RouteContext) => {
    const { communityId } = await parseParams(context.params, communityIdSchema);
    const { user } = await requireCommunityCapability(communityId, "manageContent");
    await requireApiRateLimit({ key: createUserRateLimitKey("community-write", user.id), ...RATE_LIMITS.WRITE });
    const input = await parseBody(request, communityEventSchema);
    return apiCreated(await createCommunityEvent(communityId, input));
});
