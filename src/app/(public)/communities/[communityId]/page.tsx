import { ArrowRight, BadgeCheck, BookOpen, CalendarDays, ChevronRight, Info, Library, MapPin, ShieldCheck, ShoppingBag, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";

import { getCurrentUser } from "@/lib/auth";
import { communityContactLinks } from "@/features/community-management/contacts";
import { getCommunityAccess } from "@/lib/db/queries/community-management";
import { findPublicCommunityProfile, saveInstagramFollowers } from "@/lib/db/queries/communities";
import { instagramFollowersLabel, instagramNeedsRefresh } from "@/features/communities/instagram";
import { fetchInstagramFollowers, isInstagramConfigured } from "@/lib/external/instagram";
import { listPastPublicEvents, listUpcomingPublicEvents } from "@/lib/db/queries/events";
import { listPublicMerchandise } from "@/lib/db/queries/merchandise";
import { listPublicCommunityBookListings } from "@/lib/db/queries/books";
import { findPublicPin } from "@/lib/db/queries/places";
import { MerchandiseThumb } from "@/features/merchandise/components/merchandise-thumb";
import { lastCommunityApproval } from "@/lib/db/queries/verifications";
import { uuidSchema } from "@/lib/validation/common";
import { CommunityAvatar } from "@/features/communities/components/community-card";
import { regionByCode } from "@/features/regions/regions";
import { formatMerchandisePrice, merchandiseAvailabilityLabels } from "@/features/merchandise/format";
import { ShareButton } from "@/features/books/components/share-button";
import { ReportForm } from "@/features/reports/components/report-form";
import { EventImage } from "@/features/communities/components/event-image";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata, siteUrl, snippet } from "@/config/site";
import { merchandisePhotoUrl } from "@/features/merchandise/format";
import { CommunityBanner } from "@/features/community-management/components/community-logo-form";
import { cn } from "@/lib/utils";

type CommunityPageProps = {
    params: Promise<{ communityId: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

const monthYear = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const longDate = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const eventDay = new Intl.DateTimeFormat("id-ID", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const eventStamp = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const dayNumber = new Intl.DateTimeFormat("id-ID", { day: "2-digit", timeZone: "Asia/Jakarta" });
const monthShort = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "Asia/Jakarta" });

const tabs = [
    { key: "tentang", label: "Tentang", icon: BookOpen },
    { key: "acara", label: "Acara", icon: CalendarDays },
    { key: "merchandise", label: "Merchandise", icon: ShoppingBag },
    { key: "koleksi", label: "Koleksi Buku", icon: Library },
] as const;
type Tab = (typeof tabs)[number]["key"];

const findProfile = cache(async (communityId: string) => {
    const parsed = uuidSchema.safeParse(communityId);
    return parsed.success ? findPublicCommunityProfile(parsed.data) : null;
});

export async function generateMetadata({ params }: CommunityPageProps): Promise<Metadata> {
    const community = await findProfile((await params).communityId);
    if (!community) return {};
    const image = community.bannerPath ?? community.logoPath;
    return pageMetadata({
        title: community.name,
        description: snippet(community.description, `${community.name}, komunitas baca terverifikasi di TemuBaca. Lihat agenda, merchandise, dan cara bergabung.`),
        path: `/communities/${community.id}`,
        image: image ? merchandisePhotoUrl(image) : null,
    });
}

function DateBadge({ date }: { date: Date }) {
    return (
        <span aria-hidden="true" className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg bg-[#e7efe8] text-primary">
            <span className="font-heading text-lg leading-none font-semibold">{dayNumber.format(date)}</span>
            <span className="text-[10px] font-semibold uppercase">{monthShort.format(date)}</span>
        </span>
    );
}

/** Figma "Profil Komunitas" revision 260:2264 with tabs 262:2321 (Acara) and 263:2378 (Merchandise). */
export default async function CommunityProfilePage({ params, searchParams }: CommunityPageProps) {
    const community = await findProfile((await params).communityId);
    if (!community) notFound();
    // The follower count is re-read in the background at most daily; this view shows the cached one.
    if (community.instagramHandle && isInstagramConfigured() && instagramNeedsRefresh(community)) {
        const handle = community.instagramHandle;
        after(async () => saveInstagramFollowers(community.id, handle, await fetchInstagramFollowers(handle)));
    }
    const followers = instagramFollowersLabel(community.instagramFollowers);
    const requested = (await searchParams).tab;
    const tab: Tab = tabs.some((item) => item.key === requested) ? requested as Tab : "tentang";

    const [upcoming, past, merchandise, approvedAt, user, pin, collection] = await Promise.all([
        listUpcomingPublicEvents({ communityId: community.id, limit: 20 }),
        tab === "acara" ? listPastPublicEvents(community.id) : Promise.resolve([]),
        listPublicMerchandise({ communityId: community.id, limit: 30 }),
        lastCommunityApproval(community.id),
        getCurrentUser(),
        findPublicPin({ communityId: community.id }),
        listPublicCommunityBookListings(community.id),
    ]);
    const counts: Record<Tab, number | undefined> = { tentang: undefined, acara: upcoming.length, merchandise: merchandise.length, koleksi: collection.length };
    const hrefFor = (key: Tab) => (key === "tentang" ? `/communities/${community.id}` : `/communities/${community.id}?tab=${key}`);
    const signedIn = user !== null;
    const canManage = user ? Boolean((await getCommunityAccess(user.id, community.id))?.role) : false;
    const contacts = communityContactLinks(community);

    return (
        <main className="mx-auto w-full max-w-[1256px] px-4 pb-10 sm:px-6">
            <JsonLd data={{
                "@context": "https://schema.org",
                "@type": "Organization",
                name: community.name,
                url: new URL(`/communities/${community.id}`, siteUrl).toString(),
                ...(community.description ? { description: snippet(community.description, "") } : {}),
                ...(community.logoPath ? { logo: merchandisePhotoUrl(community.logoPath) } : {}),
                ...(community.publicLocation ? { areaServed: community.publicLocation } : {}),
                ...(community.instagramHandle ? { sameAs: [`https://instagram.com/${encodeURIComponent(community.instagramHandle)}`] } : {}),
            }} />
            <nav aria-label="Breadcrumb" className="py-4 text-xs text-muted-foreground">
                <ol className="flex list-none items-center gap-1 p-0">
                    <li><Link href="/" className="hover:text-foreground">Beranda</Link></li>
                    <li aria-hidden="true">/</li>
                    <li><Link href="/communities" className="hover:text-foreground">Komunitas</Link></li>
                    <li aria-hidden="true">/</li>
                    <li aria-current="page" className="max-w-48 truncate font-semibold text-foreground">{community.name}</li>
                </ol>
            </nav>

            <section className="overflow-hidden rounded-2xl border border-border bg-card">
                <CommunityBanner bannerPath={community.bannerPath} className="h-28 sm:h-40" />
                <div className="px-5 pb-6 sm:px-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-end gap-4">
                            <CommunityAvatar community={community} className="-mt-10 size-20 rounded-xl border-4 border-card text-2xl shadow-md sm:-mt-12 sm:size-24" />
                            <h1 className="pt-3 font-heading text-2xl leading-tight font-semibold text-primary sm:text-[32px]">{community.name}</h1>
                        </div>
                        <div className="flex flex-wrap gap-2 self-start sm:mt-4">
                            {canManage && (
                                <Link href={`/communities/${community.id}/manage`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Kelola Komunitas</Link>
                            )}
                            <ShareButton title={community.name} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted" />
                        </div>
                    </div>
                    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#c9ecd6] px-2 py-0.5 font-semibold text-primary"><BadgeCheck aria-hidden="true" className="size-3" /> Terverifikasi</span>
                        {regionByCode(community.regionCode) && <span className="flex items-center gap-1"><MapPin aria-hidden="true" className="size-3.5" /> {regionByCode(community.regionCode)!.name}</span>}
                        <span className="flex items-center gap-1"><CalendarDays aria-hidden="true" className="size-3.5" /> Bergabung di TemuBaca sejak {monthYear.format(community.createdAt)}</span>
                        {followers && community.instagramHandle && (
                            <a href={`https://instagram.com/${encodeURIComponent(community.instagramHandle)}`} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 font-semibold text-foreground hover:underline">
                                <UsersRound aria-hidden="true" className="size-3.5" /> {followers}
                            </a>
                        )}
                    </p>
                    <p className="mt-4 max-w-3xl text-sm leading-6 text-foreground/85">{community.description || "Komunitas ini belum menambahkan deskripsi."}</p>
                    {community.interests.length > 0 && (
                        <ul aria-label="Minat bacaan" className="mt-3 flex list-none flex-wrap gap-2 p-0">
                            {community.interests.map((interest) => <li key={interest} className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{interest}</li>)}
                        </ul>
                    )}
                    <dl className="mt-5 grid gap-4 rounded-xl border border-border bg-[#faf7f0] p-4 sm:grid-cols-3">
                        <div>
                            <dt className="flex items-center gap-1 text-xs font-semibold text-primary"><MapPin aria-hidden="true" className="size-3.5" /> Titik berkumpul</dt>
                            <dd className="mt-1 text-sm font-medium">{community.publicLocation ?? "Diumumkan per acara"}</dd>
                        </div>
                        <div className="sm:border-l sm:border-border sm:pl-4">
                            <dt className="flex items-center gap-1 text-xs font-semibold text-primary"><CalendarDays aria-hidden="true" className="size-3.5" /> Agenda</dt>
                            <dd className="mt-1 text-sm font-medium">{upcoming[0]?.startsAt ? `Berikutnya ${eventStamp.format(upcoming[0].startsAt)} WIB` : "Belum ada acara terjadwal"}</dd>
                        </div>
                        <div className="sm:border-l sm:border-border sm:pl-4">
                            <dt className="flex items-center gap-1 text-xs font-semibold text-primary"><ShieldCheck aria-hidden="true" className="size-3.5" /> Status profil</dt>
                            <dd className="mt-1 text-sm font-medium">{approvedAt ? `Ditinjau ${longDate.format(approvedAt)}` : "Terverifikasi"}</dd>
                            <dd className="text-xs text-muted-foreground">oleh tim TemuBaca</dd>
                        </div>
                    </dl>
                    {contacts.length > 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                            <span className="text-xs font-semibold text-primary">Kontak publik:</span>
                            {contacts.map((contact) => (
                                <a key={contact.kind} href={contact.href} target="_blank" rel="noopener noreferrer nofollow"
                                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:bg-muted">
                                    {contact.label} · {contact.value}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <nav aria-label="Bagian profil" className="mt-6 flex gap-6 overflow-x-auto border-b border-border">
                {tabs.map(({ key, label, icon: Icon }) => (
                    <Link
                        key={key}
                        href={hrefFor(key)}
                        aria-current={tab === key ? "page" : undefined}
                        className={cn(
                            "-mb-px flex min-h-11 items-center gap-1.5 border-b-2 text-sm whitespace-nowrap",
                            tab === key ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                    >
                        <Icon aria-hidden="true" className="size-4" /> {label}
                        {counts[key] !== undefined && <span className="rounded-full bg-[#ebe9e1] px-1.5 text-[11px] text-foreground/80">{counts[key]}</span>}
                    </Link>
                ))}
            </nav>

            {tab === "tentang" && (
                <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
                    <div className="flex min-w-0 flex-col gap-6">
                        <section aria-labelledby="story-title" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                            <h2 id="story-title" className="font-heading text-xl font-semibold">Kisah Komunitas</h2>
                            <p className="mt-3 text-sm leading-7 whitespace-pre-line text-muted-foreground">{community.description || "Komunitas ini belum menambahkan kisahnya."}</p>
                        </section>
                        <section aria-labelledby="next-title" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <div>
                                    <h2 id="next-title" className="font-heading text-xl font-semibold">Acara Berikutnya</h2>
                                    <p className="text-xs text-muted-foreground">Jadwal temu dari komunitas ini</p>
                                </div>
                                {upcoming.length > 3 && (
                                    <Link href={hrefFor("acara")} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary hover:underline">
                                        Lihat Semua Acara ({upcoming.length}) <ArrowRight aria-hidden="true" className="size-4" />
                                    </Link>
                                )}
                            </div>
                            {upcoming.length > 0 ? (
                                <ul className="mt-4 list-none divide-y divide-border p-0">
                                    {upcoming.slice(0, 3).map((event) => (
                                        <li key={event.id} className="flex items-center gap-4 py-3">
                                            {event.startsAt && <DateBadge date={event.startsAt} />}
                                            <div className="min-w-0 flex-1">
                                                <h3 className="truncate font-heading text-base font-semibold">{event.title}</h3>
                                                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                                                    <MapPin aria-hidden="true" className="size-3 shrink-0" />
                                                    {[event.startsAt ? `${eventDay.format(event.startsAt)} WIB` : null, event.publicLocation].filter(Boolean).join(" · ")}
                                                </p>
                                            </div>
                                            <Link href={`/events/${event.id}`} className="inline-flex min-h-10 shrink-0 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                                                Lihat Detail<span className="sr-only">: {event.title}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Belum ada acara terbit yang akan datang.</p>
                            )}
                        </section>
                    </div>

                    <aside className="flex flex-col gap-6">
                        <section aria-labelledby="place-title" className="rounded-2xl border border-border bg-card p-5">
                            <h2 id="place-title" className="flex items-center gap-2 font-heading text-lg font-semibold"><MapPin aria-hidden="true" className="size-4" /> Lokasi Pertemuan</h2>
                            <p className="mt-3 text-sm font-semibold">{community.publicLocation ?? "Diumumkan per acara"}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">Lokasi umum yang dipakai komunitas. Titik temu tepat diumumkan di setiap acara.</p>
                            {pin && (
                                <Link href={`/map?tempat=${pin.id}`} className="mt-4 flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted">
                                    <MapPin aria-hidden="true" className="size-4" /> Lihat di Peta Literasi
                                </Link>
                            )}
                        </section>
                        <section aria-labelledby="merch-side-title" className="rounded-2xl bg-[#e7efe8] p-5">
                            <h2 id="merch-side-title" className="font-heading text-lg font-semibold">Merchandise Komunitas</h2>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {merchandise.length > 0
                                    ? `${merchandise.length} produk dari komunitas ini. Pembelian dilakukan langsung dengan komunitas; TemuBaca tidak memproses pembayaran.`
                                    : "Komunitas ini belum menerbitkan merchandise."}
                            </p>
                            {merchandise.length > 0 && (
                                <Link href={hrefFor("merchandise")} className="mt-4 inline-flex min-h-10 items-center gap-1 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                                    Lihat Merchandise <ArrowRight aria-hidden="true" className="size-4" />
                                </Link>
                            )}
                        </section>
                        <section aria-labelledby="verify-title" className="rounded-2xl border border-border bg-card p-5">
                            <h2 id="verify-title" className="flex items-center gap-2 font-heading text-lg font-semibold"><ShieldCheck aria-hidden="true" className="size-4" /> Tentang Verifikasi</h2>
                            <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                Terverifikasi berarti profil komunitas sudah ditinjau tim TemuBaca. Ini bukan jaminan keamanan setiap kegiatan, jadi tetap bertemu di ruang publik.
                            </p>
                            <ReportForm targetType="COMMUNITY" targetId={community.id} targetName={community.name} isAuthenticated={signedIn} label="Laporkan komunitas ini" />
                        </section>
                    </aside>
                </div>
            )}

            {tab === "acara" && (
                <div className="mt-6 flex flex-col gap-6">
                    <section aria-labelledby="upcoming-title">
                        <h2 id="upcoming-title" className="font-heading text-[28px] font-semibold text-primary">Acara Mendatang</h2>
                        <p className="text-sm text-muted-foreground">Temu baca rutin dan kegiatan terbuka dari {community.name}.</p>
                        {upcoming.length > 0 ? (
                            <ul className="mt-5 grid list-none gap-5 p-0 md:grid-cols-3">
                                {upcoming.map((event) => (
                                    <li key={event.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
                                        {event.imagePath ? <EventImage path={event.imagePath} className="h-36 aspect-auto" /> : <div aria-hidden="true" className="flex h-36 items-center justify-center bg-secondary/60 text-primary/50"><CalendarDays className="size-10" /></div>}
                                        <div className="flex flex-1 flex-col p-5">
                                            {event.startsAt && <p className="flex items-center gap-1 text-xs font-semibold text-foreground uppercase"><CalendarDays aria-hidden="true" className="size-3.5 text-destructive" /> {eventStamp.format(event.startsAt)} WIB</p>}
                                            <h3 className="mt-2 font-heading text-lg leading-6 font-semibold">{event.title}</h3>
                                            {event.publicLocation && <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin aria-hidden="true" className="size-3.5 shrink-0" /> {event.publicLocation}</p>}
                                            <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                                                <p className="truncate text-xs text-muted-foreground">Oleh {community.name}</p>
                                                <Link href={`/events/${event.id}`} className="inline-flex min-h-10 shrink-0 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                                                    Lihat Detail<span className="sr-only">: {event.title}</span>
                                                </Link>
                                            </div>
                                            <ReportForm targetType="EVENT" targetId={event.id} targetName={event.title} isAuthenticated={signedIn} />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-5 rounded-xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground">Belum ada acara terbit yang akan datang.</p>
                        )}
                    </section>
                    <section aria-labelledby="past-title" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                        <h2 id="past-title" className="font-heading text-xl font-semibold">Acara Sebelumnya</h2>
                        <p className="text-xs text-muted-foreground">Arsip temu baca yang sudah berlangsung</p>
                        {past.length > 0 ? (
                            <ul className="mt-4 list-none divide-y divide-border p-0">
                                {past.map((event) => (
                                    <li key={event.id} className="flex items-center gap-4 py-3">
                                        {event.startsAt && <DateBadge date={event.startsAt} />}
                                        <div className="min-w-0 flex-1">
                                            <h3 className="truncate font-heading text-base font-semibold"><Link href={`/events/${event.id}`} className="hover:underline">{event.title}</Link></h3>
                                            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                                                <MapPin aria-hidden="true" className="size-3 shrink-0" />
                                                {[event.startsAt ? `${eventDay.format(event.startsAt)} WIB` : null, event.publicLocation].filter(Boolean).join(" · ")}
                                            </p>
                                        </div>
                                        <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">Selesai</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-4 text-sm text-muted-foreground">Belum ada arsip acara.</p>
                        )}
                    </section>
                </div>
            )}

            {tab === "koleksi" && (
                <section aria-labelledby="collection-title" className="mt-6">
                    <h2 id="collection-title" className="font-heading text-[28px] font-semibold text-primary">Koleksi Buku</h2>
                    <p className="text-sm text-muted-foreground">Buku milik {community.name} yang bisa dipinjam. Buka bukunya untuk mengajukan pinjam; serah terima dilakukan pengurus di titik temu publik.</p>
                    {collection.length > 0 ? (
                        <ul className="mt-4 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
                            {collection.map((listing) => (
                                <li key={listing.id} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
                                    <span aria-hidden="true" className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-primary text-primary-foreground">
                                        {listing.book.coverUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={listing.book.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
                                        ) : <BookOpen className="size-5 opacity-70" />}
                                    </span>
                                    <div className="flex min-w-0 flex-1 flex-col">
                                        <h3 className="line-clamp-2 font-heading text-base font-semibold"><Link href={`/books/${listing.book.id}#cara-membaca`} className="hover:underline">{listing.book.title}</Link></h3>
                                        <p className="truncate text-xs text-muted-foreground">{listing.book.authors.join(", ") || "Penulis belum tercatat"}</p>
                                        <p className={cn("mt-2 w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold", listing.availability === "AVAILABLE" ? "bg-[#c9ecd6] text-primary" : "bg-[#fbe7c6] text-[#7a4b00]")}>
                                            {listing.availability === "AVAILABLE" ? "Bisa dipinjam" : "Sedang dipesan"}
                                        </p>
                                        <Link href={`/books/${listing.book.id}#cara-membaca`} className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-semibold text-primary hover:underline">
                                            {listing.availability === "AVAILABLE" ? "Ajukan Pinjam" : "Lihat Buku"} <ArrowRight aria-hidden="true" className="size-3.5" /><span className="sr-only">: {listing.book.title}</span>
                                        </Link>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Komunitas ini belum menambahkan buku ke koleksinya.</p>
                    )}
                </section>
            )}

            {tab === "merchandise" && (
                <div className="mt-6 flex flex-col gap-6">
                    <section aria-labelledby="merch-title">
                        <h2 id="merch-title" className="font-heading text-[28px] font-semibold text-primary">Merchandise Komunitas</h2>
                        <p className="text-sm text-muted-foreground">Produk buatan {community.name}. Pembelian turut mendukung kegiatan komunitas.</p>
                        <p className="mt-4 flex gap-3 rounded-xl bg-[#e7efe8] p-4 text-sm">
                            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                            <span>
                                <span className="block font-semibold">Pembelian dilakukan langsung dengan komunitas</span>
                                <span className="text-muted-foreground">TemuBaca tidak memproses pembayaran, pengiriman, atau pengembalian dana. Harga dan stok diatur oleh komunitas dan dapat berubah.</span>
                            </span>
                        </p>
                        {merchandise.length > 0 ? (
                            <ul className="mt-5 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
                                {merchandise.map((item) => (
                                    <li key={item.id} className="flex flex-col rounded-2xl border border-border bg-card p-4">
                                        <MerchandiseThumb photoPaths={item.photoPaths} className="aspect-square" />
                                        <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                                        {item.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>}
                                        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                                            <p className="text-sm font-bold">{formatMerchandisePrice(item)}</p>
                                            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", item.availability === "AVAILABLE" ? "bg-[#c9ecd6] text-primary" : "border border-border text-muted-foreground")}>
                                                {merchandiseAvailabilityLabels[item.availability]}
                                            </span>
                                        </div>
                                        <Link href={`/merchandise/${item.id}`} className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                                            Lihat Detail<span className="sr-only">: {item.title}</span>
                                        </Link>
                                        <ReportForm targetType="MERCHANDISE_LISTING" targetId={item.id} targetName={item.title} isAuthenticated={signedIn} />
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-5 rounded-xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground">Komunitas ini belum menerbitkan merchandise.</p>
                        )}
                    </section>
                    <section aria-labelledby="howto-title" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                        <h2 id="howto-title" className="font-heading text-xl font-semibold">Cara Membeli</h2>
                        <ol className="mt-4 grid list-none gap-4 p-0 md:grid-cols-3">
                            {[
                                ["Pilih produk", "Buka detail produk untuk melihat harga dan ketersediaan terbaru."],
                                ["Sepakati dengan komunitas", "Temui komunitas di acara atau titik berkumpulnya untuk menyepakati harga, stok, dan cara bayar."],
                                ["Terima barang", "Lakukan serah terima di ruang publik. Laporkan jika ada yang tidak sesuai."],
                            ].map(([title, text], index) => (
                                <li key={title} className="flex gap-3">
                                    <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e7efe8] text-xs font-semibold text-primary">{index + 1}</span>
                                    <span>
                                        <span className="block text-sm font-semibold">{title}</span>
                                        <span className="block text-xs leading-5 text-muted-foreground">{text}</span>
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </section>
                </div>
            )}

            <p className="mt-8 flex items-center gap-1 text-sm">
                <Link href="/communities" className="inline-flex min-h-10 items-center gap-1 font-semibold text-primary hover:underline">
                    <ChevronRight aria-hidden="true" className="size-4 rotate-180" /> Kembali ke direktori komunitas
                </Link>
            </p>
        </main>
    );
}
