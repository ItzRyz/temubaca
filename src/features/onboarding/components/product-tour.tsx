"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { markTourSeen } from "../actions";
import { TOUR_QUERY, tourSteps, type TourStep } from "../tour-steps";

/** Fired by "Panduan TemuBaca" in the account menu; the header's tour listens for it. */
export const TOUR_EVENT = "temubaca:tour";

export function openTour() {
    window.dispatchEvent(new Event(TOUR_EVENT));
}

const PADDING = 6;
const GAP = 12;
const CARD_WIDTH = 320;
const CARD_HEIGHT_GUESS = 230;

function targetOf(step: TourStep) {
    if (!step.target) return null;
    const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 ? element : null;
}

/**
 * "Panduan TemuBaca": a spotlight tour over the header (owner's decision 28 Okt 2026). Opens by itself
 * once, when "Pilih minat" sends the reader on with `?panduan=1` and the account has not seen it, and
 * whenever the account menu asks. Finishing or skipping records it as seen.
 */
export function ProductTour({ seen }: { seen: boolean }) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const titleId = useId();
    const bodyId = useId();
    const [steps, setSteps] = useState<TourStep[] | null>(null);
    const [index, setIndex] = useState(0);
    const [box, setBox] = useState<DOMRect | null>(null);
    const [viewport, setViewport] = useState({ width: 0, height: 0 });
    const cardRef = useRef<HTMLDivElement>(null);
    const returnFocus = useRef<HTMLElement | null>(null);
    const recorded = useRef(seen);
    const autoStarted = useRef(false);

    const start = useCallback(() => {
        returnFocus.current = document.activeElement as HTMLElement | null;
        // Steps whose target is not on this page (or hidden) are left out.
        setSteps(tourSteps.filter((step) => !step.target || targetOf(step)));
        setIndex(0);
    }, []);

    const finish = useCallback(() => {
        setSteps(null);
        if (!recorded.current) {
            recorded.current = true;
            void markTourSeen();
        }
        returnFocus.current?.focus();
    }, []);

    useEffect(() => {
        window.addEventListener(TOUR_EVENT, start);
        return () => window.removeEventListener(TOUR_EVENT, start);
    }, [start]);

    // Once after "Pilih minat": the flag is dropped from the URL so a reload does not reopen it.
    useEffect(() => {
        if (params.get(TOUR_QUERY) !== "1") return;
        const rest = new URLSearchParams(params.toString());
        rest.delete(TOUR_QUERY);
        router.replace(rest.size ? `${pathname}?${rest.toString()}` : pathname, { scroll: false });
        if (seen || autoStarted.current) return;
        autoStarted.current = true;
        // Next frame, so the header has been laid out before the targets are measured. Not cancelled:
        // dropping the flag above changes `params` and re-runs this effect before the frame fires.
        requestAnimationFrame(start);
    }, [params, pathname, router, seen, start]);

    const step = steps?.[index] ?? null;

    // Measured before paint, so a new step never shows the previous step's spotlight for a frame.
    useLayoutEffect(() => {
        if (!step) return;
        const element = targetOf(step);
        element?.scrollIntoView({ block: "nearest", inline: "center" });
        const measure = () => {
            setViewport({ width: window.innerWidth, height: window.innerHeight });
            setBox(element ? element.getBoundingClientRect() : null);
        };
        measure();
        window.addEventListener("resize", measure);
        window.addEventListener("scroll", measure, true);
        cardRef.current?.querySelector<HTMLElement>("[data-tour-primary]")?.focus();
        return () => {
            window.removeEventListener("resize", measure);
            window.removeEventListener("scroll", measure, true);
        };
    }, [step]);

    if (!steps || !step) return null;

    const last = index === steps.length - 1;
    const width = Math.min(CARD_WIDTH, viewport.width - 32);
    const position = box
        ? {
            left: Math.min(Math.max(box.left + box.width / 2 - width / 2, 16), viewport.width - width - 16),
            top: box.bottom + GAP + CARD_HEIGHT_GUESS < viewport.height ? box.bottom + GAP : Math.max(16, box.top - GAP - CARD_HEIGHT_GUESS),
        }
        : { left: (viewport.width - width) / 2, top: Math.max(16, (viewport.height - CARD_HEIGHT_GUESS) / 2) };

    function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key === "Escape") {
            event.preventDefault();
            finish();
            return;
        }
        if (event.key !== "Tab") return;
        // Keep focus inside the card while the tour is open.
        const focusable = [...(cardRef.current?.querySelectorAll<HTMLElement>("a, button") ?? [])];
        if (!focusable.length) return;
        const first = focusable[0];
        const lastItem = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            lastItem.focus();
        } else if (!event.shiftKey && document.activeElement === lastItem) {
            event.preventDefault();
            first.focus();
        }
    }

    return (
        <div className="fixed inset-0 z-[60]">
            {/* Blocks the page underneath; the dim comes from the spotlight's shadow or this layer. */}
            <div aria-hidden="true" className={box ? "absolute inset-0" : "absolute inset-0 bg-[rgba(15,23,20,0.55)]"} />
            {box && (
                <div aria-hidden="true" className="pointer-events-none absolute rounded-xl ring-2 ring-white transition-all duration-200"
                    style={{ top: box.top - PADDING, left: box.left - PADDING, width: box.width + PADDING * 2, height: box.height + PADDING * 2, boxShadow: "0 0 0 9999px rgba(15,23,20,0.55)" }} />
            )}
            <div ref={cardRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} onKeyDown={onKeyDown}
                className="absolute rounded-2xl border border-border bg-card p-5 shadow-[0_12px_32px_rgba(31,41,36,0.18)]"
                style={{ ...position, width }}>
                <p className="text-xs font-semibold text-muted-foreground">{index + 1} dari {steps.length}</p>
                <h2 id={titleId} className="mt-1 font-heading text-lg font-semibold text-primary">{step.title}</h2>
                <p id={bodyId} className="mt-2 text-sm leading-6 text-foreground/85">{step.body}</p>
                {last && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Link href="/books" onClick={finish} className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Jelajahi Buku</Link>
                        <Link href="/my-listings" onClick={finish} className="inline-flex min-h-10 items-center rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/5">Bagikan Bukumu</Link>
                    </div>
                )}
                <div className="mt-5 flex items-center justify-between gap-2">
                    <button type="button" onClick={finish} className="min-h-10 rounded-lg px-2 text-sm font-semibold text-muted-foreground hover:bg-muted">
                        {last ? "Tutup" : "Lewati"}
                    </button>
                    <div className="flex gap-2">
                        {index > 0 && (
                            <button type="button" onClick={() => setIndex(index - 1)} className="min-h-10 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted">Kembali</button>
                        )}
                        {!last && (
                            <button type="button" data-tour-primary onClick={() => setIndex(index + 1)} className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Lanjut</button>
                        )}
                        {last && (
                            <button type="button" data-tour-primary onClick={finish} className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Selesai</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
