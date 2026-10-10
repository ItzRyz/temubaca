import { notFound, redirect } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentUser } from "@/lib/auth";

export default async function ManagementLayout({ children }: LayoutProps<"/">) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    if (user.role !== "ADMIN") notFound();

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <SiteHeader />
            <div className="flex-1">{children}</div>
            <SiteFooter />
        </div>
    );
}
