import { ShoppingBag } from "lucide-react";

import { cn } from "@/lib/utils";

import { merchandisePhotoUrl } from "../format";

/** Cover photo of a catalog card (the first photo), or the bag placeholder when there is none. */
export function MerchandiseThumb({ photoPaths, className, iconClassName = "size-10" }: { photoPaths: string[]; className?: string; iconClassName?: string }) {
    const cover = photoPaths[0];
    return (
        <div aria-hidden="true" className={cn("flex items-center justify-center overflow-hidden rounded-lg bg-[#f1f0ea] text-primary/40", className)}>
            {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={merchandisePhotoUrl(cover)} alt="" loading="lazy" className="size-full object-cover" />
            ) : <ShoppingBag className={iconClassName} />}
        </div>
    );
}
