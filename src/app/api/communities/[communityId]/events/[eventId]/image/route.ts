import { apiSuccess, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { readCommunityImage, requireCommunityCapability } from "@/features/community-management/api";
import { merchandisePhotoUrl } from "@/features/merchandise/format";
import { setCommunityEventImage } from "@/lib/db/queries/community-content";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { removeCommunityImages, uploadCommunityImage } from "@/lib/supabase/storage";
import { communityEventIdSchema } from "@/lib/validation/schemas/community-management.schema";

type RouteContext = { params: Promise<{ communityId: string; eventId: string }> };

async function authorize(context: RouteContext) {
    const { communityId, eventId } = await parseParams(context.params, communityEventIdSchema);
    const { user } = await requireCommunityCapability(communityId, "manageContent");
    await requireApiRateLimit({ key: createUserRateLimitKey("community-write", user.id), ...RATE_LIMITS.WRITE });
    return { communityId, eventId };
}

/** Sets the event image (29 Okt 2026): multipart field `file`, JPG/PNG/WebP up to 2 MB. The previous file is removed. */
export const PUT = withApiHandler(async (request, context: RouteContext) => {
    const { communityId, eventId } = await authorize(context);
    const file = await readCommunityImage(request, "Gambar acara");
    const path = await uploadCommunityImage(communityId, file, "event-");
    try {
        await setCommunityEventImage(communityId, eventId, path);
    } catch (error) {
        await removeCommunityImages([path]);
        throw error;
    }
    return apiSuccess({ path, url: merchandisePhotoUrl(path) });
});

export const DELETE = withApiHandler(async (_request, context: RouteContext) => {
    const { communityId, eventId } = await authorize(context);
    await setCommunityEventImage(communityId, eventId, null);
    return apiSuccess({ path: null });
});
