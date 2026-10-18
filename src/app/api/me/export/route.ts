import { NextResponse } from "next/server";

import { requireApiRateLimit, UnauthorizedError, withApiHandler } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { exportUserData } from "@/lib/db/queries/account-deletion";
import { createUserRateLimitKey } from "@/lib/rate-limit";

/** "Unduh salinan data saya" (DEC-11): JSON download, 3 per hour; also allowed during the grace period. */
export const GET = withApiHandler(async () => {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    await requireApiRateLimit({ key: createUserRateLimitKey("data-export", user.id), limit: 3, windowSeconds: 3600 });
    const data = await exportUserData(user.id);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
            "content-type": "application/json; charset=utf-8",
            "content-disposition": `attachment; filename="temubaca-data-${stamp}.json"`,
            "cache-control": "no-store",
        },
    });
});
