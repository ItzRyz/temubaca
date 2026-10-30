"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const VISIBLE_MS = 5_000;

/**
 * "Cek riwayat & ulasan" next to a borrower's name (30 Okt 2026): fades in once, stays 5 seconds, fades out.
 * With reduced motion it appears and leaves without animation. Decorative: the link itself names the page.
 */
export function ProfileHintBadge() {
    const [phase, setPhase] = useState<"in" | "shown" | "out" | "gone">("in");

    useEffect(() => {
        const show = requestAnimationFrame(() => setPhase("shown"));
        const hide = setTimeout(() => setPhase("out"), VISIBLE_MS);
        const remove = setTimeout(() => setPhase("gone"), VISIBLE_MS + 400);
        return () => {
            cancelAnimationFrame(show);
            clearTimeout(hide);
            clearTimeout(remove);
        };
    }, []);

    if (phase === "gone") return null;
    return (
        <span aria-hidden="true"
            className={cn(
                "inline-flex items-center rounded-full bg-[#e7efe8] px-2 py-0.5 text-[11px] font-semibold text-primary",
                "transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
                phase === "shown" ? "translate-y-0 opacity-100" : "translate-y-0.5 opacity-0 motion-reduce:translate-y-0",
            )}>
            Cek riwayat &amp; ulasan
        </span>
    );
}
