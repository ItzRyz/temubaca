import { UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AcceptInviteButton } from "@/features/community-management/components/team-panel";
import { getCurrentUser } from "@/lib/auth";
import { previewManagerInvite } from "@/lib/db/queries/community-management";
import { acceptInviteSchema } from "@/lib/validation/schemas/community-management.schema";

export const metadata: Metadata = { title: "Undangan pengurus", robots: { index: false } };

/** Accept a one-time manager invite (DEC-04); guests sign in first and come back to this link. */
export default async function InvitePage({ params }: PageProps<"/communities/invite/[token]">) {
    const { token } = await params;
    const user = await getCurrentUser();
    const parsed = acceptInviteSchema.safeParse({ token });
    const invite = parsed.success ? await previewManagerInvite(parsed.data.token) : null;
    const isOwner = invite && user && invite.ownerId === user.id;

    return (
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-12 sm:px-6">
            <section className="rounded-2xl border border-border bg-card p-6 text-center">
                <span aria-hidden="true" className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#e7efe8] text-primary"><UsersRound className="size-5" /></span>
                {invite?.valid && !user ? (
                    <>
                        <h1 className="mt-4 font-heading text-2xl font-semibold text-primary">Undangan pengurus {invite.communityName}</h1>
                        <p className="mt-2 text-sm text-muted-foreground">Masuk atau daftar dulu untuk menerima undangan ini.</p>
                        <Link href={`/login?next=${encodeURIComponent(`/communities/invite/${parsed.data!.token}`)}`} className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Masuk / Daftar</Link>
                    </>
                ) : invite?.valid && !isOwner ? (
                    <>
                        <h1 className="mt-4 font-heading text-2xl font-semibold text-primary">Jadi pengurus {invite.communityName}?</h1>
                        <p className="mt-2 text-sm text-muted-foreground">Pengurus dapat membuat dan mengubah acara serta merchandise komunitas. Pemilik tetap mengatur profil dan pengurus, dan bisa mencabut akses Anda kapan saja.</p>
                        <div className="mt-6"><AcceptInviteButton token={parsed.data!.token} /></div>
                    </>
                ) : (
                    <>
                        <h1 className="mt-4 font-heading text-2xl font-semibold">Undangan tidak dapat dipakai</h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {isOwner ? "Anda adalah pemilik komunitas ini." : "Tautan ini sudah dipakai, dicabut, kedaluwarsa, atau tidak dikenal. Minta tautan baru kepada pemilik komunitas."}
                        </p>
                        <Link href="/communities/mine" className="mt-6 inline-flex min-h-11 items-center rounded-lg border border-border px-5 text-sm font-semibold hover:bg-muted">Komunitas Saya</Link>
                    </>
                )}
            </section>
        </main>
    );
}
