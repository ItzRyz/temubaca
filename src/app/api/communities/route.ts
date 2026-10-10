import { apiSuccess, createPaginationMeta, parseQuery, withApiHandler } from "@/lib/api";
import { countPublicCommunities, listCommunities } from "@/lib/db/queries/communities";
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
