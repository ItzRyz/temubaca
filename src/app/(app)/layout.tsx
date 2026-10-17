import { redirect } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentUser } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

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
            <div className="flex-1">{children}</div>
            <SiteFooter />
        </div>
    );
}
