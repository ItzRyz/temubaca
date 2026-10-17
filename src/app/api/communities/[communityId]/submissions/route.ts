import { apiCreated, parseParams, requireApiRateLimit, withApiHandler } from "@/lib/api";
import { parseEvidenceForm, requireCommunityCapability, storeEvidenceFile } from "@/features/community-management/api";
import { createVerificationSubmission } from "@/lib/db/queries/community-management";
import { createUserRateLimitKey } from "@/lib/rate-limit";
import { removeEvidenceFile } from "@/lib/supabase/storage";
import { communityIdSchema, verificationSubmissionSchema } from "@/lib/validation/schemas/community-management.schema";

type RouteContext = { params: Promise<{ communityId: string }> };

/** "Ajukan Pembaruan Verifikasi", or a new attempt after rejection. */
export const POST = withApiHandler(async (request, context: RouteContext) => {
    const { communityId } = await parseParams(context.params, communityIdSchema);
    const { user } = await requireCommunityCapability(communityId, "submitVerification");
    await requireApiRateLimit({ key: createUserRateLimitKey("community-apply", user.id), limit: 5, windowSeconds: 3600 });
    const { input, file } = await parseEvidenceForm(request, verificationSubmissionSchema);
    const stored = await storeEvidenceFile(communityId, file);
    try {
        return apiCreated(await createVerificationSubmission(communityId, user.id, input, stored));
    } catch (error) {
        if (stored) await removeEvidenceFile(stored.path).catch(() => undefined);
        throw error;
    }
});
