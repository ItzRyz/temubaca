import { z } from "zod";

import { apiSuccess, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { requireCommunityCapability } from "@/features/community-management/api";
import { transferCommunityOwnership } from "@/lib/db/queries/community-management";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/validation/common";
import { communityIdSchema } from "@/lib/validation/schemas/community-management.schema";

type RouteContext = { params: Promise<{ communityId: string }> };

/** Hand the community to an active manager; the caller becomes a manager. */
export const POST = withApiHandler(async (request, context: RouteContext) => {
    const { communityId } = await parseParams(context.params, communityIdSchema);
    const { user } = await requireCommunityCapability(communityId, "manageTeam");
    await requireApiRateLimit({ key: createUserRateLimitKey("community-write", user.id), ...RATE_LIMITS.WRITE });
    const { userId } = await parseBody(request, z.object({ userId: uuidSchema }).strict());
    return apiSuccess(await transferCommunityOwnership(communityId, user.id, userId));
});
