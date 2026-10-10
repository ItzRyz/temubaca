import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/** Compact page list: first, last, and neighbours of the current page, with gaps marked by null. */
export function pageWindow(current: number, total: number): (number | null)[] {
    const pages = new Set([1, total, current - 1, current, current + 1].filter((page) => page >= 1 && page <= total));
    const sorted = [...pages].sort((a, b) => a - b);
    return sorted.flatMap((page, index) => (index > 0 && page - sorted[index - 1] > 1 ? [null, page] : [page]));
}

export function CatalogPagination({ page, totalPages, hrefFor }: {
    page: number;
    totalPages: number;
    hrefFor: (page: number) => string;
}) {
    if (totalPages <= 1) return null;
    const navClass = "flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm";

    return (
        <nav aria-label="Halaman hasil" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Halaman {page} dari {totalPages}</p>
            <div className="flex flex-wrap items-center gap-1.5">
                {page > 1 ? (
                    <Link href={hrefFor(page - 1)} className={cn(navClass, "hover:bg-muted")}><ChevronLeft aria-hidden="true" className="size-3.5" /> Sebelumnya</Link>
                ) : (
                    <span aria-disabled="true" className={cn(navClass, "text-muted-foreground/60")}><ChevronLeft aria-hidden="true" className="size-3.5" /> Sebelumnya</span>
                )}
                {pageWindow(page, totalPages).map((item, index) =>
                    item === null ? (
                        <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted-foreground">…</span>
                    ) : (
                        <Link
                            key={item}
                            href={hrefFor(item)}
                            aria-current={item === page ? "page" : undefined}
                            className={cn(
                                "flex size-9 items-center justify-center rounded-md border text-sm",
                                item === page ? "border-primary bg-primary font-semibold text-primary-foreground" : "border-border hover:bg-muted",
                            )}
                        >
                            {item}
                        </Link>
                    ),
                )}
                {page < totalPages ? (
                    <Link href={hrefFor(page + 1)} className={cn(navClass, "hover:bg-muted")}>Berikutnya <ChevronRight aria-hidden="true" className="size-3.5" /></Link>
                ) : (
                    <span aria-disabled="true" className={cn(navClass, "text-muted-foreground/60")}>Berikutnya <ChevronRight aria-hidden="true" className="size-3.5" /></span>
                )}
            </div>
        </nav>
    );
}
