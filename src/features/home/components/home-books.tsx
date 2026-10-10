import { ArrowRight, BookOpen, UserRound } from "lucide-react";
import Link from "next/link";

import { EmptyState, SectionHeader } from "./section-header";

export type HomeBook = {
    id: string;
    title: string;
    authors: string[];
    categories: string[];
    coverUrl: string | null;
};

export function HomeBooks({ books, total, isAuthenticated }: { books: HomeBook[]; total: number; isAuthenticated: boolean }) {
    return (
        <section aria-labelledby="home-books-title" className="px-4 py-8 sm:px-9 sm:py-12">
            <div className="mx-auto flex max-w-[1208px] flex-col gap-6">
                <SectionHeader
                    id="home-books-title"
                    title="Temukan buku yang mungkin kamu suka"
                    description="Koleksi terbaru di katalog TemuBaca."
                />
                {!isAuthenticated && (
                    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex gap-4">
                            <UserRound aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-semibold text-foreground">Ingin rekomendasi lebih personal sesuai seleramu?</p>
                                <p className="mt-0.5 text-sm text-muted-foreground">Masuk atau daftar untuk menyesuaikan rekomendasi dengan minat bacaanmu.</p>
                            </div>
                        </div>
                        <Link href="/login" className="flex shrink-0 items-center gap-1 self-start rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:self-auto">
                            Masuk / Daftar Sekarang <ArrowRight aria-hidden="true" className="size-3.5" />
                        </Link>
                    </div>
                )}
                {books.length > 0 ? (
                    <ul className="grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
                        {books.map((book) => (
                            <li key={book.id} className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-[0_4px_16px_rgba(31,41,36,0.06)]">
                                <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg bg-muted">
                                    {book.coverUrl ? (
                                        // Cover hosts depend on the catalog provider (DEC-06); next/image remote patterns are not fixed yet.
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={book.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
                                    ) : (
                                        <BookOpen aria-hidden="true" className="size-12 text-primary/50" />
                                    )}
                                </div>
                                <h3 className="mt-4 line-clamp-2 font-heading text-lg leading-6 font-bold text-[#1f2924]">{book.title}</h3>
                                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{book.authors.length > 0 ? book.authors.join(", ") : "Penulis belum tercatat"}</p>
                                {book.categories[0] && (
                                    <p className="mt-3 w-fit rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground">{book.categories[0]}</p>
                                )}
                                <div className="mt-auto pt-4">
                                    <Link href={`/books/${book.id}`} className="flex min-h-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                                        Lihat Buku
                                    </Link>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <EmptyState>Katalog buku masih kosong.</EmptyState>
                )}
                {total > 0 && (
                    <Link href="/books" className="flex items-center gap-1 self-end text-sm font-semibold text-[#003622] hover:underline">
                        Lihat semua koleksi ({total}) <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                )}
            </div>
        </section>
    );
}
