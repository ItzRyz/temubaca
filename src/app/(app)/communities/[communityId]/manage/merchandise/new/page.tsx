import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { emptyMerchandise, MerchandiseForm } from "@/features/community-management/components/merchandise-form";
import { maskWhatsapp } from "@/features/community-management/rules";
import { loadManageContext } from "@/features/community-management/server";

export const metadata: Metadata = { title: "Tambah merchandise" };

export default async function NewMerchandisePage({ params }: PageProps<"/communities/[communityId]/manage/merchandise/new">) {
    const { communityId } = await params;
    const { can, community } = await loadManageContext(communityId);
    if (!can.manageContent) redirect(`/communities/${communityId}/manage/merchandise`);
    return <MerchandiseForm communityId={communityId} initial={emptyMerchandise} communityContact={community.whatsappNumber ? `WhatsApp ${maskWhatsapp(community.whatsappNumber)}` : community.contactEmail} />;
}
