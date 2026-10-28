/**
 * `/books` URLs for the filter bar, its chips, the search form, and pagination (29 Okt 2026).
 * Changing any filter goes back to page 1; "Reset semua" keeps only the search text.
 */

export const availabilityOptions = [
    { value: "warga", label: "Ada salinan warga" },
    { value: "perpustakaan", label: "Tercatat di perpustakaan" },
] as const;

export const sortOptions = [
    { value: "terbaru", label: "Terbaru" },
    { value: "judul", label: "Judul A–Z" },
    { value: "salinan", label: "Paling banyak salinan" },
] as const;

export type CatalogAvailability = (typeof availabilityOptions)[number]["value"];
export type CatalogSort = (typeof sortOptions)[number]["value"];
export const DEFAULT_SORT: CatalogSort = "terbaru";

export type CatalogState = {
    q?: string;
    category?: string;
    language?: string;
    availability?: CatalogAvailability;
    sort?: CatalogSort;
    page?: number;
};

const ORDER = ["q", "category", "language", "availability", "sort", "page"] as const;

/** The current state with `change` applied; `undefined` in `change` removes that parameter. */
export function catalogParams(current: CatalogState, change: Partial<CatalogState> = {}) {
    const next: CatalogState = { ...current, ...change };
    // A new filter or sort starts from the first page.
    if (!("page" in change)) delete next.page;
    const params = new URLSearchParams();
    for (const key of ORDER) {
        const value = next[key];
        if (value === undefined || value === "" || (key === "sort" && value === DEFAULT_SORT) || (key === "page" && Number(value) <= 1)) continue;
        params.set(key, String(value));
    }
    return params;
}

export function catalogHref(current: CatalogState, change: Partial<CatalogState> = {}) {
    const query = catalogParams(current, change).toString();
    return query ? `/books?${query}` : "/books";
}
