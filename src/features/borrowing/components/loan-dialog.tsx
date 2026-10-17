"use client";

import { Book, X } from "lucide-react";
import { useId, type ReactNode, type Ref } from "react";

import { cn } from "@/lib/utils";

/**
 * Modal shell shared by Ajukan Pinjam, Tolak Permintaan, and Laporkan Masalah (Figma 299/300:2608):
 * title + subtitle with a close button, a scrolling body, and a footer note beside the actions.
 */
export function LoanDialog({ ref, title, subtitle, footerNote, actions, onClose, children, className }: {
    ref: Ref<HTMLDialogElement>;
    title: string;
    subtitle: string;
    footerNote?: ReactNode;
    actions: ReactNode;
    onClose: () => void;
    children: ReactNode;
    className?: string;
}) {
    const titleId = useId();
    return (
        <dialog
            ref={ref}
            aria-labelledby={titleId}
            className={cn(
                "m-auto w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-border bg-card p-0 text-foreground shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] backdrop:bg-[rgba(0,23,14,0.6)] backdrop:backdrop-blur-[2px]",
                className,
            )}
        >
            <div className="flex max-h-[90vh] flex-col">
                <div className="flex items-start justify-between gap-4 border-b border-border px-5 pt-5 pb-4 sm:px-6">
                    <div>
                        <h2 id={titleId} className="font-heading text-2xl font-semibold text-primary">{title}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Tutup dialog" className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
                        <X aria-hidden="true" className="size-4" />
                    </button>
                </div>
                <div className="flex flex-col gap-5 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
                <div className="flex flex-col gap-3 border-t border-border bg-[#f5f3ec] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    {footerNote ? <p className="text-xs text-muted-foreground">{footerNote}</p> : <span />}
                    <div className="flex justify-end gap-3">{actions}</div>
                </div>
            </div>
        </dialog>
    );
}

export const dialogSecondaryButton = "min-h-11 rounded-lg border border-border bg-card px-5 text-sm font-semibold text-foreground hover:bg-muted";
export const dialogPrimaryButton = "flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
export const dialogDangerButton = "flex min-h-11 items-center gap-2 rounded-lg bg-destructive px-5 text-sm font-semibold text-white hover:bg-destructive/90 disabled:opacity-60";

/** Book summary card at the top of each loan dialog. */
export function LoanBookCard({ title, children }: { title: string; children?: ReactNode }) {
    return (
        <div className="flex gap-4 rounded-xl bg-[#f1efe6] p-4">
            <span aria-hidden="true" className="flex h-16 w-12 shrink-0 items-center justify-center rounded bg-[#dbe2dc] text-primary">
                <Book className="size-4" />
            </span>
            <div className="min-w-0 text-sm">
                <p className="font-heading text-lg font-semibold">{title}</p>
                {children}
            </div>
        </div>
    );
}
