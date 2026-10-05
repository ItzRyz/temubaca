import "server-only";

import {
    and,
    desc,
    eq,
    ilike,
} from "drizzle-orm";

import { db } from "../client";

import {
    communities,
    communityMemberships,
} from "../schema";

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
    const query = options?.query?.trim();

    return db
        .select()
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
            Math.max(
                options?.offset ?? 0,
                0,
            ),
        );
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