import { notFound, redirect } from "next/navigation";

import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { getCurrentUser } from "@/lib/auth";
import { countCommunitiesByStatus } from "@/lib/db/queries/communities";
import { countReportsByStatus } from "@/lib/db/queries/reports";
import { countOpenBorrowingDisputes } from "@/lib/db/queries/borrowing";

export default async function ManagementLayout({ children }: LayoutProps<"/">) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    if (user.role !== "ADMIN") notFound();

    const [pendingReports, reviewingReports, pendingCommunities, openDisputes] = await Promise.all([
        countReportsByStatus("PENDING"),
        countReportsByStatus("REVIEWING"),
        countCommunitiesByStatus("PENDING"),
        countOpenBorrowingDisputes(),
    ]);

    return (
        <div className="flex min-h-screen flex-col bg-background lg:flex-row">
            <AdminSidebar displayName={user.displayName} pending={{ reports: pendingReports + reviewingReports, communities: pendingCommunities, disputes: openDisputes }} />
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}
