import Link from "next/link";
import type { ReactNode } from "react";

export const POLICY_UPDATED_AT = "23 Oktober 2026";

const policyLinks = [
    { href: "/terms", label: "Syarat Layanan" },
    { href: "/privacy", label: "Kebijakan Privasi" },
    { href: "/safety", label: "Panduan Keamanan" },
    { href: "/help", label: "Bantuan" },
] as const;

/** Shared shell for the policy and help pages: title, update date, sections, and links to the others. */
export function PolicyPage({ eyebrow, title, intro, current, children }: {
    eyebrow: string;
    title: string;
    intro: ReactNode;
    current: (typeof policyLinks)[number]["href"];
    children: ReactNode;
}) {
    return (
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-8 sm:py-16">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
            <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Terakhir diperbarui {POLICY_UPDATED_AT}</p>
            <div className="mt-6 text-base leading-7 text-foreground/85">{intro}</div>
            <div className="mt-10 flex flex-col gap-8">{children}</div>
            <nav aria-label="Kebijakan lain" className="mt-12 border-t border-border pt-6">
                <ul className="flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-sm">
                    {policyLinks.filter((link) => link.href !== current).map((link) => (
                        <li key={link.href}><Link href={link.href} className="font-semibold text-primary hover:underline">{link.label}</Link></li>
                    ))}
                </ul>
            </nav>
        </main>
    );
}

export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section>
            <h2 className="font-heading text-2xl font-semibold">{title}</h2>
            <div className="mt-3 flex flex-col gap-3 text-sm leading-6 text-foreground/85 [&_li]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1.5">{children}</div>
        </section>
    );
}
