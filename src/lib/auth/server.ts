import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

import type { UserProfile } from "./session";

export async function getCurrentUser(): Promise<UserProfile | null> {
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

    return profile;
}

export async function requireUser(): Promise<UserProfile> {
    const user = await getCurrentUser();

    if (!user) {
        throw new Error("Unauthorized");
    }

    return user;
}

export async function getCurrentUserId(): Promise<string | null> {
    const user = await getCurrentUser();

    return user?.id ?? null;
}

export async function requireUserId(): Promise<string> {
    const user = await requireUser();

    return user.id;
}

export async function isAuthenticated(): Promise<boolean> {
    const user = await getCurrentUser();

    return user !== null;
}

export async function hasRole(
    role: UserProfile["role"],
): Promise<boolean> {
    const user = await getCurrentUser();

    return user?.role === role;
}

export async function requireRole(
    role: UserProfile["role"],
): Promise<UserProfile> {
    const user = await requireUser();

    if (user.role !== role) {
        throw new Error("Forbidden");
    }

    return user;
}

export async function requireAdmin(): Promise<UserProfile> {
    return requireRole("ADMIN");
}