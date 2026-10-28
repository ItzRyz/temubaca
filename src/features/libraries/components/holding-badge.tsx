import { timeAgo } from "@/lib/format/relative-time";
import { cn } from "@/lib/utils";

import { holdingLabel, holdingSourceLabels, type HoldingSource } from "../access";

const toneClass = {
    available: "bg-[#c9ecd6] text-primary",
    on_loan: "bg-[#ffdbd1] text-[#5c1a0a]",
    listed: "bg-[#e7efe8] text-primary",
    unknown: "bg-[#f1f0ea] text-foreground/80",
} as const;

/** "Tercatat di koleksi · dicek 3 hari lalu": the status words never claim more than the source says (DEC-13). */
export function HoldingBadge({ holding, now }: { holding: { status: string; copiesAvailable: number | null; checkedAt: Date; source: string; sources?: HoldingSource[] }; now: Date }) {
    const label = holdingLabel(holding, now);
    return (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className={cn("rounded-full px-2 py-0.5 font-semibold", toneClass[label.tone])}>{label.text}</span>
            <span>dicek {timeAgo(holding.checkedAt, now)}{label.stale ? " (mungkin sudah berubah)" : ""}</span>
            <span>· Sumber: {(holding.sources ?? [holding.source as HoldingSource]).map((source) => holdingSourceLabels[source]).join(", ")}</span>
        </span>
    );
}
