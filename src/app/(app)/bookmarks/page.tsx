import Link from "next/link";
import { redirect } from "next/navigation";

import { BookCard } from "@/features/books/components/book-card";
import { getCurrentUser } from "@/lib/auth";
import { listUserBookmarks } from "@/lib/db/queries/bookmarks";

export default async function BookmarksPage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect("/login");
    }

    const bookmarks = await listUserBookmarks(user.id);

    return (
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 sm:px-8 sm:py-16">
            <Link href="/books" className="text-sm font-medium text-primary hover:underline">← Jelajahi buku</Link>
            <header className="mt-6">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Ruang bacamu</p>
                <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">Buku tersimpan</h1>
                <p className="mt-3 text-sm text-muted-foreground">Kumpulan buku yang ingin kamu baca nanti.</p>
            </header>

            {bookmarks.length > 0 ? (
                <ul className="mt-8 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
                    {bookmarks.map(({ id, book }) => (
                        <li key={id} className="relative">
                            <BookCard book={book} />
                        </li>
                    ))}
                </ul>
            ) : (
                <section className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
                    <h2 className="font-heading text-xl font-semibold">Belum ada buku tersimpan</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Simpan buku dari halaman detail untuk menemukannya kembali di sini.</p>
                    <Link href="/books" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                        Cari buku
                    </Link>
                </section>
            )}
        </main>
    );
}
