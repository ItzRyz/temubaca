import { apiSuccess, createPaginationMeta, parseQuery, withApiHandler } from "@/lib/api";
import { countPublicMerchandise, listPublicMerchandise } from "@/lib/db/queries/merchandise";
import { publicEventQuerySchema } from "@/lib/validation/schemas/public-catalog.schema";

export const GET = withApiHandler(async (request) => {
    const query = parseQuery(request, publicEventQuerySchema);
    const offset = (query.page - 1) * query.limit;
    const [listings, total] = await Promise.all([
        listPublicMerchandise({ limit: query.limit, offset }),
        countPublicMerchandise(),
    ]);
    return apiSuccess(listings, 200, createPaginationMeta(query.page, query.limit, total));
});
