import Link from "next/link";
import { redirect } from "next/navigation";

import { BookListingAvailability } from "@/features/book-listings/components/book-listing-availability";
import { BookListingEditor } from "@/features/book-listings/components/book-listing-editor";
import { getCurrentUser } from "@/lib/auth";
import { listUserBookListings } from "@/lib/db/queries/books";

const conditionLabels: Record<string, string> = {
    NEW: "Baru",
    LIKE_NEW: "Seperti baru",
    GOOD: "Baik",
    FAIR: "Cukup baik",
    POOR: "Perlu perhatian",
};

export default async function MyListingsPage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect("/login");
    }

    const listings = await listUserBookListings(user.id);

    return (
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 sm:px-8 sm:py-16">
            <Link href="/books" className="text-sm font-medium text-primary hover:underline">← Jelajahi buku</Link>
            <header className="mt-6">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Ruang berbagi</p>
                <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">Listing saya</h1>
                <p className="mt-3 text-sm text-muted-foreground">Kelola salinan buku yang kamu tawarkan untuk dipinjam.</p>
            </header>

            {listings.length > 0 ? (
                <ul className="mt-8 grid list-none gap-4 p-0 sm:grid-cols-2">
                    {listings.map((listing) => (
                        <li key={listing.id} className="rounded-2xl border border-border/70 bg-card p-5">
                            <Link href={`/books/${listing.book.id}`} className="font-heading text-lg font-semibold text-primary hover:underline">
                                {listing.book.title}
                            </Link>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {listing.book.authors.length > 0 ? listing.book.authors.join(", ") : "Penulis belum tercatat"}
                            </p>
                            <dl className="mt-4 grid gap-2 text-sm">
                                <div><dt className="inline font-medium">Kondisi: </dt><dd className="inline">{conditionLabels[listing.condition] ?? listing.condition}</dd></div>
                                {listing.publicLocation && <div><dt className="inline font-medium">Lokasi publik: </dt><dd className="inline">{listing.publicLocation}</dd></div>}
                                {listing.borrowingRules && <div><dt className="font-medium">Aturan peminjaman</dt><dd className="mt-1 whitespace-pre-line text-muted-foreground">{listing.borrowingRules}</dd></div>}
                            </dl>
                            <BookListingAvailability listingId={listing.id} initialAvailability={listing.availability} />
                            <BookListingEditor
                                listingId={listing.id}
                                initialCondition={listing.condition}
                                initialLocation={listing.publicLocation}
                                initialRules={listing.borrowingRules}
                            />
                        </li>
                    ))}
                </ul>
            ) : (
                <section className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
                    <h2 className="font-heading text-xl font-semibold">Belum ada listing buku</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Pilih buku dari katalog untuk menawarkan salinan yang kamu miliki.</p>
                    <Link href="/books" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                        Cari buku
                    </Link>
                </section>
            )}
        </main>
    );
}
