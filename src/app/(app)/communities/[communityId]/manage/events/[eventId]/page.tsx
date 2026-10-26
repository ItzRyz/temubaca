import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EventForm } from "@/features/community-management/components/event-form";
import { loadManageContext, wibParts } from "@/features/community-management/server";
import { EventPlaceForm } from "@/features/places/components/community-place-form";
import { findManagedEvent } from "@/lib/db/queries/community-content";
import { findEventPlace } from "@/lib/db/queries/places";
import { uuidSchema } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Ubah acara" };

export default async function EditEventPage({ params }: PageProps<"/communities/[communityId]/manage/events/[eventId]">) {
    const { communityId, eventId } = await params;
    const { can } = await loadManageContext(communityId);
    if (!can.manageContent) redirect(`/communities/${communityId}/manage/events`);
    if (!uuidSchema.safeParse(eventId).success) notFound();
    const [event, pin] = await Promise.all([findManagedEvent(communityId, eventId), findEventPlace(eventId)]);
    if (!event) notFound();

    const place = event.locationType === "PHYSICAL" ? pin : null;
    const start = wibParts(event.startsAt);
    const end = wibParts(event.endsAt);
    return (
        <div className="flex flex-col gap-6">
            <EventForm
                communityId={communityId}
                eventId={event.id}
                initial={{
                    title: event.title,
                    description: event.description ?? "",
                    date: start.date,
                    startTime: start.time,
                    endTime: end.time,
                    locationType: event.locationType,
                    venueName: event.venueName ?? "",
                    publicLocation: event.publicLocation ?? "",
                    eventUrl: event.eventUrl ?? "",
                    publicationStatus: event.publicationStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
                }}
            />
            {/* The venue pin (DEC-07 phase 2); switching the event to online removes it. */}
            {event.locationType === "PHYSICAL" ? (
                <EventPlaceForm
                    communityId={communityId}
                    eventId={event.id}
                    published={event.publicationStatus === "PUBLISHED"}
                    saved={place ? { ...place, hidden: Boolean(place.hiddenAt) } : null}
                />
            ) : (
                <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">Acara daring tidak ditampilkan di Peta Literasi.</p>
            )}
        </div>
    );
}
