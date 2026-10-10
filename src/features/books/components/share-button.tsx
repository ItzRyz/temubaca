"use client";

import { useState } from "react";

export function ShareButton({ title, className }: { title: string; className?: string }) {
    const [message, setMessage] = useState("");

    async function share() {
        const url = window.location.href;
        try {
            if (navigator.share) {
                await navigator.share({ title, url });
                return;
            }
            await navigator.clipboard.writeText(url);
            setMessage("Tautan disalin.");
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return;
            setMessage("Tautan belum dapat dibagikan.");
        }
    }

    return (
        <>
            <button type="button" onClick={share} className={className}>Bagikan</button>
            <span aria-live="polite" className="sr-only">{message}</span>
        </>
    );
}
