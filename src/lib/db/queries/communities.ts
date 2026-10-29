import "server-only";

import {
    and,
    asc,
    desc,
    eq,
    ilike,
    inArray,
    isNotNull,
    or,
    sql,
} from "drizzle-orm";

import { db } from "../client";

import {
    communities,
    communityMemberships,
    events,
    merchandiseListings,
    reports,
    userProfiles,
} from "../schema";

/** Public profile projection for a VERIFIED community; never loads members, owner, or private fields. */
export async function findPublicCommunityProfile(communityId: string) {
    const [community] = await db
        .select({
            id: communities.id,
            name: communities.name,
            logoPath: communities.logoPath,
            bannerPath: communities.bannerPath,
            instagramFollowers: communities.instagramFollowers,
            instagramCheckedAt: communities.instagramCheckedAt,
            description: communities.description,
            publicLocation: communities.publicLocation,
            regionCode: communities.regionCode,
            interests: communities.interests,
            contactEmail: communities.contactEmail,
            instagramHandle: communities.instagramHandle,
            whatsappNumber: communities.whatsappNumber,
            createdAt: communities.createdAt,
        })
        .from(communities)
        .where(and(eq(communities.id, communityId), eq(communities.status, "VERIFIED")))
        .limit(1);
    return community ?? null;
}

export async function findCommunityById(
    communityId: string,
) {
    return db.query.communities.findFirst({
        where: eq(
            communities.id,
            communityId,
        ),

        with: {
            owner: true,

            memberships: {
                with: {
                    user: true,
                },
            },

            events: {
                orderBy: (table, { asc }) => [
                    asc(table.startsAt),
                ],
            },

            merchandise: {
                orderBy: (table, { desc }) => [
                    desc(table.createdAt),
                ],
            },
        },
    });
}

export async function listCommunities(
    options?: {
        query?: string;
        limit?: number;
        offset?: number;
    },
) {
    const rawQuery = options?.query?.trim();
    const query = rawQuery?.replace(/[\\%_]/g, "\\$&");

    return db
        .select({
            id: communities.id,
            name: communities.name,
            logoPath: communities.logoPath,
            instagramHandle: communities.instagramHandle,
            instagramFollowers: communities.instagramFollowers,
            description: communities.description,
            publicLocation: communities.publicLocation,
            status: communities.status,
            createdAt: communities.createdAt,
            upcomingEventCount: sql<number>`(
                select count(*)::int from ${events}
                where "events"."communityId" = "communities"."id"
                and "events"."publicationStatus" = 'PUBLISHED'
                and "events"."startsAt" >= now()
            )`,
        })
        .from(communities)
        .where(
            and(
                eq(
                    communities.status,
                    "VERIFIED",
                ),

                query
                    ? ilike(
                        communities.name,
                        `%${query}%`,
                    )
                    : undefined,
            ),
        )
        .orderBy(
            desc(communities.createdAt),
        )
        .limit(
            Math.min(
                Math.max(options?.limit ?? 20, 1),
                100,
            ),
        )
        .offset(
            Math.max(options?.offset ?? 0, 0),
        );
}

export async function countPublicCommunities(query?: string) {
    const normalized = query?.trim().replace(/[\\%_]/g, "\\$&");
    const [result] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(communities)
        .where(and(
            eq(communities.status, "VERIFIED"),
            normalized ? ilike(communities.name, `%${normalized}%`) : undefined,
        ));
    return result?.total ?? 0;
}

export async function listOwnedCommunities(
    userId: string,
) {
    return db.query.communities.findMany({
        where: eq(
            communities.ownerId,
            userId,
        ),

        with: {
            memberships: true,
            events: true,
            merchandise: true,
        },

        orderBy: (table, { desc }) => [
            desc(table.createdAt),
        ],
    });
}

export async function findMembership(
    userId: string,
    communityId: string,
) {
    return db.query.communityMemberships.findFirst({
        where: and(
            eq(
                communityMemberships.userId,
                userId,
            ),

            eq(
                communityMemberships.communityId,
                communityId,
            ),
        ),

        with: {
            community: true,
            user: true,
        },
    });
}

export async function listCommunityMembers(
    communityId: string,
) {
    return db.query.communityMemberships.findMany({
        where: eq(
            communityMemberships.communityId,
            communityId,
        ),

        with: {
            user: true,
        },

        orderBy: (table, { asc }) => [
            asc(table.createdAt),
        ],
    });
}

export async function createCommunity(input: {
    ownerId: string;
    name: string;
    description?: string;
    publicLocation?: string;
}) {
    const [community] = await db
        .insert(communities)
        .values({
            ownerId: input.ownerId,
            name: input.name,
            description: input.description,
            publicLocation:
                input.publicLocation,
            status: "PENDING",
        })
        .returning();

    return community;
}

export async function updateCommunity(
    communityId: string,
    input: {
        name?: string;
        description?: string | null;
        publicLocation?: string | null;
    },
) {
    const [community] = await db
        .update(communities)
        .set({
            ...(input.name !== undefined
                ? {
                    name: input.name,
                }
                : {}),

            ...(input.description !== undefined
                ? {
                    description:
                        input.description,
                }
                : {}),

            ...(input.publicLocation !== undefined
                ? {
                    publicLocation:
                        input.publicLocation,
                }
                : {}),

            updatedAt: new Date(),
        })
        .where(
            eq(
                communities.id,
                communityId,
            ),
        )
        .returning();

    return community ?? null;
}

export async function createMembership(input: {
    userId: string;
    communityId: string;
    role?:
    | "OWNER"
    | "MANAGER"
    | "MEMBER";
}) {
    const [membership] = await db
        .insert(communityMemberships)
        .values({
            userId: input.userId,
            communityId:
                input.communityId,
            role: input.role ?? "MEMBER",
            status: "PENDING",
        })
        .returning();

    return membership;
}

export async function updateMembershipStatus(
    membershipId: string,
    status:
        | "PENDING"
        | "ACTIVE"
        | "REJECTED"
        | "LEFT"
        | "REMOVED",
) {
    const [membership] = await db
        .update(communityMemberships)
        .set({
            status,
            updatedAt: new Date(),
        })
        .where(
            eq(
                communityMemberships.id,
                membershipId,
            ),
        )
        .returning();

    return membership ?? null;
}

/** Communities where the user has an ACTIVE membership, with only the fields shown on their own profile. */
export async function listUserCommunities(userId: string, limit = 10) {
    return db
        .select({
            id: communities.id,
            name: communities.name,
            status: communities.status,
            role: communityMemberships.role,
        })
        .from(communityMemberships)
        .innerJoin(communities, eq(communityMemberships.communityId, communities.id))
        .where(and(eq(communityMemberships.userId, userId), eq(communityMemberships.status, "ACTIVE")))
        .orderBy(desc(communityMemberships.createdAt))
        .limit(Math.min(Math.max(limit, 1), 50));
}

/** Admin-only queue of community submissions by status, with the owner's display name. */
export async function listCommunitiesForReview(status: (typeof communities.$inferSelect)["status"], limit = 50) {
    return db
        .select({
            id: communities.id,
            name: communities.name,
            description: communities.description,
            publicLocation: communities.publicLocation,
            status: communities.status,
            createdAt: communities.createdAt,
            ownerName: userProfiles.displayName,
        })
        .from(communities)
        .innerJoin(userProfiles, eq(communities.ownerId, userProfiles.id))
        .where(eq(communities.status, status))
        .orderBy(desc(communities.createdAt))
        .limit(Math.min(Math.max(limit, 1), 100));
}

export async function countCommunitiesByStatus(status: (typeof communities.$inferSelect)["status"]) {
    const [result] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(communities)
        .where(eq(communities.status, status));
    return result?.total ?? 0;
}

type CommunityStatus = (typeof communities.$inferSelect)["status"];

/**
 * Admin directory of communities in every status, with content counts (Figma "Data Komunitas" 160:859).
 * Correlated subqueries use quoted, qualified names so they bind to the outer `communities` row.
 */
export async function listCommunitiesForAdmin(options: { status?: CommunityStatus; query?: string; region?: string; limit?: number } = {}) {
    const query = options.query?.trim().replace(/[\%_]/g, "\$&");

    return db
        .select({
            id: communities.id,
            name: communities.name,
            description: communities.description,
            publicLocation: communities.publicLocation,
            status: communities.status,
            createdAt: communities.createdAt,
            ownerId: communities.ownerId,
            ownerName: userProfiles.displayName,
            publishedEventCount: sql<number>`(
                select count(*)::int from ${events}
                where "events"."communityId" = "communities"."id"
                and "events"."publicationStatus" = 'PUBLISHED'
            )`,
            publishedMerchandiseCount: sql<number>`(
                select count(*)::int from ${merchandiseListings}
                where "merchandise_listings"."communityId" = "communities"."id"
                and "merchandise_listings"."status" = 'PUBLISHED'
            )`,
            reportCount: sql<number>`(
                select count(*)::int from ${reports}
                where "reports"."targetType" = 'COMMUNITY'
                and "reports"."targetId" = "communities"."id"
            )`,
        })
        .from(communities)
        .innerJoin(userProfiles, eq(communities.ownerId, userProfiles.id))
        .where(and(
            options.status ? eq(communities.status, options.status) : undefined,
            query ? or(ilike(communities.name, `%${query}%`), ilike(userProfiles.displayName, `%${query}%`)) : undefined,
            options.region ? eq(communities.publicLocation, options.region) : undefined,
        ))
        .orderBy(asc(communities.name))
        .limit(Math.min(Math.max(options.limit ?? 100, 1), 200));
}

/** Distinct public areas for the admin region filter. */
export async function listCommunityRegions() {
    const rows = await db
        .selectDistinct({ region: communities.publicLocation })
        .from(communities)
        .where(isNotNull(communities.publicLocation))
        .orderBy(asc(communities.publicLocation));
    return rows.map((row) => row.region).filter((region): region is string => Boolean(region?.trim()));
}

/** Owner plus ACTIVE managers of a community, for admin review only. */
export async function listCommunityManagers(communityId: string, ownerId: string) {
    const rows = await db
        .select({ userId: userProfiles.id, name: userProfiles.displayName, role: communityMemberships.role })
        .from(communityMemberships)
        .innerJoin(userProfiles, eq(communityMemberships.userId, userProfiles.id))
        .where(and(
            eq(communityMemberships.communityId, communityId),
            eq(communityMemberships.status, "ACTIVE"),
            inArray(communityMemberships.role, ["OWNER", "MANAGER"]),
        ))
        .orderBy(asc(userProfiles.displayName));

    const [owner] = await db
        .select({ userId: userProfiles.id, name: userProfiles.displayName })
        .from(userProfiles)
        .where(eq(userProfiles.id, ownerId));

    const others = rows.filter((row) => row.userId !== ownerId).map((row) => ({ ...row, role: "MANAGER" as const }));
    return owner ? [{ ...owner, role: "OWNER" as const }, ...others] : others;
}

/**
 * VERIFIED communities with interest tags and a kab/kota that the user neither owns nor has joined or
 * asked to join (TB-060). `ids` narrows the list to ML Service picks; without it this is the baseline pool.
 */
export async function listRecommendableCommunities(userId: string, ids?: string[]) {
    if (ids && ids.length === 0) return [];

    return db
        .select({
            id: communities.id,
            name: communities.name,
            logoPath: communities.logoPath,
            instagramHandle: communities.instagramHandle,
            instagramFollowers: communities.instagramFollowers,
            description: communities.description,
            publicLocation: communities.publicLocation,
            regionCode: communities.regionCode,
            interests: communities.interests,
            upcomingEventCount: sql<number>`(
                select count(*)::int from ${events}
                where "events"."communityId" = "communities"."id"
                and "events"."publicationStatus" = 'PUBLISHED'
                and "events"."startsAt" >= now()
            )`,
        })
        .from(communities)
        .where(and(
            eq(communities.status, "VERIFIED"),
            isNotNull(communities.regionCode),
            sql`cardinality(${communities.interests}) > 0`,
            sql`${communities.ownerId} <> ${userId}`,
            sql`not exists (
                select 1 from ${communityMemberships}
                where "community_memberships"."communityId" = "communities"."id"
                and "community_memberships"."userId" = ${userId}
                and "community_memberships"."status" in ('PENDING', 'ACTIVE')
            )`,
            ids ? inArray(communities.id, ids) : undefined,
        ))
        .orderBy(asc(communities.id))
        .limit(500);
}

/** Stores a fresh follower count (null when unknown) with the time it was checked. */
export async function saveInstagramFollowers(communityId: string, handle: string, followers: number | null) {
    // Only for the handle that was asked; a handle changed meanwhile keeps its own (cleared) cache.
    await db.update(communities)
        .set({ instagramFollowers: followers, instagramCheckedAt: new Date() })
        .where(and(eq(communities.id, communityId), eq(communities.instagramHandle, handle)));
}
