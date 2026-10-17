import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { emptyEvent, EventForm } from "@/features/community-management/components/event-form";
import { loadManageContext } from "@/features/community-management/server";

export const metadata: Metadata = { title: "Buat acara" };

export default async function NewEventPage({ params }: PageProps<"/communities/[communityId]/manage/events/new">) {
    const { communityId } = await params;
    const { can } = await loadManageContext(communityId);
    if (!can.manageContent) redirect(`/communities/${communityId}/manage/events`);
    return <EventForm communityId={communityId} initial={emptyEvent} />;
}
