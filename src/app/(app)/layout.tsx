
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentUser } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/login-redirect";
import { DeletionPendingBanner } from "@/features/account-deletion/components/delete-account-dialog";

export default async function AppLayout({ children }: LayoutProps<"/">) {
    const user = await getCurrentUser();
    if (!user) return redirectToLogin();

    return (
        <div className="flex min-h-screen flex-col bg-background">
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
            <div className="flex-1">{children}</div>
            <SiteFooter />
        </div>
    );
}
