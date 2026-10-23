import Link from "next/link";

import { CommunityCard } from "@/features/communities/components/community-card";

import type { getCommunityRecommendations } from "../community-queries";

type Recommendations = Awaited<ReturnType<typeof getCommunityRecommendations>>;

/** "Komunitas untukmu" (TB-060): recommended cards, or what the reader can do when there are none. */
export function CommunityRecommendations({ id, recommendations }: { id: string; recommendations: Recommendations }) {
    const { state, items } = recommendations;
    return (
        <section aria-labelledby={id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={id} className="font-heading text-2xl font-semibold">Komunitas untukmu</h2>
                <Link href="/communities" className="text-sm font-semibold text-primary hover:underline">Lihat semua komunitas</Link>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Dipilih dari minat bacaan dan wilayah kabupaten/kota di profilmu. Wilayahmu tidak ditampilkan ke siapa pun.</p>
            {state === "ok" ? (
                <ul className="mt-4 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
                    {items.map((community) => (
                        <li key={community.id}><CommunityCard community={community} isAuthenticated reason={community.reason} /></li>
                    ))}
                </ul>
            ) : state === "needs_input" ? (
                <p className="mt-4 rounded-2xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground">
                    Tambahkan <Link href="/recommendations" className="font-semibold text-primary hover:underline">minat bacaan</Link> atau
                    {" "}<Link href="/settings" className="font-semibold text-primary hover:underline">wilayah di profil</Link> agar kami bisa menyarankan komunitas.
                </p>
            ) : (
                <p className="mt-4 rounded-2xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground">
                    Belum ada komunitas yang cocok dengan minat atau wilayahmu. <Link href="/communities" className="font-semibold text-primary hover:underline">Jelajahi semua komunitas</Link>.
                </p>
            )}
        </section>
    );
}
