import { apiSuccess, parseBody, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { ConflictError, NotFoundError } from "@/lib/api/errors";
import { requireCommunityCapability } from "@/features/community-management/api";
import { findManagedEvent } from "@/lib/db/queries/community-content";
import { deleteEventPlace, upsertEventPlace } from "@/lib/db/queries/places";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { communityEventIdSchema } from "@/lib/validation/schemas/community-management.schema";
import { eventPlaceSchema } from "@/lib/validation/schemas/place.schema";

type RouteContext = { params: Promise<{ communityId: string; eventId: string }> };

async function authorize(context: RouteContext) {
    const { communityId, eventId } = await parseParams(context.params, communityEventIdSchema);
    const { user } = await requireCommunityCapability(communityId, "manageContent");
    await requireApiRateLimit({ key: createUserRateLimitKey("community-write", user.id), ...RATE_LIMITS.WRITE });
    const event = await findManagedEvent(communityId, eventId);
    if (!event) throw new NotFoundError("Acara tidak ditemukan.");
    return { user, event };
}

/**
 * Pins an in-person event's venue on the Peta Literasi (DEC-07 phase 2). It shows while the event is
 * published and not yet over, and an admin has not hidden it.
 */
export const PUT = withApiHandler(async (request, context: RouteContext) => {
    const { user, event } = await authorize(context);
    if (event.locationType !== "PHYSICAL") throw new ConflictError("Acara daring tidak punya titik di peta.");
    const input = await parseBody(request, eventPlaceSchema);
    return apiSuccess(await upsertEventPlace(event, input, user.id));
});

export const DELETE = withApiHandler(async (_request, context: RouteContext) => {
    const { event } = await authorize(context);
    return apiSuccess({ removed: await deleteEventPlace(event.id) });
});
