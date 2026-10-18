import { timingSafeEqual } from "node:crypto";

import { env } from "@/env";
import { apiSuccess, NotFoundError, UnauthorizedError, withApiHandler } from "@/lib/api";
import { runRetention } from "@/features/account-deletion/retention";

function matches(header: string | null, secret: string) {
    const given = Buffer.from(header ?? "");
    const expected = Buffer.from(`Bearer ${secret}`);
    return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily DEC-11 retention for a scheduler (cron) with `Authorization: Bearer $INTERNAL_API_SECRET`.
 * Hidden (404) when the secret is not configured. The scheduler itself depends on hosting (DEC-01).
 */
export const POST = withApiHandler(async (request) => {
    if (!env.INTERNAL_API_SECRET) throw new NotFoundError();
    if (!matches(request.headers.get("authorization"), env.INTERNAL_API_SECRET)) throw new UnauthorizedError();
    return apiSuccess(await runRetention(null));
});
