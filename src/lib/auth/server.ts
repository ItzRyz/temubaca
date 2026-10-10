import "server-only";

import { ForbiddenError, UnauthorizedError } from "@/lib/api/errors";
import { createClient } from "@/lib/supabase/server";
import { ensureUserProfile, getProfileDisplayName } from "./callbacks";

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

    return ensureUserProfile({
        id: user.id,
        displayName: getProfileDisplayName(user.user_metadata),
    });
}

export async function requireUser(): Promise<UserProfile> {
    const user = await getCurrentUser();

    if (!user) {
        throw new UnauthorizedError();
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
        throw new ForbiddenError();
    }

    return user;
}

export async function requireAdmin(): Promise<UserProfile> {
    return requireRole("ADMIN");
}
