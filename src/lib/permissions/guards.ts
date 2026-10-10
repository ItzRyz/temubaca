import "server-only";

import { eq } from "drizzle-orm";

import {
    requireUser,
} from "@/lib/auth";

import { db } from "@/lib/db/client";

import {
    communities,
} from "@/lib/db/schema";

import {
    canManageCommunity,
    isBookListingOwner,
} from "./ownership";

import type {
    PlatformRole,
} from "./roles";

import {
    borrowRequests,
} from "@/lib/db/schema";
import { ForbiddenError } from "@/lib/api/errors";

export class PermissionError extends ForbiddenError {
    constructor(
        message = "You do not have permission to perform this action.",
    ) {
        super(message);
        this.name = "PermissionError";
    }
}

export async function requireAuthenticated() {
    return requireUser();
}

export async function requirePlatformRole(
    role: PlatformRole,
) {
    const user =
        await requireAuthenticated();

    if (user.role !== role) {
        throw new PermissionError();
    }

    return user;
}

export async function requireAdmin() {
    return requirePlatformRole(
        "ADMIN",
    );
}

export async function requireCommunityManager(
    communityId: string,
) {
    const user =
        await requireAuthenticated();

    const allowed =
        await canManageCommunity(
            user.id,
            communityId,
        );

    if (!allowed) {
        throw new PermissionError();
    }

    return user;
}

export async function requireCommunityOwner(
    communityId: string,
) {
    const user =
        await requireAuthenticated();

    const community =
        await db.query.communities.findFirst({
            where: eq(
                communities.id,
                communityId,
            ),

            columns: {
                id: true,
                ownerId: true,
            },
        });

    if (
        !community ||
        community.ownerId !== user.id
    ) {
        throw new PermissionError();
    }

    return user;
}

export async function requireBookListingOwner(
    listingId: string,
) {
    const user =
        await requireAuthenticated();

    const allowed =
        await isBookListingOwner(
            user.id,
            listingId,
        );

    if (!allowed) {
        throw new PermissionError();
    }

    return user;
}

export async function requireBorrowRequestRequester(
    requestId: string,
) {
    const user =
        await requireAuthenticated();

    const request =
        await db.query.borrowRequests.findFirst({
            where: eq(
                borrowRequests.id,
                requestId,
            ),

            columns: {
                id: true,
                requesterId: true,
            },
        });

    if (
        !request ||
        request.requesterId !== user.id
    ) {
        throw new PermissionError();
    }

    return user;
}

export async function requireBorrowRequestListingOwner(
    requestId: string,
) {
    const user =
        await requireAuthenticated();

    const request =
        await db.query.borrowRequests.findFirst({
            where: eq(
                borrowRequests.id,
                requestId,
            ),

            with: {
                listing: {
                    columns: {
                        ownerId: true,
                    },
                },
            },
        });

    if (
        !request ||
        request.listing.ownerId !==
        user.id
    ) {
        throw new PermissionError();
    }

    return user;
}
