import { ArrowRight, CalendarDays, MapPin, UsersRound } from "lucide-react";
import Link from "next/link";

import { EmptyState, SectionHeader } from "./section-header";

const eventDateFormatter = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
});

export type HomeEvent = {
    id: string;
    title: string;
    startsAt: Date | null;
    publicLocation: string | null;
    communityName: string;
};

export function HomeEvents({
    events,
    total,
    title = "Agenda Baca Terdekat",
    description = "Ikuti lingkar baca, diskusi, dan pertukaran buku dari komunitas terverifikasi.",
}: {
    events: HomeEvent[];
    total: number;
    title?: string;
    description?: string;
}) {
    return (
        <section aria-labelledby="home-events-title" className="px-4 py-8 sm:px-9">
            <div className="mx-auto flex max-w-[1208px] flex-col gap-6">
                <SectionHeader
                    id="home-events-title"
                    title={title}
                    description={description}
                />
                {events.length > 0 ? (
                    <ul className="grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-3">
                        {events.map((event) => (
                            <li key={event.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_4px_16px_rgba(31,41,36,0.06)]">
                                <div aria-hidden="true" className="flex h-[190px] items-center justify-center bg-secondary/60 text-primary/60">
                                    <UsersRound className="size-12" />
                                </div>
                                <div className="flex flex-1 flex-col p-5">
                                    {event.startsAt && (
                                        <p className="flex items-center gap-1 text-xs font-semibold uppercase text-[#161d19]">
                                            <CalendarDays aria-hidden="true" className="size-3.5 text-destructive" />
                                            {eventDateFormatter.format(event.startsAt)} WIB
                                        </p>
                                    )}
                                    <h3 className="mt-2 line-clamp-2 font-heading text-lg leading-6 font-bold text-[#1f2924]"><Link href={`/events/${event.id}`} className="hover:underline">{event.title}</Link></h3>
                                    <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                                        <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                                        {event.publicLocation ?? "Lokasi diumumkan oleh komunitas"}
                                    </p>
                                    <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                                        <p className="truncate text-xs text-muted-foreground">{event.communityName}</p>
                                        <Link href={`/events/${event.id}`} className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                                            Lihat Kegiatan
                                        </Link>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <EmptyState>Belum ada agenda terbit dari komunitas terverifikasi. Cek kembali nanti.</EmptyState>
                )}
                {total > 0 && (
                    <Link href="/events" className="flex items-center gap-1 self-end text-sm font-semibold text-[#003622] hover:underline">
                        Lihat semua agenda ({total}) <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                )}
            </div>
        </section>
    );
}
