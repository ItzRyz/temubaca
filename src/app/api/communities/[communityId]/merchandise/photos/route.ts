import { apiCreated, BadRequestError, parseParams, PayloadTooLargeError, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { requireCommunityCapability } from "@/features/community-management/api";
import { merchPhotoError, MERCH_PHOTO_MAX_BYTES } from "@/features/community-management/rules";
import { merchandisePhotoUrl } from "@/features/merchandise/format";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { isEvidenceStorageAvailable, uploadMerchandisePhoto } from "@/lib/supabase/storage";
import { communityIdSchema } from "@/lib/validation/schemas/community-management.schema";

type RouteContext = { params: Promise<{ communityId: string }> };

/**
 * Uploads one merchandise photo (multipart field `file`, JPG/PNG/WebP up to 2 MB) and returns its path.
 * The photo only shows on an item once the item is saved with that path (DEC-12).
 */
export const POST = withApiHandler(async (request, context: RouteContext) => {
    const { communityId } = await parseParams(context.params, communityIdSchema);
    const { user } = await requireCommunityCapability(communityId, "manageContent");
    await requireApiRateLimit({ key: createUserRateLimitKey("merch-photo", user.id), ...RATE_LIMITS.WRITE });

    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MERCH_PHOTO_MAX_BYTES + 64 * 1024) throw new PayloadTooLargeError("Ukuran foto maksimal 2 MB.");
    let file: FormDataEntryValue | null;
    try {
        file = (await request.formData()).get("file");
    } catch {
        throw new BadRequestError("Formulir tidak dapat dibaca.");
    }
    if (!(file instanceof File)) throw new BadRequestError("Pilih foto untuk diunggah.");
    const problem = merchPhotoError(file);
    if (problem) throw new BadRequestError(problem);
    if (!isEvidenceStorageAvailable()) throw new BadRequestError("Unggah foto belum tersedia di server ini.");

    const path = await uploadMerchandisePhoto(communityId, file);
    return apiCreated({ path, url: merchandisePhotoUrl(path) });
});
