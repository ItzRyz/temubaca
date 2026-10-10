import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileSettingsForm } from "@/features/profile/components/profile-settings-form";
import { getCurrentUser } from "@/lib/auth";

export default async function SettingsPage() {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    return (
        <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-12 sm:px-8 sm:py-16">
            <Link href="/profile" className="text-sm font-medium text-primary hover:underline">← Kembali ke profil</Link>
            <header className="mt-6">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Pengaturan akun</p>
                <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">Pengaturan profil</h1>
                <p className="mt-3 text-sm text-muted-foreground">Perbarui nama yang ditampilkan kepada pembaca lain.</p>
            </header>
            <ProfileSettingsForm displayName={user.displayName} />
        </main>
    );
}
