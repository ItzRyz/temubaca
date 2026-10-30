import { BookOpen, EyeOff, MapPin } from "lucide-react";
import Link from "next/link";

import { primaryGenreLabel } from "@/features/books/genres";
import { AppealDialog } from "@/features/listing-appeals/components/appeal-dialog";
import { timeAgo } from "@/lib/format/relative-time";

import { BookListingAvailability } from "./book-listing-availability";
import { BookListingDelete } from "./book-listing-delete";
import { BookListingEditor } from "./book-listing-editor";

const conditionLabels: Record<string, string> = {
    NEW: "Baru",
    LIKE_NEW: "Sangat baik",
    GOOD: "Baik",
    FAIR: "Layak baca",
    POOR: "Perlu perhatian",
};

export const listingStatusBadge = {
    AVAILABLE: { label: "Tersedia", note: "Siap dipinjam kawan", className: "bg-[#c9ecd6] text-primary" },
    // RESERVED from an accepted request until the copy is back (30 Okt 2026); the loan state says which part.
    RESERVED: { label: "Dipesan", note: "Permintaan diterima, menunggu serah terima", className: "bg-[#fbe7c6] text-[#7a4b00]" },
    BORROWED: { label: "Sedang Dipinjam", note: "Buku sedang dibawa peminjam sampai dikembalikan", className: "bg-[#ffdbd1] text-[#5c1a0a]" },
    UNAVAILABLE: { label: "Tidak Ditawarkan", note: "Disimpan sebagai arsip bacaan pribadi", className: "bg-[#f1f0ea] text-foreground/80" },
    HIDDEN: { label: "Disembunyikan Moderator", note: "Tidak muncul di halaman buku publik", className: "bg-destructive/10 text-destructive" },
} as const;

/** Free-text notes are shown inside a sentence that adds its own period. */
function withoutFinalPeriod(text: string | null | undefined) {
    return text?.trim().replace(/\.+$/, "") || null;
}

export type ManagedListing = {
    id: string;
    condition: string;
    availability: "AVAILABLE" | "RESERVED" | "UNAVAILABLE";
    publicLocation: string | null;
    borrowingRules: string | null;
    hiddenAt: Date | null;
    hiddenReason: string | null;
    book: { id: string; title: string; authors: string[]; categories: string[]; publishedAt: string | null; publisher: string | null; coverUrl: string | null };
};

/**
 * One copy its owner manages (status, appeal, availability, edit, delete): on "Buku Saya" and in a
 * community's collection (30 Okt 2026).
 */
export function ManagedListingItem({ listing, appeal, now, loanState }: {
    listing: ManagedListing;
    appeal?: { status: string; createdAt: Date; reviewNote: string | null };
    now: Date;
    /** For a RESERVED copy: whether it waits for handover or is out on loan. */
    loanState?: "AWAITING_HANDOVER" | "BORROWED";
}) {
    const status = listingStatusBadge[listing.hiddenAt ? "HIDDEN" : listing.availability === "RESERVED" && loanState === "BORROWED" ? "BORROWED" : listing.availability];
    return (
        <li className="rounded-xl border border-border bg-card p-4">
            <div className="grid gap-4 sm:grid-cols-[64px_1fr] lg:grid-cols-[64px_1fr_240px_auto] lg:items-center">
                <span aria-hidden="true" className="flex h-20 w-16 items-center justify-center overflow-hidden rounded bg-primary text-primary-foreground">
                    {listing.book.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={listing.book.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
                    ) : <BookOpen className="size-5 opacity-70" />}
                </span>
                <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {primaryGenreLabel(listing.book.categories) && <span className="rounded bg-[#f1f0ea] px-2 py-0.5 font-semibold text-foreground/80">{primaryGenreLabel(listing.book.categories)}</span>}
                        {[listing.book.publishedAt, listing.book.publisher].filter(Boolean).join(" • ")}
                    </p>
                    <h2 className="mt-1 font-heading text-lg font-semibold">
                        <Link href={`/books/${listing.book.id}`} className="hover:underline">{listing.book.title}</Link>
                    </h2>
                    <p className="text-sm text-muted-foreground">{listing.book.authors.join(", ") || "Penulis belum tercatat"}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        {listing.availability === "UNAVAILABLE" || listing.hiddenAt ? (
                            <><EyeOff aria-hidden="true" className="size-3.5" /> Tidak muncul di halaman buku publik</>
                        ) : (
                            <><MapPin aria-hidden="true" className="size-3.5" /> {listing.publicLocation ? `Titik temu: ${listing.publicLocation}` : "Lokasi publik belum diisi"}</>
                        )}
                    </p>
                </div>
                <div className="text-xs text-muted-foreground">
                    <p className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 font-semibold ${status.className}`}>{status.label}</span>
                        {status.note}
                    </p>
                    {listing.hiddenAt && (
                        <div className="mt-1">
                            <p className="text-destructive">Alasan moderator: {withoutFinalPeriod(listing.hiddenReason) ?? "tidak dicantumkan"}.</p>
                            {appeal?.status === "PENDING" ? (
                                <p className="mt-1 text-foreground/80">Banding sedang ditinjau (diajukan {timeAgo(appeal.createdAt, now)}). Listing tetap tersembunyi sampai ada keputusan.</p>
                            ) : (
                                <>
                                    {appeal?.status === "REJECTED" && <p className="mt-1 text-foreground/80">Banding sebelumnya ditolak: {withoutFinalPeriod(appeal.reviewNote) ?? "tanpa catatan"}.</p>}
                                    <AppealDialog listingId={listing.id} bookTitle={listing.book.title} hiddenAt={listing.hiddenAt.toISOString()} hiddenReason={listing.hiddenReason} />
                                </>
                            )}
                        </div>
                    )}
                    <p className="mt-1">Kondisi: {conditionLabels[listing.condition] ?? listing.condition}</p>
                </div>
                <BookListingAvailability listingId={listing.id} initialAvailability={listing.availability} />
            </div>
            <BookListingEditor
                listingId={listing.id}
                initialCondition={listing.condition}
                initialLocation={listing.publicLocation}
                initialRules={listing.borrowingRules}
            />
            <BookListingDelete listingId={listing.id} bookTitle={listing.book.title} availability={listing.availability} />
        </li>
    );
}
