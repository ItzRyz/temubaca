import { ArrowLeft, CalendarDays, ChevronRight, Clock, ExternalLink, MapPin, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { getCurrentUser } from "@/lib/auth";
import { findPublicEvent } from "@/lib/db/queries/events";
import { uuidSchema } from "@/lib/validation/common";
import { colorFor, initialsOf } from "@/features/communities/components/community-card";
import { ShareButton } from "@/features/books/components/share-button";
import { ReportForm } from "@/features/reports/components/report-form";

type EventPageProps = {
    params: Promise<{ eventId: string }>;
};

export const dynamic = "force-dynamic";

const timeZone = "Asia/Jakarta";
const monthFormatter = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone });
const dayFormatter = new Intl.DateTimeFormat("id-ID", { day: "numeric", timeZone });
const weekdayFormatter = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone });
const timeFormatter = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone });

/** Only http(s) links are rendered; anything else stored in eventUrl is ignored. */
function safeExternalUrl(value: string | null) {
    if (!value) return null;
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
    } catch {
        return null;
    }
}

const findEvent = cache(async (eventId: string) => {
    const parsed = uuidSchema.safeParse(eventId);
    return parsed.success ? findPublicEvent(parsed.data) : null;
});

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
    const event = await findEvent((await params).eventId);
    return event ? { title: event.title, description: event.description?.slice(0, 160) ?? undefined } : {};
}

export default async function EventDetailPage({ params }: EventPageProps) {
    const event = await findEvent((await params).eventId);
    if (!event) notFound();

    const user = await getCurrentUser();
    const eventUrl = safeExternalUrl(event.eventUrl);
    const lastMoment = event.endsAt ?? event.startsAt;
    const isPast = lastMoment !== null && lastMoment < new Date();
    const timeRange = event.startsAt
        ? `${timeFormatter.format(event.startsAt)}${event.endsAt ? ` – ${timeFormatter.format(event.endsAt)}` : ""} WIB`
        : null;

    return (
        <main className="mx-auto w-full max-w-[1256px] px-4 pb-8 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2 py-4 text-xs text-muted-foreground">
                <nav aria-label="Breadcrumb">
                    <ol className="flex list-none items-center gap-1 p-0">
                        <li><Link href="/events" className="hover:text-foreground">Acara</Link></li>
                        <li aria-hidden="true"><ChevronRight className="size-3" /></li>
                        <li aria-current="page" className="font-semibold text-foreground">Detail Acara</li>
                    </ol>
                </nav>
                <Link href="/events" className="flex items-center gap-1 font-semibold text-primary hover:underline">
                    <ArrowLeft aria-hidden="true" className="size-3.5" /> Kembali ke daftar acara
                </Link>
            </div>

            <section className="rounded-2xl border border-border bg-card p-5 sm:p-8">
                <p className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${isPast ? "bg-muted text-muted-foreground" : "bg-[#e7efe8] text-secondary-foreground"}`}>
                    <span aria-hidden="true" className={`size-1.5 rounded-full ${isPast ? "bg-muted-foreground" : "bg-primary"}`} />
                    {isPast ? "Sudah berlangsung" : "Akan datang"}
                </p>
                <h1 className="mt-4 max-w-3xl font-heading text-[28px] leading-tight font-bold text-[#1f2924] sm:text-[40px]">{event.title}</h1>
                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <Link href={`/communities/${event.communityId}`} className="flex items-center gap-3 hover:underline">
                        <span aria-hidden="true" className={`flex size-10 items-center justify-center rounded-lg font-heading text-sm text-white ${colorFor(event.communityId)}`}>
                            {initialsOf(event.communityName)}
                        </span>
                        <span>
                            <span className="block text-sm font-semibold">{event.communityName}</span>
                            <span className="block text-xs text-muted-foreground">Komunitas terverifikasi</span>
                        </span>
                    </Link>
                    <div className="flex gap-2">
                        {eventUrl && (
                            <a href={eventUrl} target="_blank" rel="noopener noreferrer nofollow" className="flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                                Info dari Penyelenggara <ExternalLink aria-hidden="true" className="size-3.5" />
                            </a>
                        )}
                        <ShareButton title={event.title} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted" />
                    </div>
                </div>
            </section>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_390px]">
                <div className="flex min-w-0 flex-col gap-6">
                    {event.startsAt && (
                        <section aria-label="Waktu acara" className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5">
                            <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-[#f1f0ea] py-2">
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase">{monthFormatter.format(event.startsAt)}</span>
                                <span className="font-heading text-2xl font-semibold">{dayFormatter.format(event.startsAt)}</span>
                            </div>
                            <div>
                                <p className="text-sm font-semibold capitalize">{weekdayFormatter.format(event.startsAt)}</p>
                                {timeRange && <p className="mt-1 flex items-center gap-1.5 font-heading text-lg font-semibold text-primary"><Clock aria-hidden="true" className="size-4" /> {timeRange}</p>}
                                <p className="mt-1 text-xs text-muted-foreground">Waktu ditampilkan dalam WIB. Konfirmasi perubahan jadwal kepada penyelenggara.</p>
                            </div>
                        </section>
                    )}

                    <section aria-labelledby="about-event-title" className="rounded-2xl border border-border bg-card p-5 sm:p-8">
                        <h2 id="about-event-title" className="flex items-center gap-2 font-heading text-xl font-semibold"><CalendarDays aria-hidden="true" className="size-5" /> Tentang Acara Ini</h2>
                        <p className="mt-4 text-base leading-7 whitespace-pre-line text-foreground/85">
                            {event.description || "Penyelenggara belum menambahkan deskripsi acara."}
                        </p>
                        <ReportForm targetType="EVENT" targetId={event.id} targetName={event.title} isAuthenticated={user !== null} />
                    </section>

                    <section className="flex gap-3 rounded-2xl bg-[#e7efe8] p-5">
                        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                        <div>
                            <h2 className="font-sans text-sm font-semibold">Komitmen Ruang Aman TemuBaca</h2>
                            <p className="mt-1 text-xs leading-5 text-foreground/80">
                                Acara di TemuBaca diadakan di ruang publik dan terbuka untuk semua pembaca. Laporkan perilaku atau konten yang tidak pantas agar ditinjau pengelola.
                            </p>
                        </div>
                    </section>
                </div>

                <aside className="flex flex-col gap-6">
                    <section aria-labelledby="location-title" className="rounded-2xl border border-border bg-card p-5">
                        <h2 id="location-title" className="flex items-center gap-2 font-heading text-lg font-semibold"><MapPin aria-hidden="true" className="size-4" /> Lokasi</h2>
                        <p className="mt-3 text-sm leading-6">{event.publicLocation ?? "Lokasi akan diumumkan oleh penyelenggara."}</p>
                        <p className="mt-3 rounded-lg bg-[#f1f0ea] p-3 text-xs leading-5 text-muted-foreground">
                            Peta dan petunjuk arah belum tersedia. Hanya lokasi publik umum yang ditampilkan.
                        </p>
                    </section>

                    <section aria-labelledby="organizer-title" className="rounded-2xl border border-border bg-card p-5">
                        <h2 id="organizer-title" className="flex items-center gap-2 font-heading text-lg font-semibold"><Users aria-hidden="true" className="size-4" /> Penyelenggara</h2>
                        <p className="mt-3 text-sm">{event.communityName}</p>
                        <Link href={`/communities/${event.communityId}`} className="mt-4 flex min-h-10 items-center justify-center rounded-lg border border-border text-sm font-semibold hover:bg-muted">
                            Lihat profil komunitas
                        </Link>
                    </section>
                </aside>
            </div>
        </main>
    );
}
