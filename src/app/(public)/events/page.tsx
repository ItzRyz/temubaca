import type { Metadata } from "next";
import Link from "next/link";

import { countUpcomingPublicEvents, listUpcomingPublicEvents } from "@/lib/db/queries/events";
import { getCurrentUser } from "@/lib/auth";
import { ReportForm } from "@/features/reports/components/report-form";
import { publicEventQuerySchema } from "@/lib/validation/schemas/public-catalog.schema";

type EventsPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleValue(value: string | string[] | undefined) {
    return typeof value === "string" ? value : undefined;
}

export const metadata: Metadata = {
    title: "Acara baca",
    description: "Temukan acara mendatang dari komunitas baca terverifikasi di TemuBaca.",
};

export const dynamic = "force-dynamic";

const eventDateFormatter = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
});

export default async function EventsPage({ searchParams }: EventsPageProps) {
    const params = await searchParams;
    const parsed = publicEventQuerySchema.safeParse({
        page: singleValue(params.page),
        limit: singleValue(params.limit),
    });
    const query = parsed.success ? parsed.data : null;
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const offset = (page - 1) * limit;
    const now = new Date();
    const [events, user] = await Promise.all([
        query ? listUpcomingPublicEvents({ limit, offset, now }) : Promise.resolve([]),
        getCurrentUser(),
    ]);
    const total = query ? await countUpcomingPublicEvents(now) : 0;
    const totalPages = query ? Math.ceil(total / limit) : 0;

    return (
        <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
            <header className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Baca bersama</p>
                <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">Acara mendatang</h1>
                <p className="mt-4 text-base leading-7 text-muted-foreground">
                    Acara yang dipublikasikan oleh komunitas terverifikasi. Waktu ditampilkan dalam WIB.
                </p>
                {!parsed.success && <p role="alert" className="mt-3 text-sm text-destructive">Parameter halaman tidak valid.</p>}
            </header>

            {events.length > 0 ? (
                <ul className="mt-10 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2">
                    {events.map((event) => (
                        <li key={event.id}>
                            <article className="h-full rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
                                <p className="text-sm font-medium text-primary">{eventDateFormatter.format(event.startsAt!)}</p>
                                <h2 className="mt-2 font-heading text-xl font-semibold"><Link href={`/events/${event.id}`} className="hover:underline">{event.title}</Link></h2>
                                <p className="mt-1 text-sm text-muted-foreground">{event.communityName}</p>
                                {event.publicLocation && <p className="mt-4 text-sm">{event.publicLocation}</p>}
                                {event.description && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">{event.description}</p>}
                                {event.endsAt && <p className="mt-4 text-xs text-muted-foreground">Selesai: {eventDateFormatter.format(event.endsAt)}</p>}
                                <ReportForm targetType="EVENT" targetId={event.id} targetName={event.title} isAuthenticated={user !== null} />
                            </article>
                        </li>
                    ))}
                </ul>
            ) : (
                <section className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center">
                    <h2 className="font-heading text-lg font-semibold">Belum ada acara mendatang</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Acara terbit dari komunitas terverifikasi akan muncul di sini.</p>
                </section>
            )}
            {totalPages > 1 && (
                <nav aria-label="Halaman acara" className="mt-8 flex items-center justify-between">
                    {page > 1 ? <Link className="rounded-lg border px-4 py-2 text-sm hover:bg-muted" href={`/events?page=${page - 1}&limit=${limit}`}>Sebelumnya</Link> : <span />}
                    <span className="text-sm text-muted-foreground">Halaman {page} dari {totalPages} · {total} acara</span>
                    {page < totalPages ? <Link className="rounded-lg border px-4 py-2 text-sm hover:bg-muted" href={`/events?page=${page + 1}&limit=${limit}`}>Berikutnya</Link> : <span />}
                </nav>
            )}
        </main>
    );
}
