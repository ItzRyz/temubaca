import { apiCreated, apiSuccess, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { requireCommunityCapability } from "@/features/community-management/api";
import { archiveCommunityEvent, deleteCommunityEvent, duplicateCommunityEvent, updateCommunityEvent } from "@/lib/db/queries/community-content";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { communityEventIdSchema, communityEventSchema, eventStatusActionSchema } from "@/lib/validation/schemas/community-management.schema";

type RouteContext = { params: Promise<{ communityId: string; eventId: string }> };

async function authorize(context: RouteContext) {
    const { communityId, eventId } = await parseParams(context.params, communityEventIdSchema);
    const { user } = await requireCommunityCapability(communityId, "manageContent");
    await requireApiRateLimit({ key: createUserRateLimitKey("community-write", user.id), ...RATE_LIMITS.WRITE });
    return { communityId, eventId };
}

export const PUT = withApiHandler(async (request, context: RouteContext) => {
    const { communityId, eventId } = await authorize(context);
    const input = await parseBody(request, communityEventSchema);
    return apiSuccess(await updateCommunityEvent(communityId, eventId, input));
});

/** `archive` hides an event from public pages; `duplicate` copies it into a new draft. */
export const POST = withApiHandler(async (request, context: RouteContext) => {
    const { communityId, eventId } = await authorize(context);
    const { action } = await parseBody(request, eventStatusActionSchema);
    if (action === "duplicate") return apiCreated(await duplicateCommunityEvent(communityId, eventId));
    return apiSuccess(await archiveCommunityEvent(communityId, eventId));
});

export const DELETE = withApiHandler(async (_request, context: RouteContext) => {
    const { communityId, eventId } = await authorize(context);
    return apiSuccess(await deleteCommunityEvent(communityId, eventId));
});
