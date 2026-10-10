import { redirect } from "next/navigation";

import { InterestManager } from "@/features/recommendations/components/interest-manager";
import { RecommendationList } from "@/features/recommendations/components/recommendation-list";
import { getBookRecommendations } from "@/features/recommendations/queries";
import { getCurrentUser } from "@/lib/auth";

export default async function RecommendationsPage() {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    const result = await getBookRecommendations(user.id);

    return (
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 sm:px-8 sm:py-16">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Temukan bacaan</p>
            <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">Rekomendasi buku</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Rekomendasi dasar dihitung dari kecocokan persis kategori buku dengan minat yang kamu simpan. Tidak ada layanan rekomendasi eksternal.</p>
            <InterestManager interests={result.interests} />
            <h2 className="mt-10 font-heading text-2xl font-semibold">{result.fallback ? "Pilihan terbaru" : "Pilihan untukmu"}</h2>
            <RecommendationList items={result.items} />
        </main>
    );
}
