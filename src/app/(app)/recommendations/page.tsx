
import { InterestManager } from "@/features/recommendations/components/interest-manager";
import { RecommendationList } from "@/features/recommendations/components/recommendation-list";
import { RecommendationNotice } from "@/features/recommendations/components/recommendation-notice";
import { getBookRecommendations } from "@/features/recommendations/queries";
import { getCurrentUser } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/login-redirect";
import { listGenreFacets } from "@/lib/db/queries/books";

export default async function RecommendationsPage() {
    const user = await getCurrentUser();
    if (!user) return redirectToLogin();
    const [result, facets] = await Promise.all([getBookRecommendations(user.id), listGenreFacets()]);

    return (
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 sm:px-8 sm:py-16">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Temukan bacaan</p>
            <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">Rekomendasi buku</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{result.engine === "ml"
                ? "Rekomendasi dihitung oleh layanan rekomendasi TemuBaca dari minat yang kamu simpan. Hanya minatmu yang dikirim, tanpa data akun."
                : "Rekomendasi dasar dihitung dari kecocokan genre buku dengan minat yang kamu simpan."}</p>
            <InterestManager interests={result.interests} suggestions={facets.map((facet) => ({ slug: facet.value, label: facet.label }))} />
            <h2 className="mt-10 font-heading text-2xl font-semibold">{result.fallback ? "Pilihan terbaru" : "Pilihan untukmu"}</h2>
            <RecommendationNotice state={result.state} unmatchedInterests={result.unmatchedInterests} className="mt-4" />
            <RecommendationList items={result.items} />
        </main>
    );
}
