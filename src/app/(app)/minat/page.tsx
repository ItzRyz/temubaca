import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/features/auth/safe-next-path";
import { InterestOnboardingForm } from "@/features/recommendations/components/interest-onboarding-form";
import { MIN_ONBOARDING_INTERESTS } from "@/features/recommendations/onboarding";
import { getCurrentUser } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/login-redirect";
import { countUserInterests } from "@/lib/db/queries/interests";
import { findUserById } from "@/lib/db/queries/users";

export const metadata: Metadata = { title: "Pilih minat" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * "Pilih minat" after sign-up, and after each sign-in while the account has no interests (owner's
 * decision 28 Okt 2026). An account that already has interests goes straight on; they are edited in
 * Bookmark & Minat.
 */
export default async function InterestOnboardingPage({ searchParams }: PageProps) {
    const user = await getCurrentUser();
    if (!user) return redirectToLogin();
    const params = await searchParams;
    const next = safeNextPath(typeof params.next === "string" ? params.next : undefined) ?? "/";
    const [interests, profile] = await Promise.all([countUserInterests(user.id), findUserById(user.id)]);
    if (interests > 0) redirect(next);

    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
            <p className="text-sm font-semibold tracking-[0.16em] text-primary uppercase">Selamat datang, {user.displayName}</p>
            <h1 className="mt-2 font-heading text-[30px] leading-tight font-semibold text-primary sm:text-[36px]">Apa yang ingin kamu baca?</h1>
            <p className="mt-2 max-w-2xl text-base text-muted-foreground">
                Pilih minimal {MIN_ONBOARDING_INTERESTS} minat. TemuBaca memakainya untuk merekomendasikan buku dan komunitas baca, dan kamu bisa mengubahnya kapan saja di Bookmark &amp; Minat.
            </p>
            <div className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
                <InterestOnboardingForm next={next} regionCode={profile?.regionCode ?? null} />
            </div>
        </main>
    );
}
