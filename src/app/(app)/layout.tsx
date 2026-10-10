import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { AppHeader } from "@/components/layout/app-header";

export default async function AppLayout({ children }: LayoutProps<"/">) {
    const user = await getCurrentUser();

    if (!user) {
        redirect("/login");
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <AppHeader displayName={user.displayName} isAdmin={user.role === "ADMIN"} />
            {children}
            <footer className="mt-auto border-t border-border/70">
                <div className="mx-auto max-w-6xl px-5 py-5 text-sm text-muted-foreground sm:px-8">
                    TemuBaca · Temukan buku dan teman baca.
                </div>
            </footer>
        </div>
    );
}
