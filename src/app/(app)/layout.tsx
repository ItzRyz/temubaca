import type { Metadata } from "next";

import { privateMetadata } from "@/config/site";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/layout/skip-link";
import { getCurrentUser } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/login-redirect";
import { DeletionPendingBanner } from "@/features/account-deletion/components/delete-account-dialog";

/** Signed-in pages are personal: kept out of search results. */
export const metadata: Metadata = privateMetadata;

export default async function AppLayout({ children }: LayoutProps<"/">) {
    const user = await getCurrentUser();
    if (!user) return redirectToLogin();

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <SkipLink />
            <SiteHeader />
            {user.suspendedAt && (
                <div role="alert" className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:px-8">
                    <p className="mx-auto max-w-[1280px]">
                        <strong>Akunmu sedang ditangguhkan admin.</strong> Kamu tetap dapat membaca, tetapi belum dapat membuat atau mengubah data, dan listing bukumu tidak tampil di halaman publik.
                        {user.suspendedReason ? ` Alasan: ${user.suspendedReason}` : ""}
                    </p>
                </div>
            )}
            {user.deletionScheduledFor && <DeletionPendingBanner scheduledFor={user.deletionScheduledFor.toISOString()} />}
            <div id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 outline-none">{children}</div>
            <SiteFooter />
        </div>
    );
}
