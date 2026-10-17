import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EventForm } from "@/features/community-management/components/event-form";
import { loadManageContext, wibParts } from "@/features/community-management/server";
import { findManagedEvent } from "@/lib/db/queries/community-content";
import { uuidSchema } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Ubah acara" };

export default async function EditEventPage({ params }: PageProps<"/communities/[communityId]/manage/events/[eventId]">) {
    const { communityId, eventId } = await params;
    const { can } = await loadManageContext(communityId);
    if (!can.manageContent) redirect(`/communities/${communityId}/manage/events`);
    if (!uuidSchema.safeParse(eventId).success) notFound();
    const event = await findManagedEvent(communityId, eventId);
    if (!event) notFound();

    const start = wibParts(event.startsAt);
    const end = wibParts(event.endsAt);
    return (
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
    );
}
