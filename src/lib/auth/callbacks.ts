import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";

export type CreateProfileInput = {
    id: string;
    displayName: string;
};

export function getProfileDisplayName(metadata: unknown): string {
    if (
        typeof metadata === "object" &&
        metadata !== null &&
        "display_name" in metadata &&
        typeof metadata.display_name === "string" &&
        metadata.display_name.trim().length > 0
    ) {
        return metadata.display_name.trim().slice(0, 100);
    }

    return "Pembaca";
}

export async function ensureUserProfile(
    input: CreateProfileInput,
) {
    const [profile] = await db
        .insert(userProfiles)
        .values({
            id: input.id,
            displayName: input.displayName,
            role: "MEMBER",
            preferences: {},
        })
        .onConflictDoNothing({ target: userProfiles.id })
        .returning();

    if (profile) {
        return profile;
    }

    const existing = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, input.id),
    });

    if (!existing) {
        throw new Error("Unable to create or load the user profile.");
    }

    return existing;
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
