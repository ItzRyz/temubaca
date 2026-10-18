import "server-only";

import { ForbiddenError, UnauthorizedError } from "./errors";
import { getCurrentUser } from "@/lib/auth";
import { DELETION_PENDING_MESSAGE, SUSPENDED_ACCOUNT_MESSAGE } from "@/lib/auth/server";

export async function requireApiUser() {
    const user = await getCurrentUser();

    if (!user) {
        throw new UnauthorizedError();
    }
    // Suspended accounts may still sign in and read pages, but API calls that need a user are refused.
    if (user.suspendedAt) {
        throw new ForbiddenError(SUSPENDED_ACCOUNT_MESSAGE);
    }
    if (user.deletionRequestedAt) {
        throw new ForbiddenError(DELETION_PENDING_MESSAGE);
    }

    return user;
}

export async function getOptionalApiUser() {
    return getCurrentUser();
}
