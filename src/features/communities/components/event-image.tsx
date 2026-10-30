"use client";

import { useEffect, useRef, useState } from "react";

import { merchandisePhotoUrl } from "@/features/merchandise/format";
import { cn } from "@/lib/utils";

/** Shown when an event has no image, or its image fails to load (30 Okt 2026). Drawn for TemuBaca, no external URL. */
export const EVENT_FALLBACK_IMAGE = "/illustrations/agenda-baca.svg";

/**
 * An event's image (29 Okt 2026) at 16:9; decorative, since the title sits next to it. Without a path, or when
 * the stored file is missing, the reading illustration takes its place in the same box, so nothing shifts.
 */
export function EventImage({ path, className }: { path: string | null; className?: string }) {
    const ref = useRef<HTMLImageElement>(null);
    const [failed, setFailed] = useState(false);
    const src = path && !failed ? merchandisePhotoUrl(path) : EVENT_FALLBACK_IMAGE;

    // A server-rendered image can fail before React attaches onError; check once after hydration.
    useEffect(() => {
        const image = ref.current;
        if (path && image?.complete && image.naturalWidth === 0) setFailed(true);
    }, [path]);

    return (
        // eslint-disable-next-line @next/next/no-img-element -- public storage URL, sized by CSS like community logos
        <img ref={ref} src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)}
            className={cn("aspect-video w-full bg-[#e7efe8] object-cover", className)} />
    );
}
