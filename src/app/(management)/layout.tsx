import { notFound, redirect } from "next/navigation";

import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { getCurrentUser } from "@/lib/auth";
import { countCommunitiesByStatus } from "@/lib/db/queries/communities";
import { countReportsByStatus } from "@/lib/db/queries/reports";

export default async function ManagementLayout({ children }: LayoutProps<"/">) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    if (user.role !== "ADMIN") notFound();

    const [pendingReports, reviewingReports, pendingCommunities] = await Promise.all([
        countReportsByStatus("PENDING"),
        countReportsByStatus("REVIEWING"),
        countCommunitiesByStatus("PENDING"),
    ]);

    return (
        <div className="flex min-h-screen flex-col bg-background lg:flex-row">
            <AdminSidebar displayName={user.displayName} pendingCount={pendingReports + reviewingReports + pendingCommunities} />
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}
