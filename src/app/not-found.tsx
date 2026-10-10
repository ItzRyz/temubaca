import Link from "next/link";

export default function NotFound() {
    return (
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-5 py-16 sm:px-8">
            <section className="w-full rounded-3xl border border-border/70 bg-card p-8 text-center shadow-sm sm:p-12">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">404 · Tidak ditemukan</p>
                <h1 className="mt-3 font-heading text-3xl font-semibold">Halaman yang kamu cari tidak ada</h1>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                    Tautan mungkin sudah berubah atau bukunya tidak tersedia di katalog.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Link href="/books" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                        Jelajahi buku
                    </Link>
                    <Link href="/" className="rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-muted">
                        Ke beranda
                    </Link>
                </div>
            </section>
        </main>
    );
}
