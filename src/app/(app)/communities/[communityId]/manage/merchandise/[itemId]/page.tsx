import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { MerchandiseForm } from "@/features/community-management/components/merchandise-form";
import { maskWhatsapp } from "@/features/community-management/rules";
import { loadManageContext } from "@/features/community-management/server";
import { findManagedMerchandise } from "@/lib/db/queries/community-content";
import { uuidSchema } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Ubah merchandise" };

export default async function EditMerchandisePage({ params }: PageProps<"/communities/[communityId]/manage/merchandise/[itemId]">) {
    const { communityId, itemId } = await params;
    const { can, community } = await loadManageContext(communityId);
    if (!can.manageContent) redirect(`/communities/${communityId}/manage/merchandise`);
    if (!uuidSchema.safeParse(itemId).success) notFound();
    const item = await findManagedMerchandise(communityId, itemId);
    if (!item) notFound();

    return (
        <MerchandiseForm
            communityId={communityId}
            itemId={item.id}
            communityContact={community.whatsappNumber ? `WhatsApp ${maskWhatsapp(community.whatsappNumber)}` : community.contactEmail}
            initial={{
                title: item.title,
                category: item.category ?? "",
                description: item.description ?? "",
                priceMode: item.priceAmount === null ? "FLEXIBLE" : "FIXED",
                priceAmount: item.priceAmount === null ? "" : String(Math.round(Number(item.priceAmount))),
                priceNote: item.priceNote ?? "",
                availability: item.availability === "AVAILABLE" ? "AVAILABLE" : "UNAVAILABLE",
                stockNote: item.stockNote ?? "",
                contactMode: item.contactOverride ? "CUSTOM" : "COMMUNITY",
                contactOverride: item.contactOverride ?? "",
                visible: item.status === "PUBLISHED",
            }}
        />
    );
}
