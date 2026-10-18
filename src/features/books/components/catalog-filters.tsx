import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { ChoiceOption } from "@/components/ui/form";

type Facet = { value: string; total: number; label?: string };

/** Shown before "Lihat lainnya"; the rest stay in the form inside a collapsed group. */
const VISIBLE_FACETS = 8;

function FacetOption({ name, facet, selected }: { name: string; facet: Facet; selected?: string }) {
    return (
        <ChoiceOption type="radio" name={name} value={facet.value} defaultChecked={selected === facet.value}>
            <span className="min-w-0 flex-1 truncate">{facet.label ?? facet.value}</span>
            <span className="rounded-full bg-[#f1f0ea] px-2 text-[11px] text-muted-foreground">
                {facet.total}<span className="sr-only"> buku</span>
            </span>
        </ChoiceOption>
    );
}

function FacetGroup({ name, title, facets, selected }: { name: string; title: string; facets: Facet[]; selected?: string }) {
    if (facets.length === 0) return null;
    const visible = facets.slice(0, VISIBLE_FACETS);
    const rest = facets.slice(VISIBLE_FACETS);
    return (
        <fieldset className="mt-5">
            <legend className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{title}</legend>
            <div className="mt-2 -mx-2 flex flex-col">
                <ChoiceOption type="radio" name={name} value="" defaultChecked={!selected}>Semua</ChoiceOption>
                {visible.map((facet) => <FacetOption key={facet.value} name={name} facet={facet} selected={selected} />)}
                {rest.length > 0 && (
                    <details open={rest.some((facet) => facet.value === selected)} className="group">
                        <summary className="flex min-h-10 cursor-pointer list-none items-center px-2 text-sm font-semibold text-primary hover:underline [&::-webkit-details-marker]:hidden">
                            <span className="group-open:hidden">Lihat {rest.length} lainnya</span>
                            <span className="hidden group-open:inline">Sembunyikan</span>
                        </summary>
                        <div className="flex flex-col">
                            {rest.map((facet) => <FacetOption key={facet.value} name={name} facet={facet} selected={selected} />)}
                        </div>
                    </details>
                )}
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
                    <Link href={q ? `/books?q=${encodeURIComponent(q)}` : "/books"} className="inline-flex min-h-10 items-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                        Reset Semua
                    </Link>
                </div>
                <FacetGroup name="category" title="Genre" facets={categories} selected={category} />
                <FacetGroup name="language" title="Bahasa edisi" facets={languages} selected={language} />
                {categories.length === 0 && languages.length === 0 && (
                    <p className="mt-4 text-sm text-muted-foreground">Filter muncul setelah katalog berisi buku.</p>
                )}
                <button type="submit" className="mt-6 h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    Terapkan Filter
                </button>
            </form>
        </aside>
    );
}
