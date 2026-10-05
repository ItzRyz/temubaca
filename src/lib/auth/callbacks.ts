import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";

export type CreateProfileInput = {
    id: string;
    displayName: string;
};

export async function ensureUserProfile(
    input: CreateProfileInput,
) {
    const existing = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, input.id),
    });

    if (existing) {
        return existing;
    }

    const [profile] = await db
        .insert(userProfiles)
        .values({
            id: input.id,
            displayName: input.displayName,
            role: "MEMBER",
            preferences: {},
        })
        .returning();

    return profile;
}

export async function updateUserProfile(
    userId: string,
    data: Partial<{
        displayName: string;
        preferences: Record<string, unknown>;
    }>,
) {
    const [profile] = await db
        .update(userProfiles)
        .set({
            ...data,
            updatedAt: new Date(),
        })
        .where(eq(userProfiles.id, userId))
        .returning();

    return profile ?? null;
}

export async function deleteUserProfile(userId: string) {
    await db
        .delete(userProfiles)
        .where(eq(userProfiles.id, userId));
}