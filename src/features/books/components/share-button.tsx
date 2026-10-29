"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";

import { notify } from "@/lib/toast";

/** Native share sheet where available, else copies the link. `iconOnly` shows just the icon, named for screen readers. */
export function ShareButton({ title, className, iconOnly = false }: { title: string; className?: string; iconOnly?: boolean }) {
    const [message, setMessage] = useState("");

    async function share() {
        const url = window.location.href;
        try {
            if (navigator.share) {
                await navigator.share({ title, url });
                return;
            }
            await navigator.clipboard.writeText(url);
            notify.success("Tautan disalin.");
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return;
            setMessage("Tautan belum dapat dibagikan.");
        }
    }

    return (
        <>
            {iconOnly ? (
                <button type="button" onClick={share} aria-label="Bagikan" title="Bagikan" className={className}><Share2 aria-hidden="true" className="size-4" /></button>
            ) : (
                <button type="button" onClick={share} className={className}>Bagikan</button>
            )}
            <span aria-live="polite" className="sr-only">{message}</span>
        </>
    );
}
