import { timingSafeEqual } from "node:crypto";

import { env } from "@/env";
import { apiSuccess, NotFoundError, UnauthorizedError, withApiHandler } from "@/lib/api";
import { runRetention } from "@/features/account-deletion/retention";
import { resyncStaleBooks } from "@/features/catalog/sync-book";

// The job can touch many rows; give it more than the platform's default function timeout.
export const maxDuration = 60;

function matches(header: string | null, secret: string) {
    const given = Buffer.from(header ?? "");
    const expected = Buffer.from(`Bearer ${secret}`);
    return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily DEC-11 retention for a scheduler with `Authorization: Bearer $INTERNAL_API_SECRET`.
 * Hidden (404) when the secret is not configured.
 */
export const POST = withApiHandler(async (request) => {
    if (!env.INTERNAL_API_SECRET) throw new NotFoundError();
    if (!matches(request.headers.get("authorization"), env.INTERNAL_API_SECRET)) throw new UnauthorizedError();
    return apiSuccess(await runRetention(null));
});

/**
 * Vercel Cron (DEC-01, `vercel.json`) calls GET with `Authorization: Bearer $CRON_SECRET`. Hidden without it.
 * After retention it refreshes a few stale catalog records (DEC-06); the Hobby plan allows only daily
 * crons, so both jobs share this one. A catalog failure never hides the retention result.
 */
export const GET = withApiHandler(async (request) => {
    if (!env.CRON_SECRET) throw new NotFoundError();
    if (!matches(request.headers.get("authorization"), env.CRON_SECRET)) throw new UnauthorizedError();
    const retention = await runRetention(null);
    const catalog = await resyncStaleBooks().catch(() => null);
    return apiSuccess({ ...retention, catalog });
});
