import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/env";

let client: SupabaseClient | null | undefined;

/**
 * Service-role client for reading account emails in the admin portal. Never import this from
 * client code: the key bypasses RLS. Returns null when `SUPABASE_SERVICE_ROLE_KEY` is not set.
 */
export function getSupabaseAdmin() {
    if (client !== undefined) return client;
    client = env.SUPABASE_SERVICE_ROLE_KEY
        ? createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
        })
        : null;
    return client;
}

/** Map of auth user id → email for every account (paged; enough for the admin directory). */
export async function listAuthEmails(maxPages = 10) {
    const admin = getSupabaseAdmin();
    const emails = new Map<string, string>();
    if (!admin) return { available: false as const, emails };

    for (let page = 1; page <= maxPages; page += 1) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) return { available: false as const, emails };
        for (const user of data.users) if (user.email) emails.set(user.id, user.email);
        if (data.users.length < 1000) break;
    }
    return { available: true as const, emails };
}

export async function getAuthEmail(userId: string) {
    const admin = getSupabaseAdmin();
    if (!admin) return null;
    const { data, error } = await admin.auth.admin.getUserById(userId);
    return error ? null : data.user?.email ?? null;
}
