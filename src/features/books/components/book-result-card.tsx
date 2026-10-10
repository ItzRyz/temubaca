import { BookOpen, ChevronRight, Info, Library } from "lucide-react";
import Link from "next/link";

export type BookResult = {
    id: string;
    title: string;
    authors: string[];
    description: string | null;
    publisher: string | null;
    publishedAt: string | null;
    categories: string[];
    coverUrl: string | null;
    availableCopies: number;
};

export function BookResultCard({ book }: { book: BookResult }) {
    const imprint = [book.publisher, book.publishedAt].filter(Boolean).join(", ");
    const hasCopies = book.availableCopies > 0;

    return (
        <article className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-4 sm:flex-row">
            <div className="flex aspect-[3/4] w-full shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary text-primary-foreground sm:w-[130px]">
                {book.coverUrl ? (
                    // Cover hosts depend on the catalog provider (DEC-06); next/image remote patterns are not fixed yet.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={book.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
                ) : (
                    <div aria-hidden="true" className="flex size-full flex-col justify-between p-3">
                        <BookOpen className="size-4 opacity-70" />
                        <span className="line-clamp-4 font-heading text-sm leading-5 font-semibold">{book.title}</span>
                        <span className="text-[10px] opacity-70">{book.publishedAt ?? "TemuBaca"}</span>
                    </div>
                )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {book.categories[0] && (
                        <span className="rounded-full bg-[#e7efe8] px-2 py-0.5 font-semibold text-secondary-foreground">{book.categories[0]}</span>
                    )}
                    {imprint && <span>{imprint}</span>}
                </div>
                <h2 className="mt-1.5 font-heading text-xl leading-7 font-bold text-[#1f2924]">
                    <Link href={`/books/${book.id}`} className="hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
                        {book.title}
                    </Link>
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{book.authors.length > 0 ? book.authors.join(", ") : "Penulis belum tercatat"}</p>
                {book.description && <p className="mt-2 line-clamp-2 text-sm leading-[22px] text-foreground/80">{book.description}</p>}
                <div className="mt-auto pt-4">
                    <div className="flex flex-col gap-3 rounded-lg bg-[#f1f0ea] p-2 pl-3 sm:flex-row sm:items-center sm:justify-between">
                        {hasCopies ? (
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                                <Library aria-hidden="true" className="size-3.5" />
                                {book.availableCopies} salinan dibagikan warga
                            </p>
                        ) : (
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Info aria-hidden="true" className="size-3.5" />
                                Belum ada salinan yang dibagikan
                            </p>
                        )}
                        <Link
                            href={`/books/${book.id}`}
                            aria-label={`Lihat akses ${book.title}`}
                            className={hasCopies
                                ? "flex items-center justify-center gap-1 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                                : "flex items-center justify-center gap-1 rounded-md border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted"}
                        >
                            {hasCopies ? "Lihat akses" : "Lihat detail"} <ChevronRight aria-hidden="true" className="size-3.5" />
                        </Link>
                    </div>
                </div>
            </div>
        </article>
    );
}
