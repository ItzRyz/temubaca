import "server-only";

import { eq } from "drizzle-orm";

import { db } from "../client";
import {
    userProfiles,
    bookListings,
} from "../schema";

export async function findUserById(
    userId: string,
) {
    return db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, userId),
    });
}

export async function findUserWithRelations(
    userId: string,
) {
    return db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, userId),

        with: {
            bookmarks: {
                with: {
                    book: true,
                },
            },

            interests: true,

            bookListings: {
                with: {
                    book: true,
                },
            },

            ownedCommunities: true,

            memberships: {
                with: {
                    community: true,
                },
            },

            recommendations: true,
        },
    });
}

export async function findUserBookmarks(
    userId: string,
) {
    return db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, userId),

        with: {
            bookmarks: {
                with: {
                    book: true,
                },
            },
        },
    });
}

export async function findUserInterests(
    userId: string,
) {
    return db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, userId),

        with: {
            interests: true,
        },
    });
}

export async function findUserCommunities(
    userId: string,
) {
    return db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, userId),

        with: {
            ownedCommunities: true,

            memberships: {
                with: {
                    community: true,
                },
            },
        },
    });
}

export async function findUserBookListings(
    userId: string,
) {
    return db.query.bookListings.findMany({
        where: eq(bookListings.ownerId, userId),

        with: {
            book: true,
            requests: true,
        },

        orderBy: (table, { desc }) => [
            desc(table.createdAt),
        ],
    });
}

export async function createUserProfile(input: {
    id: string;
    displayName: string;
}) {
    const [user] = await db
        .insert(userProfiles)
        .values({
            id: input.id,
            displayName: input.displayName,
            role: "MEMBER",
            preferences: {},
        })
        .returning();

    return user;
}

export async function updateUserProfile(
    userId: string,
    input: {
        displayName?: string;
        preferences?: Record<string, unknown>;
    },
) {
    const [user] = await db
        .update(userProfiles)
        .set({
            ...(input.displayName !== undefined
                ? {
                    displayName: input.displayName,
                }
                : {}),

            ...(input.preferences !== undefined
                ? {
                    preferences: input.preferences,
                }
                : {}),

            updatedAt: new Date(),
        })
        .where(eq(userProfiles.id, userId))
        .returning();

    return user ?? null;
}