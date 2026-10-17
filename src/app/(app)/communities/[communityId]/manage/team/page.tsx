import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TeamPanel } from "@/features/community-management/components/team-panel";
import { loadManageContext } from "@/features/community-management/server";
import { listCommunityTeam, listOpenInvites } from "@/lib/db/queries/community-management";

export const metadata: Metadata = { title: "Pengurus komunitas" };

/** Pengurus (owner only): no Figma frame, built from the DEC-04 decision. */
export default async function ManageTeamPage({ params }: PageProps<"/communities/[communityId]/manage/team">) {
    const { communityId } = await params;
    const { can, user } = await loadManageContext(communityId);
    if (!can.manageTeam) redirect(`/communities/${communityId}/manage`);
    const [team, invites] = await Promise.all([listCommunityTeam(communityId), listOpenInvites(communityId)]);

    return (
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="font-heading text-xl font-semibold text-primary">Pengurus</h2>
            <p className="mt-1 text-sm text-muted-foreground">
                Pemilik: <span className="font-semibold text-foreground">{team.owner?.displayName ?? user.displayName}</span>. Pemilik mengatur profil, kontak, pengurus, dan verifikasi; pengurus mengelola acara dan merchandise.
            </p>
            <div className="mt-5">
                <TeamPanel communityId={communityId} managers={team.managers} invites={invites.map((invite) => ({ id: invite.id, expiresAt: invite.expiresAt.toISOString() }))} />
            </div>
        </section>
    );
}
