import Link from "next/link";

import { footerNavigation } from "@/config/navigation";

/** Figma "Footer" (225:1419). Policy links from the mockup wait until those pages exist. */
export function SiteFooter() {
    return (
        <footer className="mt-12 border-t border-border bg-background">
            <div className="mx-auto grid max-w-[1256px] gap-10 px-4 pt-12 pb-10 sm:px-6 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
                <div className="max-w-md">
                    <Link href="/" className="font-heading text-xl text-[#21523d] lowercase">temubaca</Link>
                    <p className="mt-4 text-sm leading-6 text-foreground/80">
                        Ruang saling pinjam dan tukar buku fisik di ruang publik sekitar. Membangun kembali ekosistem literasi warga yang aman, ramah, dan berkelanjutan.
                    </p>
                </div>
                {footerNavigation.map((group) => (
                    <nav key={group.title} aria-label={group.title}>
                        <h2 className="font-sans text-sm font-semibold text-foreground">{group.title}</h2>
                        <ul className="mt-4 grid list-none gap-3 p-0 text-sm">
                            {group.links.map((link) => (
                                <li key={link.href}>
                                    <Link href={link.href} className="text-foreground/75 hover:text-primary hover:underline">{link.label}</Link>
                                </li>
                            ))}
                        </ul>
                    </nav>
                ))}
            </div>
            <div className="mx-auto max-w-[1256px] px-4 sm:px-6">
                <div className="flex flex-col gap-2 border-t border-border py-6 text-xs text-foreground/70 sm:flex-row sm:justify-between">
                    <p>© {new Date().getFullYear()} TemuBaca. Dirawat bersama para pecinta buku di Nusantara.</p>
                    <p>Literasi Guyub, Temu di Ruang Publik</p>
                </div>
            </div>
        </footer>
    );
}
