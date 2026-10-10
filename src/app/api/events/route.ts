import { apiSuccess, createPaginationMeta, parseQuery, withApiHandler } from "@/lib/api";
import { countUpcomingPublicEvents, listUpcomingPublicEvents } from "@/lib/db/queries/events";
import { publicEventQuerySchema } from "@/lib/validation/schemas/public-catalog.schema";

export const GET = withApiHandler(async (request) => {
    const query = parseQuery(request, publicEventQuerySchema);
    const offset = (query.page - 1) * query.limit;
    const now = new Date();
    const [events, total] = await Promise.all([
        listUpcomingPublicEvents({ limit: query.limit, offset, now }),
        countUpcomingPublicEvents(now),
    ]);
    return apiSuccess(events, 200, createPaginationMeta(query.page, query.limit, total));
});
