"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { Toaster as Sonner } from "sonner";

/**
 * Toasts for actions that change data (owner's decision 29 Okt 2026): bottom right, in the site's card
 * style. Field errors stay next to their fields; toasts confirm what happened.
 */
export function Toaster() {
    return (
        <Sonner
            position="bottom-right"
            icons={{ success: <CircleCheck aria-hidden="true" className="size-5 text-primary" />, error: <CircleAlert aria-hidden="true" className="size-5 text-destructive" /> }}
            toastOptions={{
                unstyled: true,
                classNames: {
                    toast: "flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 font-sans text-sm text-card-foreground shadow-[0_8px_24px_rgba(31,41,36,0.14)]",
                    title: "font-semibold",
                    description: "mt-0.5 text-muted-foreground",
                    error: "border-destructive/40",
                },
            }}
        />
    );
}
