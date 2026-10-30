import "server-only";

import { eq, sql } from "drizzle-orm";

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
        regionCode?: string | null;
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

            ...(input.regionCode !== undefined
                ? {
                    regionCode: input.regionCode,
                }
                : {}),

            updatedAt: new Date(),
        })
        .where(eq(userProfiles.id, userId))
        .returning();

    return user ?? null;
}
/** Adds `tourSeenAt` to the profile preferences without touching the other keys; repeating it is harmless. */
export async function markTourSeen(userId: string) {
    await db.update(userProfiles)
        .set({ preferences: sql`coalesce(${userProfiles.preferences}, '{}'::jsonb) || jsonb_build_object('tourSeenAt', coalesce(${userProfiles.preferences}->>'tourSeenAt', now()::text))` })
        .where(eq(userProfiles.id, userId));
}

/** Records that the reader opened their loans (`preferences.loansSeenAt`), which clears the "kabar baru" dot. */
export async function markLoansSeen(userId: string, now = new Date()) {
    await db.update(userProfiles)
        .set({ preferences: sql`coalesce(${userProfiles.preferences}, '{}'::jsonb) || jsonb_build_object('loansSeenAt', ${now.toISOString()}::text)` })
        .where(eq(userProfiles.id, userId));
}

/** When the reader last opened their loans; never opened counts the last 14 days as new. */
export function loansSeenAt(preferences: unknown, now = new Date()) {
    const value = preferences && typeof preferences === "object" && "loansSeenAt" in preferences ? (preferences as { loansSeenAt: unknown }).loansSeenAt : null;
    const at = typeof value === "string" ? new Date(value) : null;
    return at && !Number.isNaN(at.getTime()) ? at : new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
}

/** Whether the account has seen "Panduan TemuBaca" (`preferences.tourSeenAt`). */
export function hasSeenTour(preferences: unknown) {
    return Boolean(preferences && typeof preferences === "object" && "tourSeenAt" in preferences);
}
