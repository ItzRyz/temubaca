import { apiCreated, apiSuccess, createPaginationMeta, parseQuery, requireApiRateLimit, requireApiUser, withApiHandler } from "@/lib/api";
import { parseEvidenceForm, storeEvidenceFile } from "@/features/community-management/api";
import { countPublicCommunities, listCommunities } from "@/lib/db/queries/communities";
import { createCommunityApplication } from "@/lib/db/queries/community-management";
import { createUserRateLimitKey } from "@/lib/rate-limit";
import { removeEvidenceFile } from "@/lib/supabase/storage";
import { communityApplicationSchema } from "@/lib/validation/schemas/community-management.schema";
import { publicCommunityQuerySchema } from "@/lib/validation/schemas/public-catalog.schema";

export const GET = withApiHandler(async (request) => {
    const query = parseQuery(request, publicCommunityQuerySchema);
    const offset = (query.page - 1) * query.limit;
    const [communities, total] = await Promise.all([
        listCommunities({ query: query.q, limit: query.limit, offset }),
        countPublicCommunities(query.q),
    ]);
    return apiSuccess(communities, 200, createPaginationMeta(query.page, query.limit, total));
});

/** Apply for a community (DEC-04): multipart profile + evidence link, optional note and file. */
export const POST = withApiHandler(async (request) => {
    const user = await requireApiUser();
    await requireApiRateLimit({ key: createUserRateLimitKey("community-apply", user.id), limit: 5, windowSeconds: 3600 });
    const { input, file } = await parseEvidenceForm(request, communityApplicationSchema);
    const stored = await storeEvidenceFile(`applications/${user.id}`, file);
    try {
        const community = await createCommunityApplication(user.id, input, stored);
        return apiCreated({ id: community.id, status: "PENDING" });
    } catch (error) {
        if (stored) await removeEvidenceFile(stored.path).catch(() => undefined);
        throw error;
    }
});
