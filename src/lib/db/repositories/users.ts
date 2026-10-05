import "server-only";

import { eq } from "drizzle-orm";

import { db } from "../client";

import {
    userProfiles,
} from "../schema";

export type CreateUserProfileInput = {
    id: string;
    displayName: string;
};

export type UpdateUserProfileInput = {
    displayName?: string;
    preferences?: Record<string, unknown>;
};

export class UserRepository {
    async findById(
        userId: string,
    ) {
        return db.query.userProfiles.findFirst({
            where: eq(
                userProfiles.id,
                userId,
            ),
        });
    }

    async findByIdWithRelations(
        userId: string,
    ) {
        return db.query.userProfiles.findFirst({
            where: eq(
                userProfiles.id,
                userId,
            ),

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

    async exists(
        userId: string,
    ) {
        const user =
            await this.findById(userId);

        return user !== undefined;
    }

    async create(
        input: CreateUserProfileInput,
    ) {
        const [user] = await db
            .insert(userProfiles)
            .values({
                id: input.id,
                displayName:
                    input.displayName,
                role: "MEMBER",
                preferences: {},
            })
            .returning();

        return user;
    }

    async update(
        userId: string,
        input: UpdateUserProfileInput,
    ) {
        const [user] = await db
            .update(userProfiles)
            .set({
                ...(input.displayName !== undefined
                    ? {
                        displayName:
                            input.displayName,
                    }
                    : {}),

                ...(input.preferences !== undefined
                    ? {
                        preferences:
                            input.preferences,
                    }
                    : {}),

                updatedAt: new Date(),
            })
            .where(
                eq(
                    userProfiles.id,
                    userId,
                ),
            )
            .returning();

        return user ?? null;
    }

    async updatePreferences(
        userId: string,
        preferences: Record<string, unknown>,
    ) {
        const [user] = await db
            .update(userProfiles)
            .set({
                preferences,
                updatedAt: new Date(),
            })
            .where(
                eq(
                    userProfiles.id,
                    userId,
                ),
            )
            .returning();

        return user ?? null;
    }

    async updateDisplayName(
        userId: string,
        displayName: string,
    ) {
        const [user] = await db
            .update(userProfiles)
            .set({
                displayName,
                updatedAt: new Date(),
            })
            .where(
                eq(
                    userProfiles.id,
                    userId,
                ),
            )
            .returning();

        return user ?? null;
    }

    async delete(
        userId: string,
    ) {
        const deleted = await db
            .delete(userProfiles)
            .where(
                eq(
                    userProfiles.id,
                    userId,
                ),
            )
            .returning({
                id: userProfiles.id,
            });

        return deleted.length > 0;
    }
}

export const userRepository =
    new UserRepository();