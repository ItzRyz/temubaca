import { apiCreated, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { requireCommunityCapability } from "@/features/community-management/api";
import { createManagerInvite } from "@/lib/db/queries/community-management";
import { createUserRateLimitKey } from "@/lib/rate-limit";
import { communityIdSchema } from "@/lib/validation/schemas/community-management.schema";

type RouteContext = { params: Promise<{ communityId: string }> };

/** One-time manager invite; the token is only in this response. */
export const POST = withApiHandler(async (_request, context: RouteContext) => {
    const { communityId } = await parseParams(context.params, communityIdSchema);
    const { user } = await requireCommunityCapability(communityId, "manageTeam");
    await requireApiRateLimit({ key: createUserRateLimitKey("community-invite", user.id), limit: 10, windowSeconds: 3600 });
    const invite = await createManagerInvite(communityId, user.id);
    return apiCreated({ id: invite.id, path: `/communities/invite/${invite.token}`, expiresAt: invite.expiresAt });
});
