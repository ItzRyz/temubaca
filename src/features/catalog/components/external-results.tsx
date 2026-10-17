import { AlertTriangle, BookOpen, ChevronRight, Clock, Globe } from "lucide-react";
import Link from "next/link";

import type { searchExternalCatalog } from "@/features/catalog/external-search";

import { ImportBookButton } from "./import-book-button";

type Outcome = Awaited<ReturnType<typeof searchExternalCatalog>> | { limited: true };

const providerNames = { OPEN_LIBRARY: "Open Library", GOOGLE_BOOKS: "Google Books" } as const;

const notices = {
    empty: { icon: BookOpen, text: "Tidak ditemukan juga di katalog terbuka. Periksa ejaan atau coba nama penulis." },
    timeout: { icon: Clock, text: "Katalog terbuka tidak merespons tepat waktu. Coba cari lagi sebentar lagi." },
    rate_limit: { icon: Clock, text: "Katalog terbuka sedang membatasi permintaan. Coba lagi beberapa menit lagi." },
    unavailable: { icon: AlertTriangle, text: "Katalog terbuka sedang tidak dapat dihubungi. Hasil dari katalog TemuBaca tetap tersedia di atas." },
    invalid_response: { icon: AlertTriangle, text: "Katalog terbuka mengirim data yang tidak dapat dibaca. Coba lagi nanti." },
} as const;

/** "Dari katalog terbuka" on /books (TB-021): provider results with clear empty and failure states. */
export function ExternalResults({ query, outcome, isAuthenticated, returnTo }: {
    query: string;
    outcome: Outcome;
    isAuthenticated: boolean;
    returnTo: string;
}) {
    const notice = "limited" in outcome ? notices.rate_limit : outcome.notice ? notices[outcome.notice] : null;

    return (
        <section aria-labelledby="external-results-title" className="mt-10 flex flex-col gap-4">
            <div>
                <h2 id="external-results-title" className="flex items-center gap-2 font-heading text-xl font-semibold">
                    <Globe aria-hidden="true" className="size-5 text-primary" /> Dari katalog terbuka
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Hasil &ldquo;{query}&rdquo; dari {"limited" in outcome || outcome.providers.length === 0 ? "Open Library dan Google Books" : outcome.providers.map((provider) => providerNames[provider]).join(" dan ")}.
                    Tambahkan buku ke TemuBaca agar salinanmu bisa dibagikan. Data dari provider dapat tidak lengkap.
                </p>
            </div>

            {notice ? (
                <p role="status" className="flex gap-2 rounded-xl border border-dashed border-border bg-card/60 p-4 text-sm text-muted-foreground">
                    <notice.icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {notice.text}
                </p>
            ) : !("limited" in outcome) && (
                <ul className="grid list-none gap-3 p-0 md:grid-cols-2">
                    {outcome.items.map((book) => (
                        <li key={`${book.provider}:${book.providerId}`} className="flex gap-4 rounded-2xl border border-border bg-card p-4">
                            <div className="flex aspect-[3/4] w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#f1f0ea]">
                                {book.coverUrl ? (
                                    // Provider cover hosts vary; next/image remote patterns are not fixed yet (DEC-06).
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={book.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
                                ) : (
                                    <BookOpen aria-hidden="true" className="size-5 text-primary/50" />
                                )}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <p className="text-xs text-muted-foreground">{[providerNames[book.provider as keyof typeof providerNames], book.publishedAt, book.language].filter(Boolean).join(" • ")}</p>
                                <h3 className="line-clamp-2 font-heading text-base leading-6 font-semibold">{book.title}</h3>
                                <p className="truncate text-sm text-muted-foreground">{book.authors.join(", ") || "Penulis belum tercatat"}</p>
                                <div className="mt-auto pt-2">
                                    {book.localBookId ? (
                                        <Link href={`/books/${book.localBookId}`} className="inline-flex h-10 items-center gap-1 text-sm font-semibold text-primary hover:underline">
                                            Sudah ada di TemuBaca <ChevronRight aria-hidden="true" className="size-4" />
                                        </Link>
                                    ) : (
                                        <ImportBookButton
                                            provider={book.provider as "OPEN_LIBRARY" | "GOOGLE_BOOKS"}
                                            providerId={book.providerId}
                                            title={book.title}
                                            isAuthenticated={isAuthenticated}
                                            returnTo={returnTo}
                                        />
                                    )}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

/** Loading state while providers answer; local results above are already visible. */
export function ExternalResultsSkeleton() {
    return (
        <section aria-busy="true" aria-label="Memuat hasil katalog terbuka" className="mt-10 flex flex-col gap-4">
            <h2 className="flex items-center gap-2 font-heading text-xl font-semibold"><Globe aria-hidden="true" className="size-5 text-primary" /> Dari katalog terbuka</h2>
            <p className="text-sm text-muted-foreground">Mencari di Open Library dan Google Books…</p>
            <ul aria-hidden="true" className="grid list-none gap-3 p-0 md:grid-cols-2">
                {[0, 1].map((key) => <li key={key} className="h-[136px] animate-pulse rounded-2xl bg-[#f1f0ea]" />)}
            </ul>
        </section>
    );
}
