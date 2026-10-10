import { ArrowLeft, Bookmark, Handshake, LibraryBig } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const benefits = [
    {
        title: "Simpan koleksi buku & riwayat bacaan",
        description: "Kelola rak digital dan simpan buku yang ingin kamu baca.",
        icon: Bookmark,
    },
    {
        title: "Pinjam buku fisik langsung dari kawan",
        description: "Temukan salinan yang dibagikan pembaca lain di sekitarmu.",
        icon: Handshake,
    },
];

/** Class names shared by auth form fields (Figma: Input 83:546). */
export const authFieldShellClass =
    "flex h-11 items-center gap-2.5 rounded-lg border bg-card px-3.5 focus-within:ring-2 focus-within:ring-ring/25";
export const authInputClass =
    "h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0";
export const authPrimaryButtonClass =
    "flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_1px_1.5px_rgba(0,0,0,0.1),0_1px_1px_rgba(0,0,0,0.1)] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60";

type AuthLayoutProps = {
    eyebrow?: string;
    title: string;
    description: string;
    showBenefits?: boolean;
    children: ReactNode;
};

export function AuthLayout({ eyebrow, title, description, showBenefits = false, children }: AuthLayoutProps) {
    return (
        <div className="flex min-h-screen flex-col bg-background">
            <main className="flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
                <div className="flex w-full max-w-[1024px] flex-col gap-6">
                    <Link href="/" className="flex w-fit items-center gap-1 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                        <ArrowLeft aria-hidden="true" className="size-3.5" /> Kembali ke beranda
                    </Link>
                    <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
                        <section className="flex flex-col rounded-[28px] border border-border bg-[#fcfbf7] p-6 shadow-[0_12px_16px_rgba(31,41,36,0.06)] sm:p-9">
                            <div className="flex flex-col items-start gap-6">
                                {eyebrow && (
                                    <p className="inline-flex items-center gap-1.5 rounded-full border border-[#dbe1d8] bg-[#e7efe8] px-3 py-1 text-[11px] leading-[16.5px] font-semibold tracking-[0.6px] text-secondary-foreground uppercase">
                                        <LibraryBig aria-hidden="true" className="size-3" /> {eyebrow}
                                    </p>
                                )}
                                <div className="flex flex-col gap-3">
                                    <h1 className="font-heading text-[32px] leading-[1.2] font-semibold tracking-[-0.8px] text-[#1f2924] sm:text-[38px]">{title}</h1>
                                    <p className="text-base leading-[26px] text-muted-foreground">{description}</p>
                                </div>
                                {showBenefits && (
                                    <ul aria-label="Manfaat akun TemuBaca" className="flex w-full list-none flex-col gap-3.5 p-0 pt-2">
                                        {benefits.map(({ title: benefitTitle, description: benefitDescription, icon: Icon }) => (
                                            <li key={benefitTitle} className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4">
                                                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e7efe8] text-secondary-foreground">
                                                    <Icon aria-hidden="true" className="size-4" />
                                                </span>
                                                <span>
                                                    <span className="block text-sm leading-5 font-semibold text-[#1f2924]">{benefitTitle}</span>
                                                    <span className="block pt-0.5 text-[13px] leading-[19px] text-muted-foreground">{benefitDescription}</span>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </section>
                        {children}
                    </div>
                </div>
            </main>
            <footer className="border-t border-border bg-[#fcfbf7] py-6">
                <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-6 text-xs leading-4 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <p>© {new Date().getFullYear()} TemuBaca. Komunitas Berbagi &amp; Pinjam Buku Indonesia.</p>
                    <nav aria-label="Tautan bantuan" className="flex gap-6">
                        <Link href="/about" className="hover:text-foreground">Tentang TemuBaca</Link>
                    </nav>
                </div>
            </footer>
        </div>
    );
}

export function AuthPanel({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <section className={cn("flex flex-col justify-center rounded-[28px] border border-border bg-card p-6 shadow-[0_12px_16px_rgba(31,41,36,0.07)] sm:p-9", className)}>
            {children}
        </section>
    );
}
