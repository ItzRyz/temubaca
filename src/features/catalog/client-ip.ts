import "server-only";

import { headers } from "next/headers";

/** Best-effort client address for anonymous rate limits; the first hop set by the platform proxy. */
export async function clientIp() {
    const list = await headers();
    return list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip")?.trim() || "unknown";
}
