import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";

type Facet = { value: string; total: number };

function FacetGroup({ name, title, facets, selected }: { name: string; title: string; facets: Facet[]; selected?: string }) {
    if (facets.length === 0) return null;
    return (
        <fieldset className="mt-5">
            <legend className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{title}</legend>
            <div className="mt-2 flex flex-col gap-1">
                <label className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                    <input type="radio" name={name} value="" defaultChecked={!selected} className="size-4 accent-primary" />
                    Semua
                </label>
                {facets.map((facet) => (
                    <label key={facet.value} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                        <input type="radio" name={name} value={facet.value} defaultChecked={selected === facet.value} className="size-4 accent-primary" />
                        <span className="min-w-0 flex-1 truncate">{facet.value}</span>
                        <span className="rounded-full bg-[#f1f0ea] px-2 text-[11px] text-muted-foreground">{facet.total}</span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

export function CatalogFilters({ q, category, language, categories, languages }: {
    q?: string;
    category?: string;
    language?: string;
    categories: Facet[];
    languages: Facet[];
}) {
    return (
        <aside aria-labelledby="catalog-filter-title" className="h-fit rounded-2xl border border-border bg-card p-4">
            <form action="/books" method="get">
                {q && <input type="hidden" name="q" value={q} />}
                <div className="flex items-center justify-between">
                    <h2 id="catalog-filter-title" className="flex items-center gap-1.5 font-sans text-sm font-semibold">
                        <SlidersHorizontal aria-hidden="true" className="size-4" /> Filter Pencarian
                    </h2>
                    <Link href={q ? `/books?q=${encodeURIComponent(q)}` : "/books"} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                        Reset Semua
                    </Link>
                </div>
                <FacetGroup name="category" title="Kategori" facets={categories} selected={category} />
                <FacetGroup name="language" title="Bahasa edisi" facets={languages} selected={language} />
                {categories.length === 0 && languages.length === 0 && (
                    <p className="mt-4 text-sm text-muted-foreground">Filter muncul setelah katalog berisi buku.</p>
                )}
                <button type="submit" className="mt-6 h-10 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    Terapkan Filter
                </button>
            </form>
        </aside>
    );
}
