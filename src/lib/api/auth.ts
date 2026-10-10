import "server-only";

import { UnauthorizedError } from "./errors";
import { getCurrentUser } from "@/lib/auth";

export async function requireApiUser() {
    const user = await getCurrentUser();

    if (!user) {
        throw new UnauthorizedError();
    }

    return user;
}

export async function getOptionalApiUser() {
    return getCurrentUser();
}