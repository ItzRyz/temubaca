"use client";

import { createClient } from "@/lib/supabase/client";

export async function signIn(
    email: string,
    password: string,
) {
    const supabase = createClient();

    return supabase.auth.signInWithPassword({
        email,
        password,
    });
}

export async function signUp(
    email: string,
    password: string,
) {
    const supabase = createClient();

    return supabase.auth.signUp({
        email,
        password,
    });
}

export async function signOut() {
    const supabase = createClient();

    return supabase.auth.signOut();
}

export async function getClientUser() {
    const supabase = createClient();

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error) {
        return null;
    }

    return user;
}