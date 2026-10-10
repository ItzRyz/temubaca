import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

export default async function ManagementLayout({ children }: LayoutProps<"/">) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    if (user.role !== "ADMIN") notFound();
    return children;
}
