import Link from "next/link";

import type { books } from "@/lib/db/schema";

type BookCardProps = {
    book: Pick<
        typeof books.$inferSelect,
        "id" | "title" | "authors" | "categories" | "publishedAt" | "coverUrl"
    >;
};

export function BookCard({ book }: BookCardProps) {
    return (
        <article className="group flex h-full flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div aria-hidden="true" className="mb-5 flex h-36 items-center justify-center rounded-xl bg-primary/8 text-4xl text-primary/70">
                <span className="font-heading">Tb</span>
            </div>
            <div className="flex flex-1 flex-col">
                <h2 className="font-heading text-lg font-semibold leading-snug">
                    <Link href={`/books/${book.id}`} className="focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
                        <span className="absolute inset-0" aria-hidden="true" />
                        {book.title}
                    </Link>
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    {book.authors.length > 0 ? book.authors.join(", ") : "Penulis belum tercatat"}
                </p>
                {book.categories.length > 0 && (
                    <p className="mt-3 line-clamp-1 text-xs text-muted-foreground">
                        {book.categories.slice(0, 3).join(" · ")}
                    </p>
                )}
                <div className="mt-auto pt-5 text-sm font-medium text-primary group-hover:underline">
                    Lihat detail <span aria-hidden="true">→</span>
                </div>
            </div>
        </article>
    );
}
