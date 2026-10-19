"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { merchandisePhotoUrl } from "../format";

/** Product photos on the merchandise detail page: one large photo and thumbnails to switch. */
export function MerchandiseGallery({ title, photoPaths }: { title: string; photoPaths: string[] }) {
    const [active, setActive] = useState(0);
    const current = photoPaths[Math.min(active, photoPaths.length - 1)];
    return (
        <div className="flex flex-col gap-3">
            <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-[#f1f0ea]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={merchandisePhotoUrl(current)} alt={`${title}, foto ${active + 1} dari ${photoPaths.length}`} className="size-full object-contain" />
            </div>
            {photoPaths.length > 1 && (
                <ul className="flex list-none gap-2 p-0" aria-label="Pilih foto">
                    {photoPaths.map((path, index) => (
                        <li key={path}>
                            <button type="button" onClick={() => setActive(index)} aria-label={`Lihat foto ${index + 1}`} aria-pressed={index === active}
                                className={cn("size-20 overflow-hidden rounded-lg border-2 focus-visible:outline-2 focus-visible:outline-ring", index === active ? "border-primary" : "border-transparent hover:border-border")}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={merchandisePhotoUrl(path)} alt="" loading="lazy" className="size-full object-cover" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
