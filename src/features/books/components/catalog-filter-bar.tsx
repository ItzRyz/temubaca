"use client";

import { Check, ChevronDown, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent, type MouseEvent } from "react";

import { cn } from "@/lib/utils";

import { availabilityOptions, catalogHref, DEFAULT_SORT, sortOptions, type CatalogState } from "../catalog-url";

type Option = { value: string; label: string; total?: number };

/**
 * One filter as a dropdown (29 Okt 2026). Options are links, so they work without JavaScript; with it,
 * choosing one navigates in a transition so the bar can show that results are loading.
 */
function FilterDropdown({ label, options, selected, hrefFor, onNavigate, allLabel, align = "left" }: {
    label: string;
    options: Option[];
    selected?: string;
    hrefFor: (value: string | undefined) => string;
    onNavigate: (href: string) => void;
    /** Label of the "no filter" entry; omitted for the sort, which always has a value. */
    allLabel?: string;
    align?: "left" | "right";
}) {
    const [open, setOpen] = useState(false);
    const menuId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const current = options.find((option) => option.value === selected);
    const entries: Option[] = allLabel ? [{ value: "", label: allLabel }, ...options] : options;

    const items = () => [...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitemradio]") ?? [])];

    useEffect(() => {
        if (!open) return;
        (items().find((item) => item.getAttribute("aria-checked") === "true") ?? items()[0])?.focus();
        function onPointerDown(event: PointerEvent) {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        }
        function onKeyDown(event: globalThis.KeyboardEvent) {
            if (event.key === "Escape") {
                setOpen(false);
                buttonRef.current?.focus();
            }
        }
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const list = items();
        const at = list.indexOf(document.activeElement as HTMLElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? list.length - 1
            : (at + (event.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
        list[next]?.focus();
    }

    function choose(event: MouseEvent<HTMLAnchorElement>, href: string) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        onNavigate(href);
    }

    const active = Boolean(current) && Boolean(allLabel);
    return (
        <div ref={rootRef} className="relative">
            <button ref={buttonRef} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((value) => !value)}
                className={cn(
                    "flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    active ? "border-primary bg-[#e7efe8] text-primary" : "border-border bg-card text-foreground hover:bg-muted",
                )}>
                <span>{label}{current && <span className={active ? "" : "font-medium text-muted-foreground"}>: {current.label}</span>}</span>
                <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
                <div ref={menuRef} id={menuId} role="menu" aria-label={label} onKeyDown={onMenuKeyDown}
                    className={cn(
                        "absolute z-30 mt-2 max-h-80 w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-[0_6px_20px_rgba(31,41,36,0.12)]",
                        align === "right" ? "right-0" : "left-0",
                    )}>
                    {entries.map((option) => {
                        const checked = (option.value || undefined) === (selected || undefined) || (!allLabel && !selected && option.value === DEFAULT_SORT);
                        const href = hrefFor(option.value || undefined);
                        return (
                            <Link key={option.value || "all"} href={href} scroll={false} role="menuitemradio" aria-checked={checked} onClick={(event) => choose(event, href)}
                                className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                                <Check aria-hidden="true" className={cn("size-4 shrink-0 text-primary", !checked && "invisible")} />
                                <span className={cn("min-w-0 flex-1 truncate", checked && "font-semibold")}>{option.label}</span>
                                {option.total !== undefined && (
                                    <span className="rounded-full bg-[#f1f0ea] px-2 text-[11px] text-muted-foreground tabular-nums">
                                        {option.total}<span className="sr-only"> buku</span>
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/** `/books` filters above the results: Genre, Bahasa, Ketersediaan, and Urutkan, applied as soon as one is chosen. */
export function CatalogFilterBar({ state, categories, languages }: {
    state: CatalogState;
    categories: Option[];
    languages: Option[];
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const navigate = (href: string) => startTransition(() => router.push(href, { scroll: false }));

    const chips = [
        state.category && { key: "category", label: categories.find((item) => item.value === state.category)?.label ?? state.category, href: catalogHref(state, { category: undefined }) },
        state.language && { key: "language", label: languages.find((item) => item.value === state.language)?.label ?? state.language, href: catalogHref(state, { language: undefined }) },
        state.availability && { key: "availability", label: availabilityOptions.find((item) => item.value === state.availability)?.label ?? state.availability, href: catalogHref(state, { availability: undefined }) },
    ].filter((chip): chip is { key: string; label: string; href: string } => Boolean(chip));

    return (
        <section aria-label="Filter katalog" className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
                <FilterDropdown label="Genre" allLabel="Semua genre" options={categories} selected={state.category}
                    hrefFor={(value) => catalogHref(state, { category: value })} onNavigate={navigate} />
                <FilterDropdown label="Bahasa" allLabel="Semua bahasa" options={languages} selected={state.language}
                    hrefFor={(value) => catalogHref(state, { language: value })} onNavigate={navigate} />
                <FilterDropdown label="Ketersediaan" allLabel="Semua buku" options={[...availabilityOptions]} selected={state.availability}
                    hrefFor={(value) => catalogHref(state, { availability: value as CatalogState["availability"] })} onNavigate={navigate} />
                <div className="ml-auto flex items-center gap-2">
                    {pending && <span role="status" className="flex items-center gap-1 text-xs text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Memuat…</span>}
                    <FilterDropdown label="Urutkan" options={[...sortOptions]} selected={state.sort} align="right"
                        hrefFor={(value) => catalogHref(state, { sort: value as CatalogState["sort"] })} onNavigate={navigate} />
                </div>
            </div>
            {chips.length > 0 && (
                <ul aria-label="Filter aktif" className="mt-3 flex list-none flex-wrap items-center gap-2 p-0">
                    {chips.map((chip) => (
                        <li key={chip.key}>
                            <Link href={chip.href} scroll={false} onClick={(event) => { if (event.button === 0 && !event.metaKey && !event.ctrlKey) { event.preventDefault(); navigate(chip.href); } }}
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#e7efe8] py-1 pr-2 pl-3 text-sm font-semibold text-primary hover:bg-[#d9e6db]">
                                {chip.label} <X aria-hidden="true" className="size-3.5" /><span className="sr-only">: hapus filter</span>
                            </Link>
                        </li>
                    ))}
                    <li>
                        <Link href={catalogHref({ q: state.q })} scroll={false} onClick={(event) => { if (event.button === 0 && !event.metaKey && !event.ctrlKey) { event.preventDefault(); navigate(catalogHref({ q: state.q })); } }}
                            className="inline-flex min-h-9 items-center px-2 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
                            Reset semua
                        </Link>
                    </li>
                </ul>
            )}
        </section>
    );
}
