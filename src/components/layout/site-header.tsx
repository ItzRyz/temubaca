import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { ProfileMenu } from "@/components/navigation/profile-menu";
import { PublicNavigation } from "@/components/navigation/public-navigation";

function initialsOf(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
    return initials || "TB";
}

export async function SiteHeader() {
    const user = await getCurrentUser();

    return (
        <header className="sticky top-0 z-40 bg-background/95 shadow-[0_1px_4px_rgba(0,0,0,0.04)] backdrop-blur-[6px]">
            <div className="mx-auto grid max-w-[1256px] grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-3 sm:px-6 md:flex md:h-[76px] md:justify-between md:py-0">
                <Link href="/" className="font-heading text-[28px] leading-[26px] tracking-[-0.45px] text-[#21523d] lowercase sm:text-[32px]">
                    temubaca.
                </Link>
                <PublicNavigation className="order-last col-span-2 -mx-3 mt-2 md:order-none md:mx-0 md:mt-0" />
                <div className="flex items-center justify-end gap-4">
                    {user ? (
                        <ProfileMenu initials={initialsOf(user.displayName)} displayName={user.displayName} isAdmin={user.role === "ADMIN"} />
                    ) : (
                        <Link
                            href="/login"
                            className="flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                            Masuk / Daftar
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
