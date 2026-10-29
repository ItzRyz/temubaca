import { apiSuccess, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { readCommunityImage, requireCommunityCapability } from "@/features/community-management/api";
import { merchandisePhotoUrl } from "@/features/merchandise/format";
import { setCommunityImage } from "@/lib/db/queries/community-management";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { removeCommunityImages, uploadCommunityImage } from "@/lib/supabase/storage";
import { communityIdSchema } from "@/lib/validation/schemas/community-management.schema";

type RouteContext = { params: Promise<{ communityId: string }> };

/**
 * Sets the community logo (TB-030): multipart field `file`, JPG/PNG/WebP up to 2 MB, the same rules as
 * merchandise photos. The previous file is removed. Owner only, like the rest of the profile.
 */
export const PUT = withApiHandler(async (request, context: RouteContext) => {
    const { communityId } = await parseParams(context.params, communityIdSchema);
    const { user } = await requireCommunityCapability(communityId, "editProfile");
    await requireApiRateLimit({ key: createUserRateLimitKey("community-logo", user.id), ...RATE_LIMITS.WRITE });
    const file = await readCommunityImage(request, "Logo");

    const path = await uploadCommunityImage(communityId, file, "logo-");
    try {
        await setCommunityImage(communityId, "logoPath", path);
    } catch (error) {
        await removeCommunityImages([path]);
        throw error;
    }
    return apiSuccess({ path, url: merchandisePhotoUrl(path) });
});

/** Removes the logo; the profile falls back to the community's initials. */
export const DELETE = withApiHandler(async (_request, context: RouteContext) => {
    const { communityId } = await parseParams(context.params, communityIdSchema);
    const { user } = await requireCommunityCapability(communityId, "editProfile");
    await requireApiRateLimit({ key: createUserRateLimitKey("community-logo", user.id), ...RATE_LIMITS.WRITE });
    await setCommunityImage(communityId, "logoPath", null);
    return apiSuccess({ path: null });
});
