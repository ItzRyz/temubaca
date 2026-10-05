import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

export type UserRole = "MEMBER" | "ADMIN";

export type UserProfile = typeof userProfiles.$inferSelect;

export type AuthUser = {
    id: string;
    email: string | null;
};

export type Session = {
    user: AuthUser;
};

export type AuthSession = {
    session: Session;
    profile: UserProfile;
};

export async function getSession(): Promise<AuthSession | null> {
    const supabase = await createClient();

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        return null;
    }

    const profile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
    });

    if (!profile) {
        return null;
    }

    return {
        session: {
            user: {
                id: user.id,
                email: user.email ?? null,
            },
        },
        profile,
    };
}

export async function getSessionUser(): Promise<UserProfile | null> {
    const session = await getSession();

    return session?.profile ?? null;
}

export async function getSessionUserId(): Promise<string | null> {
    const session = await getSession();

    return session?.profile.id ?? null;
}

export async function getSessionRole(): Promise<UserRole | null> {
    const session = await getSession();

    return (session?.profile.role as UserRole) ?? null;
}

export async function isSessionAuthenticated(): Promise<boolean> {
    const session = await getSession();

    return session !== null;
}