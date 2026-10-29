import { merchandisePhotoUrl } from "@/features/merchandise/format";
import { cn } from "@/lib/utils";

/** An event's image (29 Okt 2026) at 16:9; decorative, since the title sits next to it. */
export function EventImage({ path, className }: { path: string; className?: string }) {
    return (
        // eslint-disable-next-line @next/next/no-img-element -- public storage URL, sized by CSS like community logos
        <img src={merchandisePhotoUrl(path)} alt="" loading="lazy" className={cn("aspect-video w-full bg-muted object-cover", className)} />
    );
}
