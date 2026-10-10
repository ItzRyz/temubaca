import Link from "next/link";

type Recommendation = {
    id: string;
    title: string;
    authors: string[];
    categories: string[];
    coverUrl: string | null;
    reason: string;
};

export function RecommendationList({ items }: { items: Recommendation[] }) {
    if (!items.length) return <p className="mt-8 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Katalog belum memiliki buku untuk ditampilkan.</p>;
    return <ul className="mt-6 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">{items.map((book) => <li key={book.id} className="rounded-2xl border border-border/70 bg-card p-5"><Link href={`/books/${book.id}`} className="font-heading text-lg font-semibold text-primary hover:underline">{book.title}</Link><p className="mt-1 text-sm text-muted-foreground">{book.authors.join(", ") || "Penulis belum tercatat"}</p><p className="mt-3 text-sm">{book.reason}</p>{book.categories.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{book.categories.join(" · ")}</p>}</li>)}</ul>;
}
