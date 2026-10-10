import { ArrowRight, Search } from "lucide-react";

export function HomeHero() {
    return (
        <section className="px-4 pt-8 pb-10 sm:px-9 sm:py-12">
            <div className="mx-auto max-w-[1208px] rounded-[28px] border border-border bg-card p-6 shadow-[0_12px_32px_rgba(31,41,36,0.09)] sm:p-14">
                <h1 className="max-w-[802px] pt-2 font-heading text-[32px] leading-[1.25] font-normal tracking-[-1.05px] text-[#1f2924] sm:text-[42px]">
                    Temukan Buku Favorit &amp; Kawan Baca di Sekitarmu.
                </h1>
                <p className="mt-2 max-w-[672px] pb-6 text-base leading-[26px] text-[#6e7870]">
                    Jelajahi rak buku terdekat, buat titik temu di kedai kopi atau taman kota, dan rasakan kembali kehangatan bertukar cerita secara langsung.
                </p>
                <form action="/books" method="get" role="search" className="flex flex-col gap-2 rounded-2xl border border-border bg-background p-4 sm:flex-row">
                    <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-card px-4 focus-within:ring-2 focus-within:ring-ring/30">
                        <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        <span className="sr-only">Cari judul, penulis, atau ISBN</span>
                        <input
                            name="q"
                            type="search"
                            maxLength={200}
                            placeholder="Cari judul, penulis, atau ISBN..."
                            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                    </label>
                    <button type="submit" className="flex min-h-11 items-center justify-center gap-1 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_1px_1px_rgba(0,0,0,0.05)] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                        Cari Buku
                        <ArrowRight aria-hidden="true" className="size-3" />
                    </button>
                </form>
            </div>
        </section>
    );
}
