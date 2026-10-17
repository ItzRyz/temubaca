import { apiSuccess, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { requireCommunityCapability } from "@/features/community-management/api";
import { updateCommunityProfile } from "@/lib/db/queries/community-management";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { communityIdSchema, communityProfileSchema } from "@/lib/validation/schemas/community-management.schema";

type RouteContext = { params: Promise<{ communityId: string }> };

/** Owner edits the public profile and contacts; live immediately for verified communities (DEC-05). */
export const PATCH = withApiHandler(async (request, context: RouteContext) => {
    const { communityId } = await parseParams(context.params, communityIdSchema);
    const { user } = await requireCommunityCapability(communityId, "editProfile");
    await requireApiRateLimit({ key: createUserRateLimitKey("community-write", user.id), ...RATE_LIMITS.WRITE });
    const input = await parseBody(request, communityProfileSchema);
    return apiSuccess(await updateCommunityProfile(communityId, input));
});
