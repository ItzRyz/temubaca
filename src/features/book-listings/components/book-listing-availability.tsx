"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Switch } from "@/components/ui/form";

type BookListingAvailabilityProps = {
    listingId: string;
    initialAvailability: "AVAILABLE" | "UNAVAILABLE" | "RESERVED";
};

export function BookListingAvailability({ listingId, initialAvailability }: BookListingAvailabilityProps) {
    const router = useRouter();
    const labelId = useId();
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
            router.refresh();
        } catch {
            setError("Koneksi terputus. Coba lagi.");
        } finally {
            setPending(false);
        }
    }

    const offered = availability === "AVAILABLE";
    const locked = availability === "RESERVED";

    return (
        <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-3">
                <span className={`text-right text-sm font-medium ${locked ? "text-muted-foreground" : ""}`}>
                    <span id={labelId}>Ditawarkan</span>
                    <span aria-hidden="true" className={`block text-xs font-normal ${offered ? "text-primary" : "text-muted-foreground"}`}>
                        {locked ? "Terkunci (dipesan)" : pending ? "Memperbarui…" : offered ? "Aktif" : "Nonaktif"}
                    </span>
                </span>
                <Switch checked={offered} onCheckedChange={() => toggleAvailability()} aria-labelledby={labelId} disabled={pending || locked} />
            </div>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>
    );
}
