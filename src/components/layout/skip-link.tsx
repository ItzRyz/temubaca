/** Id of the element that wraps each layout's page content; the skip link jumps there. */
export const MAIN_CONTENT_ID = "konten";

/** First stop for keyboard users: skips the header or sidebar (WCAG 2.4.1). Hidden until focused. */
export function SkipLink() {
    return (
        <a
            href={`#${MAIN_CONTENT_ID}`}
            className="sr-only rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[1000] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
            Lewati ke konten utama
        </a>
    );
}
