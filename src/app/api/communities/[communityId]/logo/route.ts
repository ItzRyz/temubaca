import { apiSuccess, BadRequestError, parseParams, PayloadTooLargeError, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { requireCommunityCapability } from "@/features/community-management/api";
import { merchPhotoError, MERCH_PHOTO_MAX_BYTES } from "@/features/community-management/rules";
import { merchandisePhotoUrl } from "@/features/merchandise/format";
import { setCommunityLogo } from "@/lib/db/queries/community-management";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { isEvidenceStorageAvailable, removeCommunityImages, uploadCommunityLogo } from "@/lib/supabase/storage";
import { communityIdSchema } from "@/lib/validation/schemas/community-management.schema";

type RouteContext = { params: Promise<{ communityId: string }> };

/**
 * Sets the community logo (TB-030): multipart field `file`, JPG/PNG/WebP up to 2 MB, the same rules as
 * merchandise photos. The previous logo file is removed. Owner only, like the rest of the profile.
 */
export const PUT = withApiHandler(async (request, context: RouteContext) => {
    const { communityId } = await parseParams(context.params, communityIdSchema);
    const { user } = await requireCommunityCapability(communityId, "editProfile");
    await requireApiRateLimit({ key: createUserRateLimitKey("community-logo", user.id), ...RATE_LIMITS.WRITE });

    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MERCH_PHOTO_MAX_BYTES + 64 * 1024) throw new PayloadTooLargeError("Ukuran logo maksimal 2 MB.");
    let file: FormDataEntryValue | null;
    try {
        file = (await request.formData()).get("file");
    } catch {
        throw new BadRequestError("Formulir tidak dapat dibaca.");
    }
    if (!(file instanceof File)) throw new BadRequestError("Pilih logo untuk diunggah.");
    const problem = merchPhotoError(file, "Logo");
    if (problem) throw new BadRequestError(problem);
    if (!isEvidenceStorageAvailable()) throw new BadRequestError("Unggah logo belum tersedia di server ini.");

    const path = await uploadCommunityLogo(communityId, file);
    try {
        await setCommunityLogo(communityId, path);
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
    await setCommunityLogo(communityId, null);
    return apiSuccess({ path: null });
});
