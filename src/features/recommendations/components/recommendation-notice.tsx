import { Info } from "lucide-react";

import type { BookRecommendationState } from "../queries";

/** Why the list looks the way it does (TB-059); nothing when every saved interest was used. */
export function RecommendationNotice({ state, unmatchedInterests, className = "" }: {
    state: BookRecommendationState;
    unmatchedInterests: string[];
    className?: string;
}) {
    const message = state === "needs_interests"
        ? "Pilih minat bacaan agar rekomendasi lebih pas. Sementara ini, berikut pilihan terbaru dari katalog."
        : state === "no_match"
            ? "Belum ada buku yang cocok dengan minatmu. Berikut pilihan terbaru dari katalog."
            : unmatchedInterests.length
                ? `Minat belum dikenali: ${unmatchedInterests.join(", ")}. Belum ada buku di katalog yang memakai kata ini, jadi rekomendasi dihitung dari minat lainnya.`
                : null;
    if (!message) return null;

    return (
        <p role="status" className={`flex items-start gap-2 rounded-xl border border-border bg-[#f1f0ea] px-4 py-3 text-sm text-foreground/85 ${className}`}>
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {message}
        </p>
    );
}

/** Where a recommended book came from: a saved interest, or the newest catalog books as a fallback. */
export function RecommendationSource({ source }: { source: "interest" | "catalog" }) {
    return source === "interest"
        ? <span className="inline-flex rounded-full bg-[#c9ecd6] px-2 py-0.5 text-[11px] font-semibold text-primary">Sesuai minat</span>
        : <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Pilihan katalog</span>;
}
