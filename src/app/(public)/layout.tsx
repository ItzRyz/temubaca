import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/layout/skip-link";
import { DeletionPendingBanner } from "@/features/account-deletion/components/delete-account-dialog";
import { getCurrentUser } from "@/lib/auth";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
    const user = await getCurrentUser();
    return (
        <div className="flex min-h-screen flex-col bg-background">
            <SkipLink />
            <SiteHeader />
            {user?.deletionScheduledFor && <DeletionPendingBanner scheduledFor={user.deletionScheduledFor.toISOString()} />}
            <div id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 outline-none">{children}</div>
            <SiteFooter />
        </div>
    );
}
