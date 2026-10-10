"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { publicNavigation } from "@/config/navigation";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
    return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicNavigation({ className }: { className?: string }) {
    const pathname = usePathname();

    return (
        <nav aria-label="Navigasi utama" className={cn("flex items-center gap-1 overflow-x-auto text-sm [scrollbar-width:none]", className)}>
            {publicNavigation.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                            "whitespace-nowrap rounded-lg px-3 py-2 leading-5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                            active ? "font-bold text-foreground" : "font-medium text-[#6e7870]",
                        )}
                    >
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
