import { ArrowRight, Search, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { countPublicCommunities, listCommunities } from "@/lib/db/queries/communities";
import { countUpcomingPublicEvents, listUpcomingPublicEvents } from "@/lib/db/queries/events";
import { CatalogPagination } from "@/features/books/components/catalog-pagination";
import { CommunityCard } from "@/features/communities/components/community-card";
import { HomeEvents } from "@/features/home/components/home-events";
import { EmptyState, SectionHeader } from "@/features/home/components/section-header";
import { publicCommunityQuerySchema } from "@/lib/validation/schemas/public-catalog.schema";

type CommunitiesPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleValue(value: string | string[] | undefined) {
    return typeof value === "string" ? value : undefined;
}

export const metadata: Metadata = {
    title: "Komunitas & acara literasi",
    description: "Jelajahi komunitas baca terverifikasi dan acara literasi yang akan datang di TemuBaca.",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 6;

export default async function CommunitiesPage({ searchParams }: CommunitiesPageProps) {
    const params = await searchParams;
    const rawQuery = singleValue(params.q);
    const parsed = publicCommunityQuerySchema.safeParse({
        q: rawQuery?.trim() ? rawQuery : undefined,
        page: singleValue(params.page),
    });
    const q = parsed.success ? parsed.data.q : undefined;
    const page = parsed.success ? parsed.data.page : 1;
    const showEvents = page === 1 && !q;

    const [communities, total, events, eventTotal, user] = await Promise.all([
        listCommunities({ query: q, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
        countPublicCommunities(q),
        showEvents ? listUpcomingPublicEvents({ limit: 3 }) : Promise.resolve([]),
        showEvents ? countUpcomingPublicEvents() : Promise.resolve(0),
        getCurrentUser(),
    ]);
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const pageHref = (nextPage: number) => {
        const search = new URLSearchParams();
        if (q) search.set("q", q);
        if (nextPage > 1) search.set("page", String(nextPage));
        const query = search.toString();
        return query ? `/communities?${query}` : "/communities";
    };

    return (
        <main>
            <section className="px-4 pt-8 pb-10 sm:px-9 sm:py-12">
                <div className="mx-auto max-w-[1208px] rounded-[28px] border border-border bg-card p-6 shadow-[0_12px_32px_rgba(31,41,36,0.09)] sm:p-14">
                    <h1 className="max-w-[720px] font-heading text-[32px] leading-[1.25] font-normal tracking-[-1.05px] text-[#1f2924] sm:text-[42px]">
                        Temukan Lingkaran Baca &amp; Acara Literasi di Sekitarmu.
                    </h1>
                    <p className="mt-3 max-w-[600px] text-base leading-[26px] text-muted-foreground">
                        Jelajahi komunitas baca terverifikasi dan agenda diskusi buku di ruang publik yang aman dan ramah.
                    </p>
                    <form action="/communities" method="get" role="search" className="mt-6 flex flex-col gap-2 rounded-2xl border border-border bg-background p-4 sm:flex-row">
                        <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-card px-4 focus-within:ring-2 focus-within:ring-ring/30">
                            <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                            <span className="sr-only">Cari nama komunitas</span>
                            <input name="q" type="search" maxLength={100} defaultValue={rawQuery ?? ""} placeholder="Cari nama komunitas..." className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                        </label>
                        <button type="submit" className="flex min-h-11 items-center justify-center gap-1 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                            Cari Komunitas <ArrowRight aria-hidden="true" className="size-3" />
                        </button>
                    </form>
                    {!parsed.success && <p role="alert" className="mt-3 text-sm text-destructive">Parameter pencarian atau halaman tidak valid.</p>}
                </div>
            </section>

            <section aria-labelledby="communities-title" className="px-4 py-8 sm:px-9">
                <div className="mx-auto flex max-w-[1208px] flex-col gap-6">
                    <SectionHeader
                        id="communities-title"
                        title={q ? `Komunitas untuk “${q}”` : "Komunitas Aktif"}
                        description={`${total} komunitas terverifikasi. Verifikasi berarti komunitas telah ditinjau pengelola, bukan jaminan atas seluruh aktivitas anggotanya.`}
                    />
                    {communities.length > 0 ? (
                        <ul className="grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
                            {communities.map((community) => (
                                <li key={community.id}><CommunityCard community={community} isAuthenticated={user !== null} /></li>
                            ))}
                        </ul>
                    ) : (
                        <EmptyState>{q ? "Belum ada komunitas yang cocok dengan pencarian ini." : "Komunitas terverifikasi akan muncul di sini."}</EmptyState>
                    )}
                    <CatalogPagination page={page} totalPages={totalPages} hrefFor={pageHref} />
                </div>
            </section>

            {showEvents && (
                <HomeEvents
                    events={events}
                    total={eventTotal}
                    title="Acara Literasi"
                    description="Diskusi buku, bedah buku, dan agenda literasi dari komunitas terverifikasi."
                />
            )}

            <section className="px-4 py-8 sm:px-9">
                <div className="mx-auto flex max-w-[1208px] flex-col gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-4">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e7efe8] text-primary">
                            <ShieldCheck aria-hidden="true" className="size-5" />
                        </span>
                        <div>
                            <h2 className="font-heading text-lg font-semibold">Ruang Aman Bersama TemuBaca</h2>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                                Temui komunitas di ruang publik, hargai sesama pembaca, dan laporkan konten yang tidak pantas agar ditinjau pengelola.
                            </p>
                        </div>
                    </div>
                    <Link href="/about" className="flex shrink-0 items-center justify-center gap-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
                        Tentang TemuBaca <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                </div>
            </section>
        </main>
    );
}
