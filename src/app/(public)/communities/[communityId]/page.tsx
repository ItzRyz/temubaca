import { ArrowLeft, BadgeCheck, BookOpen, CalendarDays, ChevronRight, MapPin, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { getCurrentUser } from "@/lib/auth";
import { findPublicCommunityProfile } from "@/lib/db/queries/communities";
import { listUpcomingPublicEvents } from "@/lib/db/queries/events";
import { listPublicMerchandise } from "@/lib/db/queries/merchandise";
import { uuidSchema } from "@/lib/validation/common";
import { colorFor, initialsOf } from "@/features/communities/components/community-card";
import { formatMerchandisePrice, merchandiseAvailabilityLabels } from "@/features/merchandise/format";
import { ShareButton } from "@/features/books/components/share-button";
import { ReportForm } from "@/features/reports/components/report-form";

type CommunityPageProps = {
    params: Promise<{ communityId: string }>;
};

export const dynamic = "force-dynamic";

const foundedFormatter = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const eventFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Jakarta" });


const findProfile = cache(async (communityId: string) => {
    const parsed = uuidSchema.safeParse(communityId);
    return parsed.success ? findPublicCommunityProfile(parsed.data) : null;
});

export async function generateMetadata({ params }: CommunityPageProps): Promise<Metadata> {
    const community = await findProfile((await params).communityId);
    return community ? { title: community.name, description: community.description?.slice(0, 160) ?? undefined } : {};
}

export default async function CommunityProfilePage({ params }: CommunityPageProps) {
    const community = await findProfile((await params).communityId);
    if (!community) notFound();

    const [events, merchandise, user] = await Promise.all([
        listUpcomingPublicEvents({ communityId: community.id, limit: 20 }),
        listPublicMerchandise({ communityId: community.id, limit: 20 }),
        getCurrentUser(),
    ]);

    const tabs = [
        { href: "#tentang", label: "Tentang", icon: BookOpen },
        { href: "#acara", label: "Acara", icon: CalendarDays, count: events.length },
        { href: "#merchandise", label: "Merchandise", icon: ShoppingBag, count: merchandise.length },
    ];
    const stats = [
        { value: community.activeMemberCount, label: "Warga terdaftar" },
        { value: events.length, label: "Acara mendatang" },
        { value: merchandise.length, label: "Merchandise" },
    ];

    return (
        <main className="mx-auto w-full max-w-[1256px] px-4 pb-8 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2 py-4 text-xs text-muted-foreground">
                <nav aria-label="Breadcrumb">
                    <ol className="flex list-none items-center gap-1 p-0">
                        <li><Link href="/" className="hover:text-foreground">Beranda</Link></li>
                        <li aria-hidden="true"><ChevronRight className="size-3" /></li>
                        <li><Link href="/communities" className="hover:text-foreground">Komunitas</Link></li>
                        <li aria-hidden="true"><ChevronRight className="size-3" /></li>
                        <li aria-current="page" className="max-w-48 truncate font-semibold text-foreground">{community.name}</li>
                    </ol>
                </nav>
                <Link href="/communities" className="flex items-center gap-1 font-semibold text-primary hover:underline">
                    <ArrowLeft aria-hidden="true" className="size-3.5" /> Kembali ke direktori komunitas
                </Link>
            </div>

            <section className="overflow-hidden rounded-2xl border border-border bg-card">
                <div aria-hidden="true" className="h-32 bg-[linear-gradient(135deg,#1b4d37,#3d7a5c_55%,#a9c7b2)] sm:h-48" />
                <div className="px-5 pb-6 sm:px-8">
                    <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
                        <div className="flex items-end gap-4">
                            <span aria-hidden="true" className={`flex size-24 shrink-0 items-center justify-center rounded-xl border-4 border-card font-heading text-2xl text-white shadow-md sm:size-28 ${colorFor(community.id)}`}>
                                {initialsOf(community.name)}
                            </span>
                            <div className="pb-1">
                                <h1 className="font-heading text-2xl leading-tight font-semibold text-[#1f2924] sm:text-[32px]">{community.name}</h1>
                                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#e7efe8] px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                                    <BadgeCheck aria-hidden="true" className="size-3" /> Terverifikasi
                                </p>
                            </div>
                        </div>
                        <ShareButton title={community.name} className="h-10 self-start rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted sm:self-auto" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {community.publicLocation && <span className="flex items-center gap-1"><MapPin aria-hidden="true" className="size-3.5" /> {community.publicLocation}</span>}
                        <span className="flex items-center gap-1"><CalendarDays aria-hidden="true" className="size-3.5" /> Terdaftar sejak {foundedFormatter.format(community.createdAt)}</span>
                    </div>
                    <div className="mt-5 grid gap-5 rounded-xl border border-border bg-[#faf7f0] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                        <p className="line-clamp-3 text-sm leading-6">{community.description || "Komunitas ini belum menambahkan deskripsi."}</p>
                        <dl className="flex gap-6 sm:border-l sm:border-border sm:pl-6">
                            {stats.map((stat) => (
                                <div key={stat.label} className="flex flex-col-reverse text-center">
                                    <dt className="text-[11px] text-muted-foreground">{stat.label}</dt>
                                    <dd className="font-heading text-xl font-semibold">{stat.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                        Verifikasi berarti komunitas telah ditinjau pengelola TemuBaca, bukan jaminan atas seluruh aktivitas anggotanya.
                    </p>
                </div>
            </section>

            <nav aria-label="Bagian profil" className="mt-6 flex w-fit gap-1 overflow-x-auto rounded-xl border border-border bg-[#f1f0ea] p-1">
                {tabs.map(({ href, label, icon: Icon, count }) => (
                    <a key={href} href={href} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-card hover:text-foreground">
                        <Icon aria-hidden="true" className="size-4" /> {label}
                        {count !== undefined && <span className="rounded-full bg-card px-1.5 text-[11px]">{count}</span>}
                    </a>
                ))}
            </nav>

            <div className="mt-6 flex flex-col gap-6">
                <section id="tentang" aria-labelledby="about-title" className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 sm:p-8">
                    <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-primary uppercase">
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" /> Tentang komunitas
                    </p>
                    <h2 id="about-title" className="mt-3 font-heading text-2xl font-semibold">{community.name}</h2>
                    <p className="mt-4 text-sm leading-7 whitespace-pre-line text-muted-foreground">
                        {community.description || "Komunitas ini belum menambahkan deskripsi."}
                    </p>
                    <ReportForm targetType="COMMUNITY" targetId={community.id} targetName={community.name} isAuthenticated={user !== null} />
                </section>

                <section id="acara" aria-labelledby="events-title" className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 sm:p-8">
                    <h2 id="events-title" className="flex items-center gap-2 font-heading text-xl font-semibold"><CalendarDays aria-hidden="true" className="size-5" /> Acara Mendatang</h2>
                    {events.length > 0 ? (
                        <ul className="mt-4 grid list-none gap-3 p-0 md:grid-cols-2">
                            {events.map((event) => (
                                <li key={event.id} className="rounded-xl border border-border bg-[#faf7f0] p-4">
                                    {event.startsAt && <p className="text-xs font-semibold text-primary">{eventFormatter.format(event.startsAt)} WIB</p>}
                                    <h3 className="mt-1 font-heading text-base font-semibold"><Link href={`/events/${event.id}`} className="hover:underline">{event.title}</Link></h3>
                                    {event.publicLocation && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin aria-hidden="true" className="size-3" /> {event.publicLocation}</p>}
                                    {event.description && <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{event.description}</p>}
                                    <ReportForm targetType="EVENT" targetId={event.id} targetName={event.title} isAuthenticated={user !== null} />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Belum ada acara terbit yang akan datang.</p>
                    )}
                </section>

                <section id="merchandise" aria-labelledby="merch-title" className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 sm:p-8">
                    <h2 id="merch-title" className="flex items-center gap-2 font-heading text-xl font-semibold"><ShoppingBag aria-hidden="true" className="size-5" /> Merchandise Komunitas</h2>
                    <p className="mt-1 text-xs text-muted-foreground">TemuBaca belum memproses pembayaran; konfirmasi pembelian langsung kepada komunitas.</p>
                    {merchandise.length > 0 ? (
                        <ul className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
                            {merchandise.map((item) => (
                                <li key={item.id} className="flex flex-col rounded-xl border border-border bg-[#faf7f0] p-4">
                                    <h3 className="text-sm font-semibold"><Link href={`/merchandise/${item.id}`} className="hover:underline">{item.title}</Link></h3>
                                    {item.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>}
                                    <div className="mt-auto flex items-center justify-between pt-3">
                                        <p className="text-sm font-bold text-primary">{formatMerchandisePrice(item)}</p>
                                        <span className="text-[11px] text-muted-foreground">{merchandiseAvailabilityLabels[item.availability]}</span>
                                    </div>
                                    <ReportForm targetType="MERCHANDISE_LISTING" targetId={item.id} targetName={item.title} isAuthenticated={user !== null} />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Belum ada merchandise terbit.</p>
                    )}
                </section>
            </div>
        </main>
    );
}
