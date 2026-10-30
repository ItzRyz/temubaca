import "server-only";

import { and, eq, sql, type AnyColumn } from "drizzle-orm";

import { db } from "../client";
import { communities, communityMemberships } from "../schema";

type Executor = Pick<typeof db, "select">;

/**
 * Who stands behind a listing (community collections, 30 Okt 2026): its owner for a personal copy;
 * for a community's copy, the owner or any active manager of that community while it is verified.
 */

/** Communities whose collection `userId` may manage: owned or managed, and verified. */
export function managedCommunityIdsSql(userId: string) {
    return sql`(select "communities"."id" from "communities" where "communities"."status" = 'VERIFIED' and (
        "communities"."ownerId" = ${userId}
        or "communities"."id" in (
            select "community_memberships"."communityId" from "community_memberships"
            where "community_memberships"."userId" = ${userId} and "community_memberships"."role" = 'MANAGER' and "community_memberships"."status" = 'ACTIVE'
        )
    ))`;
}

/** For WHERE clauses only (column refs are qualified there): `userId` may act as the listing's owner. */
export function listingManagedBy(userId: string, ownerId: AnyColumn, communityId: AnyColumn) {
    return sql`((${communityId} is null and ${ownerId} = ${userId}) or ${communityId} in ${managedCommunityIdsSql(userId)})`;
}

/**
 * For WHERE clauses: the listing may appear in public. A personal copy hides while its owner is suspended or
 * leaving (DEC-11); a community's copy shows only while the community is verified.
 */
export function listingVisible(ownerId: AnyColumn, communityId: AnyColumn) {
    return sql`((${communityId} is null and ${ownerId} not in (select "user_profiles"."id" from "user_profiles" where "user_profiles"."suspendedAt" is not null or "user_profiles"."deletionRequestedAt" is not null))
        or ${communityId} in (select "communities"."id" from "communities" where "communities"."status" = 'VERIFIED'))`;
}

/** Whether `userId` is the owner or an active manager of the verified community. */
export async function managesCommunityCollection(executor: Executor, userId: string, communityId: string) {
    const [community] = await executor.select({ ownerId: communities.ownerId, status: communities.status }).from(communities).where(eq(communities.id, communityId));
    if (!community || community.status !== "VERIFIED") return false;
    if (community.ownerId === userId) return true;
    const [membership] = await executor.select({ id: communityMemberships.id }).from(communityMemberships)
        .where(and(eq(communityMemberships.communityId, communityId), eq(communityMemberships.userId, userId), eq(communityMemberships.role, "MANAGER"), eq(communityMemberships.status, "ACTIVE")));
    return Boolean(membership);
}

/** Whether `userId` may act as the owner of this listing. */
export async function managesListing(executor: Executor, userId: string, listing: { ownerId: string; communityId: string | null }) {
    return listing.communityId ? managesCommunityCollection(executor, userId, listing.communityId) : listing.ownerId === userId;
}
