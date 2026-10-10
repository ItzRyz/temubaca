import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Perpustakaan",
    description: "Informasi ketersediaan buku di perpustakaan yang telah terverifikasi.",
};

export default function LibrariesPage() {
    return (
        <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-5 py-16 sm:px-8">
            <section className="w-full rounded-3xl border border-border/70 bg-card p-8 shadow-sm sm:p-12">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Akses buku</p>
                <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Informasi perpustakaan</h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                    TemuBaca belum dapat menampilkan buku yang tersedia di perpustakaan. Sumber data, pihak yang memperbarui informasi, dan masa berlaku status ketersediaan masih perlu ditetapkan agar informasi yang ditampilkan tidak menyesatkan.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                    <Link href="/books" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                        Jelajahi katalog buku
                    </Link>
                    <Link href="/communities" className="rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                        Lihat komunitas baca
                    </Link>
                </div>
            </section>
        </main>
    );
}
