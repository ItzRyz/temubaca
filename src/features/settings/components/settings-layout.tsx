import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Building blocks of Admin → Pengaturan (redesign 30 Okt 2026): one surface per section, a header that says
 * whether the section can be changed, live numbers in a single strip, and rules as label/explanation rows.
 */

export function SettingsSection({ id, title, purpose, source, children }: {
    id: string;
    title: string;
    purpose: string;
    /** "editable" sections save from here; "policy" sections show rules fixed in code, with their decision. */
    source: { kind: "editable"; note: string } | { kind: "policy"; decision: string };
    children: ReactNode;
}) {
    return (
        <section aria-labelledby={`${id}-title`} className="overflow-hidden rounded-xl border border-border bg-card">
            <header className="flex flex-col gap-2 border-b border-border px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <div className="min-w-0">
                    <h2 id={`${id}-title`} className="font-heading text-xl font-semibold">{title}</h2>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{purpose}</p>
                </div>
                <p className={cn(
                    "shrink-0 text-xs font-medium sm:pt-1.5 sm:text-right",
                    source.kind === "editable" ? "text-primary" : "text-muted-foreground",
                )}>
                    {source.kind === "editable" ? source.note : <>Kebijakan tetap · {source.decision}<span className="block font-normal">Diubah lewat kode, bukan dari halaman ini</span></>}
                </p>
            </header>
            {children}
        </section>
    );
}

/** Live numbers for the section, one row; each may open the page where it is handled. */
export function StatusStrip({ label, items }: { label: string; items: { label: string; value: number | string; href?: string; alert?: boolean }[] }) {
    return (
        <div className="border-b border-border bg-[#faf7f0] px-5 py-4 sm:px-6">
            <h3 className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{label}</h3>
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                {items.map((item) => (
                    <div key={item.label} className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{item.label}</dt>
                        <dd className={cn("font-heading text-xl font-semibold tabular-nums", item.alert && Number(item.value) > 0 && "text-destructive")}>
                            {item.href ? <Link href={item.href} className="hover:underline">{item.value}</Link> : item.value}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

/** Rules as label + explanation, in the section's own surface (no card inside the card). */
export function RuleList({ rules }: { rules: readonly (readonly [string, ReactNode])[] }) {
    return (
        <dl className="divide-y divide-border">
            {rules.map(([term, detail]) => (
                <div key={term} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[minmax(0,200px)_1fr] sm:gap-6 sm:px-6">
                    <dt className="text-sm font-semibold">{term}</dt>
                    <dd className="text-sm leading-6 text-foreground/75">{detail}</dd>
                </div>
            ))}
        </dl>
    );
}

/** Where to act on the section, at its end. */
export function SectionFooter({ children }: { children: ReactNode }) {
    return <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4 sm:px-6">{children}</div>;
}

export const footerLinkClass = "inline-flex min-h-10 items-center rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
