import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
    bookListings,
    communities,
    communityMemberships,
    merchandiseListings,
    events,
} from "@/lib/db/schema";
import { managesListing } from "@/lib/db/queries/listing-access";

/** The listing's owner, or for a community's copy, any manager of that community (30 Okt 2026). */
export async function isBookListingOwner(
    userId: string,
    listingId: string,
): Promise<boolean> {
    const listing =
        await db.query.bookListings.findFirst({
            where: eq(
                bookListings.id,
                listingId,
            ),

            columns: {
                ownerId: true,
                communityId: true,
            },
        });

    return listing !== undefined && managesListing(db, userId, listing);
}

export async function isCommunityOwner(
    userId: string,
    communityId: string,
): Promise<boolean> {
    const community =
        await db.query.communities.findFirst({
            where: and(
                eq(
                    communities.id,
                    communityId,
                ),
                eq(
                    communities.ownerId,
                    userId,
                ),
            ),

            columns: {
                id: true,
            },
        });

    return community !== undefined;
}

export async function isCommunityMember(
    userId: string,
    communityId: string,
): Promise<boolean> {
    const membership =
        await db.query.communityMemberships.findFirst({
            where: and(
                eq(
                    communityMemberships.userId,
                    userId,
                ),
                eq(
                    communityMemberships.communityId,
                    communityId,
                ),
                eq(
                    communityMemberships.status,
                    "ACTIVE",
                ),
            ),

            columns: {
                id: true,
            },
        });

    return membership !== undefined;
}

export async function canManageCommunity(
    userId: string,
    communityId: string,
): Promise<boolean> {
    const membership =
        await db.query.communityMemberships.findFirst({
            where: and(
                eq(
                    communityMemberships.userId,
                    userId,
                ),
                eq(
                    communityMemberships.communityId,
                    communityId,
                ),
                eq(
                    communityMemberships.status,
                    "ACTIVE",
                ),
            ),

            columns: {
                role: true,
            },
        });

    return (
        membership?.role === "OWNER" ||
        membership?.role === "MANAGER"
    );
}

export async function canManageEvent(
    userId: string,
    eventId: string,
): Promise<boolean> {
    const event =
        await db.query.events.findFirst({
            where: eq(
                events.id,
                eventId,
            ),

            columns: {
                communityId: true,
            },
        });

    if (!event) {
        return false;
    }

    return canManageCommunity(
        userId,
        event.communityId,
    );
}

export async function canManageMerchandise(
    userId: string,
    merchandiseId: string,
): Promise<boolean> {
    const merchandise =
        await db.query.merchandiseListings.findFirst({
            where: eq(
                merchandiseListings.id,
                merchandiseId,
            ),

            columns: {
                communityId: true,
            },
        });

    if (!merchandise) {
        return false;
    }

    return canManageCommunity(
        userId,
        merchandise.communityId,
    );
}