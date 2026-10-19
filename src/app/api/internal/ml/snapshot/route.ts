import { z } from "zod";

import { env } from "@/env";
import { apiSuccess, NotFoundError, parseQuery, requireApiRateLimit, UnauthorizedError, withApiHandler } from "@/lib/api";
import { matchesBearer } from "@/lib/api/bearer";
import { getMlSnapshot, ML_SNAPSHOT_DEFAULT_LIMIT, ML_SNAPSHOT_MAX_LIMIT } from "@/features/recommendations/snapshot";

const snapshotQuerySchema = z.object({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(ML_SNAPSHOT_MAX_LIMIT).default(ML_SNAPSHOT_DEFAULT_LIMIT),
});

/**
 * Public catalog snapshot for training the ML Service (DEC-08, ML-02), called server to server with
 * `Authorization: Bearer $ML_SNAPSHOT_SECRET`. Hidden (404) when the secret is not configured.
 */
export const GET = withApiHandler(async (request) => {
    if (!env.ML_SNAPSHOT_SECRET) throw new NotFoundError();
    if (!matchesBearer(request.headers.get("authorization"), env.ML_SNAPSHOT_SECRET)) throw new UnauthorizedError();
    await requireApiRateLimit({ key: "internal:ml-snapshot", limit: 10, windowSeconds: 60 });

    const response = apiSuccess(await getMlSnapshot(parseQuery(request, snapshotQuerySchema)));
    response.headers.set("Cache-Control", "no-store");
    return response;
});
