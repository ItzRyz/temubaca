import { eq } from "drizzle-orm";
import { BookOpen, ChevronRight, Info, Landmark, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { db } from "@/lib/db";
import { listBookListings, publicBookColumns } from "@/lib/db/queries/books";
import { hasBookmark } from "@/lib/db/queries/bookmarks";
import { bookConditionValues, books } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { uuidSchema } from "@/lib/validation/common";
import { BookmarkButton } from "@/features/bookmarks/components/bookmark-button";
import { BookListingForm } from "@/features/book-listings/components/book-listing-form";
import { ShareButton } from "@/features/books/components/share-button";
import { ReportForm } from "@/features/reports/components/report-form";

type BookPageProps = {
    params: Promise<{ bookId: string }>;
};

const conditionLabels: Record<(typeof bookConditionValues)[number], string> = {
    NEW: "Baru",
    LIKE_NEW: "Seperti baru",
    GOOD: "Baik",
    FAIR: "Cukup baik",
    POOR: "Perlu perhatian",
};

const updatedFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" });

const findPublicBook = cache(async (bookId: string) => {
    const parsedId = uuidSchema.safeParse(bookId);
    if (!parsedId.success) return null;
    const [book] = await db.select(publicBookColumns).from(books).where(eq(books.id, parsedId.data)).limit(1);
    return book ?? null;
});

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
    const book = await findPublicBook((await params).bookId);
    return book ? { title: book.title, description: book.description?.slice(0, 160) ?? undefined } : {};
}

const secondaryButtonClass = "flex min-h-10 flex-1 items-center justify-center rounded-lg border border-border bg-[#faf7f0] px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

export default async function BookDetailPage({ params }: BookPageProps) {
    const book = await findPublicBook((await params).bookId);
    if (!book) notFound();

    const [user, listings] = await Promise.all([
        getCurrentUser(),
        listBookListings(book.id),
    ]);
    const isBookmarked = user ? await hasBookmark(user.id, book.id) : false;
    const authors = book.authors.length > 0 ? book.authors.join(", ") : "Penulis belum tercatat";
    const bibliography = [
        ["ISBN", book.isbn],
        ["Bahasa", book.language],
        ["Tahun terbit", book.publishedAt],
        ["Penerbit", book.publisher],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));
    const meta = [book.publishedAt, book.publisher, book.language].filter(Boolean);

    return (
        <main className="mx-auto w-full max-w-[1256px] px-4 pb-8 sm:px-6">
            <nav aria-label="Breadcrumb" className="py-3 text-[13px] text-muted-foreground">
                <ol className="flex list-none flex-wrap items-center gap-1 p-0">
                    <li><Link href="/books" className="hover:text-foreground">Jelajahi</Link></li>
                    {book.categories[0] && (
                        <>
                            <li aria-hidden="true"><ChevronRight className="size-3" /></li>
                            <li><Link href={`/books?category=${encodeURIComponent(book.categories[0])}`} className="hover:text-foreground">{book.categories[0]}</Link></li>
                        </>
                    )}
                    <li aria-hidden="true"><ChevronRight className="size-3" /></li>
                    <li aria-current="page" className="max-w-60 truncate font-semibold text-foreground">{book.title}</li>
                </ol>
            </nav>

            <div className="mt-4 grid gap-6 lg:grid-cols-[372px_1fr]">
                <div className="flex flex-col gap-6">
                    <section aria-label="Sampul dan aksi" className="rounded-2xl border border-border bg-card p-5 shadow-[0_4px_16px_rgba(31,41,36,0.05)]">
                        <div className="mx-auto flex aspect-[4/5] max-w-xs items-center justify-center overflow-hidden rounded-xl bg-[#f1f0ea] p-6 lg:max-w-none">
                            {book.coverUrl ? (
                                // Cover hosts depend on the catalog provider (DEC-06); next/image remote patterns are not fixed yet.
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={book.coverUrl} alt={`Sampul ${book.title}`} referrerPolicy="no-referrer" className="h-full rounded object-contain shadow-md" />
                            ) : (
                                <div aria-hidden="true" className="flex h-full w-3/4 flex-col items-center justify-center gap-3 rounded bg-card p-5 text-center shadow-md">
                                    <BookOpen className="size-6 text-primary/50" />
                                    <span className="font-heading text-xl leading-tight font-semibold text-primary uppercase">{book.title}</span>
                                    <span className="h-px w-12 bg-border" />
                                    <span className="font-heading text-sm text-foreground/80 italic">{authors}</span>
                                </div>
                            )}
                        </div>
                        <div className="mt-4 flex gap-2">
                            <BookmarkButton
                                bookId={book.id}
                                isAuthenticated={user !== null}
                                initiallyBookmarked={isBookmarked}
                                className={`${secondaryButtonClass} w-full disabled:opacity-60`}
                            />
                            <ShareButton title={book.title} className={secondaryButtonClass} />
                        </div>
                        <ReportForm targetType="BOOK" targetId={book.id} targetName={book.title} isAuthenticated={user !== null} />
                    </section>

                    {bibliography.length > 0 && (
                        <section aria-labelledby="bibliography-title" className="rounded-2xl border border-border bg-card p-5">
                            <h2 id="bibliography-title" className="font-heading text-lg font-semibold">Identitas Bibliografi</h2>
                            <dl className="mt-4 grid gap-3">
                                {bibliography.map(([label, value]) => (
                                    <div key={label} className="flex justify-between gap-4 text-sm">
                                        <dt className="text-muted-foreground">{label}</dt>
                                        <dd className="text-right font-medium">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                            <p className="mt-4 rounded-lg bg-[#f1f0ea] p-3 text-xs leading-5 text-foreground/80">
                                Tercatat di <strong>{listings.length} salinan warga</strong> yang sedang tersedia.
                            </p>
                        </section>
                    )}
                </div>

                <div className="flex min-w-0 flex-col gap-6">
                    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                        {book.categories.length > 0 && (
                            <ul className="flex list-none flex-wrap gap-2 p-0">
                                {book.categories.slice(0, 3).map((category) => (
                                    <li key={category} className="rounded-full bg-[#e7efe8] px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">{category}</li>
                                ))}
                            </ul>
                        )}
                        <h1 className="mt-3 font-heading text-[32px] leading-tight font-bold tracking-tight text-[#1f2924] sm:text-[40px]">{book.title}</h1>
                        <p className="mt-2 text-sm text-muted-foreground">Karya <span className="font-heading text-base font-semibold text-primary">{authors}</span></p>
                        {meta.length > 0 && <p className="mt-4 text-xs text-muted-foreground">{meta.join(" • ")}</p>}
                    </section>

                    <section aria-labelledby="about-title" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                        <h2 id="about-title" className="font-heading text-xl font-semibold">Tentang Buku</h2>
                        {book.description ? (
                            <p className="mt-4 font-heading text-base leading-7 whitespace-pre-line text-foreground/90">{book.description}</p>
                        ) : (
                            <p className="mt-4 text-sm text-muted-foreground">Sinopsis belum tersedia di katalog.</p>
                        )}
                    </section>

                    <section aria-labelledby="access-title" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                        <h2 id="access-title" className="font-heading text-xl font-semibold">Cara Membaca di Sekitarmu</h2>
                        <p className="mt-1 text-xs text-muted-foreground">Ketersediaan fisik yang dicatat di TemuBaca.</p>
                        <p className="mt-4 rounded-lg bg-[#f1f0ea] p-3 text-xs leading-5 text-foreground/80">
                            Ketersediaan buku fisik dapat berubah. Konfirmasi kepada pemilik salinan sebelum bertemu di lokasi publik.
                        </p>

                        <h3 className="mt-6 flex items-center gap-2 font-heading text-base font-semibold"><Landmark aria-hidden="true" className="size-4" /> Perpustakaan Daerah &amp; Publik</h3>
                        <p className="mt-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                            Data ketersediaan perpustakaan belum tersedia di TemuBaca. Kami tidak menampilkan stok perpustakaan sampai sumber datanya terverifikasi.
                        </p>

                        <h3 className="mt-6 font-heading text-base font-semibold">Berbagi Buku Warga</h3>
                        {listings.length > 0 ? (
                            <ul className="mt-3 grid list-none gap-4 p-0 md:grid-cols-2">
                                {listings.map((listing) => (
                                    <li key={listing.id} className="flex flex-col rounded-xl border border-border bg-[#faf7f0] p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="text-sm font-semibold">Salinan milik {listing.ownerUser.displayName}</p>
                                            <span className="shrink-0 rounded-full bg-[#c9ecd6] px-2 py-0.5 text-[11px] font-semibold text-primary">Bisa dipinjam</span>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">Kondisi: {conditionLabels[listing.condition]}</p>
                                        {(listing.publicLocation || listing.borrowingRules) && (
                                            <div className="mt-3 rounded-lg bg-card p-3 text-xs leading-5">
                                                {listing.publicLocation && (
                                                    <p className="flex items-center gap-1 font-semibold"><MapPin aria-hidden="true" className="size-3.5" /> {listing.publicLocation}</p>
                                                )}
                                                {listing.borrowingRules && <p className="mt-1 whitespace-pre-line text-muted-foreground">{listing.borrowingRules}</p>}
                                            </div>
                                        )}
                                        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                                            Diperbarui {updatedFormatter.format(listing.updatedAt)}
                                        </p>
                                        <ReportForm targetType="BOOK_LISTING" targetId={listing.id} isAuthenticated={user !== null} />
                                        {listing.ownerId !== user?.id && (
                                            <ReportForm targetType="USER" targetId={listing.ownerId} isAuthenticated={user !== null} label="Laporkan akun pemilik" />
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                                <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                                Belum ada salinan warga yang tersedia untuk buku ini.
                            </p>
                        )}
                    </section>

                    <section aria-labelledby="share-copy-title" className="rounded-2xl bg-primary p-6 text-primary-foreground">
                        <h2 id="share-copy-title" className="font-heading text-xl font-semibold">Punya Salinan di Rumah?</h2>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-primary-foreground/80">
                            Bantu pembaca lain di sekitarmu. Daftarkan salinanmu dengan lokasi publik umum saja—alamat rumah tidak perlu dicantumkan.
                        </p>
                        <BookListingForm
                            bookId={book.id}
                            isAuthenticated={user !== null}
                            className="mt-5"
                            triggerClassName="inline-flex min-h-10 items-center gap-1 rounded-lg bg-card px-4 text-sm font-semibold text-primary hover:bg-card/90"
                        />
                    </section>
                </div>
            </div>
        </main>
    );
}
