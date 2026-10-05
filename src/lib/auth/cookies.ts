import "server-only";

import { cookies } from "next/headers";

const AUTH_COOKIE_PREFIX = "sb-";

export async function getAuthCookies() {
    const cookieStore = await cookies();

    return cookieStore
        .getAll()
        .filter((cookie) => cookie.name.startsWith(AUTH_COOKIE_PREFIX));
}

export async function hasAuthCookies(): Promise<boolean> {
    const authCookies = await getAuthCookies();

    return authCookies.length > 0;
}