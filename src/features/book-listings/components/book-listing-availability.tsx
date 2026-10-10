"use client";

import { useState } from "react";

type BookListingAvailabilityProps = {
    listingId: string;
    initialAvailability: "AVAILABLE" | "UNAVAILABLE" | "RESERVED";
};

export function BookListingAvailability({ listingId, initialAvailability }: BookListingAvailabilityProps) {
    const [availability, setAvailability] = useState(initialAvailability);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function toggleAvailability() {
        const nextAvailability = availability === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE";
        setPending(true);
        setError(null);

        try {
            const response = await fetch(`/api/book-listings/${listingId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ availability: nextAvailability }),
            });

            if (!response.ok) {
                setError(response.status === 429
                    ? "Terlalu banyak perubahan. Coba lagi sebentar."
                    : "Ketersediaan belum dapat diperbarui.");
                return;
            }

            setAvailability(nextAvailability);
        } catch {
            setError("Koneksi terputus. Coba lagi.");
        } finally {
            setPending(false);
        }
    }

    return (
        <div className="mt-4">
            <p className="text-sm text-muted-foreground">
                Status: {availability === "AVAILABLE" ? "Tersedia" : availability === "RESERVED" ? "Dipesan" : "Tidak tersedia"}
            </p>
            {availability !== "RESERVED" && (
                <button type="button" onClick={toggleAvailability} disabled={pending} className="mt-2 min-h-10 rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-60">
                    {pending ? "Memperbarui…" : availability === "AVAILABLE" ? "Tandai tidak tersedia" : "Tandai tersedia"}
                </button>
            )}
            {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
        </div>
    );
}
