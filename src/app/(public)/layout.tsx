import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { DeletionPendingBanner } from "@/features/account-deletion/components/delete-account-dialog";
import { getCurrentUser } from "@/lib/auth";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
    const user = await getCurrentUser();
    return (
        <div className="flex min-h-screen flex-col bg-background">
            <SiteHeader />
            {user?.deletionScheduledFor && <DeletionPendingBanner scheduledFor={user.deletionScheduledFor.toISOString()} />}
            <div className="flex-1">{children}</div>
            <SiteFooter />
        </div>
    );
}
