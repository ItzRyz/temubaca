import type { ReactNode } from "react";

export function SectionHeader({ id, title, description }: {
    id: string;
    title: string;
    description: string;
}) {
    return (
        <div>
            <h2 id={id} className="font-heading text-[26px] leading-10 font-bold text-[#1f2924] sm:text-[32px]">{title}</h2>
            <p className="mt-1 text-sm leading-[22px] text-muted-foreground">{description}</p>
        </div>
    );
}

export function EmptyState({ children }: { children: ReactNode }) {
    return <p className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground">{children}</p>;
}
