import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/features/auth/safe-next-path";

/** Set by the proxy on every request so server components know which page was asked for. */
export const REQUEST_PATH_HEADER = "x-temubaca-path";

/** Sends a guest to /login and back to the page they asked for after signing in. */
export async function redirectToLogin(): Promise<never> {
    const next = safeNextPath((await headers()).get(REQUEST_PATH_HEADER) ?? undefined);
    redirect(next && next !== "/login" ? `/login?next=${encodeURIComponent(next)}` : "/login");
}
