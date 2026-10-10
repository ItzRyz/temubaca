export default function Loading() {
    return (
        <main
            className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 sm:px-8 sm:py-16"
            aria-busy="true"
            aria-live="polite"
        >
            <p className="text-sm font-medium text-muted-foreground">Memuat TemuBaca…</p>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }, (_, index) => (
                    <div
                        key={index}
                        className="h-64 animate-pulse rounded-2xl border border-border/70 bg-muted/60"
                    />
                ))}
            </div>
        </main>
    );
}
