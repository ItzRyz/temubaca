"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-5 py-16 sm:px-8">
            <section className="w-full rounded-3xl border border-border/70 bg-card p-8 text-center shadow-sm sm:p-12">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">TemuBaca</p>
                <h1 className="mt-3 font-heading text-3xl font-semibold">Halaman ini belum bisa dimuat</h1>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                    Terjadi kendala saat memuat halaman. Coba lagi sebentar lagi.
                </p>
                <button
                    type="button"
                    onClick={() => reset()}
                    className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                    Coba lagi
                </button>
            </section>
        </main>
    );
}
