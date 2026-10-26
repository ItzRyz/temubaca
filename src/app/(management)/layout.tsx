import { notFound } from "next/navigation";

import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/layout/skip-link";
import { getCurrentUser } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/login-redirect";
import { countCommunitiesByStatus } from "@/lib/db/queries/communities";
import { countReportsByStatus } from "@/lib/db/queries/reports";
import { countOpenBorrowingDisputes } from "@/lib/db/queries/borrowing";
import { countPendingAppeals } from "@/lib/db/queries/listing-appeals";

export default async function ManagementLayout({ children }: LayoutProps<"/">) {
    const user = await getCurrentUser();
    if (!user) return redirectToLogin();
    if (user.role !== "ADMIN") notFound();

    const [pendingReports, reviewingReports, pendingCommunities, openDisputes, pendingAppeals] = await Promise.all([
        countReportsByStatus("PENDING"),
        countReportsByStatus("REVIEWING"),
        countCommunitiesByStatus("PENDING"),
        countOpenBorrowingDisputes(),
        countPendingAppeals(),
    ]);

    return (
        <div className="flex min-h-screen flex-col bg-background lg:flex-row">
            <SkipLink />
            <AdminSidebar displayName={user.displayName} pending={{ reports: pendingReports + reviewingReports, communities: pendingCommunities, disputes: openDisputes, appeals: pendingAppeals }} />
            <div id={MAIN_CONTENT_ID} tabIndex={-1} className="min-w-0 flex-1 outline-none">{children}</div>
        </div>
    );
}
