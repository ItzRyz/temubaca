import { BookOpen } from "lucide-react";
import type { Metadata } from "next";

import { AddBookDialog } from "@/features/book-listings/components/add-book-dialog";
import { ManagedListingItem } from "@/features/book-listings/components/managed-listing-item";
import { loadManageContext } from "@/features/community-management/server";
import { listCommunityBookListings } from "@/lib/db/queries/books";
import { latestAppealsForListings } from "@/lib/db/queries/listing-appeals";

export const metadata: Metadata = { title: "Koleksi buku komunitas" };

/**
 * A community's book collection (owner's request 30 Okt 2026): any manager adds, edits and offers copies;
 * readers borrow them from the book page like a reader's copy.
 */
export default async function ManageCollectionPage({ params }: PageProps<"/communities/[communityId]/manage/collection">) {
    const { communityId } = await params;
    const { can } = await loadManageContext(communityId);
    if (!can.manageContent) {
        return <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Koleksi buku dapat ditambahkan setelah komunitas terverifikasi.</p>;
    }

    const now = new Date();
    const listings = await listCommunityBookListings(communityId);
    const appeals = await latestAppealsForListings(listings.filter((listing) => listing.hiddenAt).map((listing) => listing.id));
    const offered = listings.filter((listing) => listing.availability === "AVAILABLE" && !listing.hiddenAt).length;

    return (
        <section aria-labelledby="collection-title" className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                    <h2 id="collection-title" className="font-heading text-xl font-semibold">Koleksi Buku</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {listings.length} buku, {offered} ditawarkan untuk dipinjam. Semua pengurus dapat mengelola koleksi dan menanggapi permintaan pinjam di menu Peminjaman.
                    </p>
                </div>
                <AddBookDialog communityId={communityId} />
            </div>
            {listings.length > 0 ? (
                <ul className="flex list-none flex-col gap-4 p-0">
                    {listings.map((listing) => <ManagedListingItem key={listing.id} listing={listing} appeal={appeals.get(listing.id)} now={now} />)}
                </ul>
            ) : (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                    <BookOpen aria-hidden="true" className="mx-auto size-8 text-primary/60" />
                    <h3 className="mt-2 font-heading text-lg font-semibold">Belum ada buku di koleksi komunitas</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Tekan Tambah Buku, pilih buku dari katalog, lalu isi titik temu publik untuk serah terima.</p>
                </div>
            )}
        </section>
    );
}
