import Link from "next/link";
import { Suspense } from "react";

import { getCurrentUser } from "@/lib/auth";
import { countCommunityLoansNeedingAction, countLoanUpdatesSince, countLoansNeedingAction } from "@/lib/db/queries/borrowing";
import { listManagedLibraries } from "@/lib/db/queries/libraries";
import { hasSeenTour, loansSeenAt, reportsSeenAt } from "@/lib/db/queries/users";
import { countReportDecisionsSince } from "@/lib/db/queries/reports";
import { getSettings } from "@/lib/db/queries/settings";
import { ProductTour } from "@/features/onboarding/components/product-tour";
import { ProfileMenu } from "@/components/navigation/profile-menu";
import { PublicNavigation } from "@/components/navigation/public-navigation";

function initialsOf(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
    return initials || "TB";
}

export async function SiteHeader() {
    const user = await getCurrentUser();
    const [loans, managed, communityLoans, loanNews, moderation] = await Promise.all([
        user ? countLoansNeedingAction(user.id) : 0,
        user ? listManagedLibraries(user.id) : [],
        user ? countCommunityLoansNeedingAction(user.id) : new Map<string, number>(),
        user ? countLoanUpdatesSince(user.id, loansSeenAt(user.preferences)) : 0,
        getSettings("moderation"),
    ]);
    // Decided reports light "Laporan saya" while confirmations to reporters are on (Pengaturan, 30 Okt 2026).
    const reportNews = user && moderation.settings.notifyReporters ? await countReportDecisionsSince(user.id, reportsSeenAt(user.preferences)) : 0;
    const loansWaiting = loans > 0;
    // Library requests closed on 30 Okt 2026, so libraries no longer add to the dots.
    const attention = {
        loans: loansWaiting || loanNews > 0,
        // Something to do opens "Perlu Tindakan"; only news opens what the reader borrows.
        loansHref: loansWaiting ? "/my-listings?tab=peminjaman&filter=action" : loanNews > 0 ? "/my-listings?tab=peminjaman&view=pinjam" : "/my-listings?tab=peminjaman",
        communities: communityLoans.size > 0,
        reports: reportNews > 0,
        managesLibraries: managed.length > 0,
    };

    return (
        <header className="sticky top-0 z-40 bg-background/95 shadow-[0_1px_4px_rgba(0,0,0,0.04)] backdrop-blur-[6px]">
            <div className="mx-auto grid max-w-[1256px] grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-3 sm:px-6 md:flex md:h-[76px] md:justify-between md:py-0">
                <Link href="/" className="font-heading text-[28px] leading-[26px] tracking-[-0.45px] text-[#21523d] lowercase sm:text-[32px]">
                    temubaca.
                </Link>
                <PublicNavigation className="order-last col-span-2 -mx-3 mt-2 md:order-none md:mx-0 md:mt-0" />
                <div className="flex items-center justify-end gap-4">
                    {user ? (
                        <ProfileMenu initials={initialsOf(user.displayName)} displayName={user.displayName} isAdmin={user.role === "ADMIN"} attention={attention} />
                    ) : (
                        <Link
                            href="/login"
                            className="flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                            Masuk / Daftar
                        </Link>
                    )}
                </div>
            </div>
            {/* The tour reads ?panduan itself; Suspense keeps static pages prerenderable. */}
            {user && <Suspense fallback={null}><ProductTour seen={hasSeenTour(user.preferences)} /></Suspense>}
        </header>
    );
}
