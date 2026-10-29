import { apiSuccess, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { readCommunityImage, requireCommunityCapability } from "@/features/community-management/api";
import { merchandisePhotoUrl } from "@/features/merchandise/format";
import { setCommunityImage } from "@/lib/db/queries/community-management";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { removeCommunityImages, uploadCommunityImage } from "@/lib/supabase/storage";
import { communityIdSchema } from "@/lib/validation/schemas/community-management.schema";

type RouteContext = { params: Promise<{ communityId: string }> };

/**
 * Sets the community profile banner (29 Okt 2026): multipart field `file`, JPG/PNG/WebP up to 2 MB, the same rules as
 * merchandise photos. The previous file is removed. Owner only, like the rest of the profile.
 */
export const PUT = withApiHandler(async (request, context: RouteContext) => {
    const { communityId } = await parseParams(context.params, communityIdSchema);
    const { user } = await requireCommunityCapability(communityId, "editProfile");
    await requireApiRateLimit({ key: createUserRateLimitKey("community-banner", user.id), ...RATE_LIMITS.WRITE });
    const file = await readCommunityImage(request, "Banner");

    const path = await uploadCommunityImage(communityId, file, "banner-");
    try {
        await setCommunityImage(communityId, "bannerPath", path);
    } catch (error) {
        await removeCommunityImages([path]);
        throw error;
    }
    return apiSuccess({ path, url: merchandisePhotoUrl(path) });
});

/** Removes the banner; the profile falls back to the brand gradient. */
export const DELETE = withApiHandler(async (_request, context: RouteContext) => {
    const { communityId } = await parseParams(context.params, communityIdSchema);
    const { user } = await requireCommunityCapability(communityId, "editProfile");
    await requireApiRateLimit({ key: createUserRateLimitKey("community-banner", user.id), ...RATE_LIMITS.WRITE });
    await setCommunityImage(communityId, "bannerPath", null);
    return apiSuccess({ path: null });
});
