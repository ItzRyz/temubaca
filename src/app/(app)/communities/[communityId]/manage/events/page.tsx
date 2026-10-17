import { CalendarDays, Clock, Eye, Link2, MapPin, Pencil, Plus, Search, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DuplicateEventButton, EventRowMenu } from "@/features/community-management/components/row-actions";
import { eventDisplayStatus, eventMissingFields, type EventDisplayStatus } from "@/features/community-management/rules";
import { loadManageContext } from "@/features/community-management/server";
import { listEventsForManage } from "@/lib/db/queries/community-content";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Acara komunitas" };

const month = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "Asia/Jakarta" });
const day = new Intl.DateTimeFormat("id-ID", { day: "numeric", timeZone: "Asia/Jakarta" });
const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "Asia/Jakarta" });
const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

const filters = { all: "Semua", PUBLISHED: "Terbit", DRAFT: "Draf", DONE: "Selesai", ARCHIVED: "Arsip" } as const;
type Filter = keyof typeof filters;
const badge: Record<EventDisplayStatus, { label: string; className: string }> = {
    PUBLISHED: { label: "Terbit", className: "bg-[#c9ecd6] text-primary" },
    DRAFT: { label: "Draf", className: "bg-[#ebe9e1] text-foreground/80" },
    DONE: { label: "Selesai", className: "bg-[#ebe9e1] text-foreground/70" },
    ARCHIVED: { label: "Diarsipkan", className: "bg-[#ebe9e1] text-foreground/70" },
};

/** Figma "Kelola Komunitas - Acara" (293:2321). */
export default async function ManageEventsPage({ params, searchParams }: PageProps<"/communities/[communityId]/manage/events">) {
    const { communityId } = await params;
    const { can } = await loadManageContext(communityId);
    const query = await searchParams;
    const filter: Filter = typeof query.status === "string" && query.status in filters ? (query.status as Filter) : "all";
    const needle = (typeof query.q === "string" ? query.q : "").trim().slice(0, 100);
    const base = `/communities/${communityId}/manage/events`;

    if (!can.manageContent) {
        return <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Acara dapat dibuat setelah komunitas terverifikasi.</p>;
    }

    const now = new Date();
    const all = (await listEventsForManage(communityId)).map((event) => ({ event, status: eventDisplayStatus(event, now) }));
    const counts = Object.fromEntries((Object.keys(filters) as Filter[]).map((key) => [key, key === "all" ? all.filter((item) => item.status !== "ARCHIVED").length : all.filter((item) => item.status === key).length])) as Record<Filter, number>;
    const visible = all.filter(({ event, status }) =>
        (filter === "all" ? status !== "ARCHIVED" : status === filter) &&
        (!needle || event.title.toLocaleLowerCase("id-ID").includes(needle.toLocaleLowerCase("id-ID"))),
    );
    const hrefFor = (status: Filter) => {
        const search = new URLSearchParams();
        if (status !== "all") search.set("status", status);
        if (needle) search.set("q", needle);
        return search.size ? `${base}?${search}` : base;
    };

    return (
        <div className="flex flex-col gap-4">
            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h2 className="font-heading text-xl font-semibold text-primary">Acara Komunitas</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Acara berstatus Terbit tampil di halaman komunitas dan agenda publik.</p>
                    </div>
                    <Link href={`${base}/new`} className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                        <Plus aria-hidden="true" className="size-4" /> Buat Acara
                    </Link>
                </div>
                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-2">
                        {(Object.keys(filters) as Filter[]).map((key) => (
                            <Link key={key} href={hrefFor(key)} aria-current={filter === key ? "true" : undefined}
                                className={cn("rounded-lg border px-3 py-1.5 text-sm font-semibold", filter === key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                                {filters[key]} ({counts[key]})
                            </Link>
                        ))}
                    </div>
                    <form action={base} method="get" role="search" className="flex gap-2 lg:w-72">
                        {filter !== "all" && <input type="hidden" name="status" value={filter} />}
                        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input px-3 focus-within:ring-2 focus-within:ring-ring/30">
                            <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                            <span className="sr-only">Cari judul acara</span>
                            <input name="q" type="search" maxLength={100} defaultValue={needle} placeholder="Cari judul acara..." className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" />
                        </label>
                    </form>
                </div>
            </section>

            {visible.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
                    <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-xl bg-[#e7efe8] text-primary"><CalendarDays className="size-5" /></span>
                    <h3 className="mt-3 font-heading text-lg font-semibold">{all.length === 0 ? "Belum ada acara" : "Tidak ada acara yang cocok"}</h3>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">{all.length === 0 ? "Buat acara pertama: lingkar baca, tukar buku, atau bedah buku di ruang publik." : "Ubah filter atau kata kunci pencarian."}</p>
                    {all.length === 0 && (
                        <Link href={`${base}/new`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus aria-hidden="true" className="size-4" /> Buat Acara Pertama</Link>
                    )}
                </div>
            ) : (
                <ul className="flex list-none flex-col gap-3 p-0">
                    {visible.map(({ event, status }) => {
                        const missing = eventMissingFields(event);
                        const place = event.locationType === "ONLINE" ? "Daring" : [event.venueName, event.publicLocation].filter(Boolean).join(", ");
                        return (
                            <li key={event.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
                                <span aria-hidden="true" className={cn("flex size-16 shrink-0 flex-col items-center justify-center rounded-xl", event.startsAt ? "bg-[#e7efe8]" : "bg-[#e8ecf5]")}>
                                    <span className="text-[11px] font-semibold uppercase">{event.startsAt ? month.format(event.startsAt) : "—"}</span>
                                    <span className="font-heading text-2xl font-semibold">{event.startsAt ? day.format(event.startsAt) : "?"}</span>
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="flex flex-wrap items-start gap-2">
                                        <span className="font-heading text-lg font-semibold">{event.title}</span>
                                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", badge[status].className)}>{badge[status].label}</span>
                                    </p>
                                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                        {event.startsAt && event.endsAt ? (
                                            <span className="flex items-center gap-1 text-muted-foreground"><Clock aria-hidden="true" className="size-3.5" /> {weekday.format(event.startsAt)}, {time.format(event.startsAt)} – {time.format(event.endsAt)} WIB</span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-destructive"><Clock aria-hidden="true" className="size-3.5" /> Tanggal dan jam belum diisi</span>
                                        )}
                                        {missing.includes("location") ? (
                                            <span className="flex items-center gap-1 text-destructive"><MapPin aria-hidden="true" className="size-3.5" /> Lokasi belum diisi</span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-muted-foreground">{event.locationType === "ONLINE" ? <Link2 aria-hidden="true" className="size-3.5" /> : <MapPin aria-hidden="true" className="size-3.5" />} {place}</span>
                                        )}
                                    </p>
                                </div>
                                <div className="flex shrink-0 flex-wrap items-center gap-2">
                                    {status === "DRAFT" && missing.length > 0 ? (
                                        <Link href={`${base}/${event.id}`} className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Lengkapi</Link>
                                    ) : status === "DONE" ? (
                                        <DuplicateEventButton communityId={communityId} eventId={event.id} />
                                    ) : (
                                        <Link href={`${base}/${event.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:bg-muted"><Pencil aria-hidden="true" className="size-4" /> Ubah</Link>
                                    )}
                                    {(status === "PUBLISHED" || status === "DONE") && (
                                        <Link href={`/events/${event.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:bg-muted"><Eye aria-hidden="true" className="size-4" /> Lihat</Link>
                                    )}
                                    <EventRowMenu communityId={communityId} eventId={event.id} title={event.title} isDraft={status === "DRAFT"} isArchived={status === "ARCHIVED"} />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            <section className="flex gap-4 rounded-2xl bg-[#e7efe8] p-5">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary"><ShieldCheck className="size-5" /></span>
                <div>
                    <h2 className="font-heading text-base font-semibold">Selalu gunakan ruang publik</h2>
                    <p className="text-sm text-foreground/80">Acara hanya boleh diadakan di tempat umum. Jangan menampilkan alamat rumah pengurus atau anggota di lokasi acara.</p>
                </div>
            </section>
        </div>
    );
}
