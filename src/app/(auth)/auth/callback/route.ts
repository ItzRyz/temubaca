import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get("code");
    const tokenHash = request.nextUrl.searchParams.get("token_hash");
    const otpType = request.nextUrl.searchParams.get("type");
    const requestedNext = request.nextUrl.searchParams.get("next");
    const nextPath =
        requestedNext?.startsWith("/") &&
        !requestedNext.startsWith("//") &&
        !requestedNext.includes("\\")
            ? requestedNext
            : "/";

    const supabase = await createClient();
    let error: { message: string } | null = null;

    if (code) {
        ({ error } = await supabase.auth.exchangeCodeForSession(code));
    } else if (
        tokenHash &&
        ["signup", "invite", "magiclink", "recovery", "email_change", "email"].includes(otpType ?? "")
    ) {
        ({ error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType as "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email",
        }));
    }

    if (!error && (code || tokenHash)) {
        return NextResponse.redirect(new URL(nextPath, request.url));
    }
    return NextResponse.redirect(new URL("/verify-email?error=verification", request.url));
}
