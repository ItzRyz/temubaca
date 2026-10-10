import Link from "next/link";

import { footerNavigation } from "@/config/navigation";

export function SiteFooter() {
    return (
        <footer className="mt-12 border-t border-border bg-background">
            <div className="mx-auto grid max-w-[1256px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
                <div className="max-w-sm">
                    <Link href="/" className="font-heading text-2xl text-[#21523d] lowercase">temubaca.</Link>
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                        TemuBaca adalah ruang berbagi buku dan komunitas literasi warga. Temukan kawan baca dan jelajahi koleksi buku fisik di titik temu publik sekitarmu.
                    </p>
                </div>
                {footerNavigation.map((group) => (
                    <nav key={group.title} aria-label={group.title}>
                        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-foreground">{group.title}</h2>
                        <ul className="mt-4 grid list-none gap-2.5 p-0 text-sm">
                            {group.links.map((link) => (
                                <li key={link.href}>
                                    <Link href={link.href} className="text-muted-foreground hover:text-primary">{link.label}</Link>
                                </li>
                            ))}
                        </ul>
                    </nav>
                ))}
            </div>
            <div className="mx-auto flex max-w-[1256px] flex-col gap-2 border-t border-border px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
                <p>© {new Date().getFullYear()} TemuBaca.</p>
                <p>Bahasa Indonesia (ID)</p>
            </div>
        </footer>
    );
}
