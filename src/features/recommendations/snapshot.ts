import "server-only";

import { db } from "@/lib/db/client";

import { buildMlSnapshot } from "./snapshot-query";

export { genresForCategories, ML_SNAPSHOT_DEFAULT_LIMIT, ML_SNAPSHOT_MAX_LIMIT, ML_SNAPSHOT_VERSION } from "./snapshot-query";

/** TB-055 snapshot page for `GET /api/internal/ml/snapshot`, read through the app pool. */
export function getMlSnapshot(options: { cursor?: string; limit?: number } = {}) {
    return buildMlSnapshot(db, options);
}
