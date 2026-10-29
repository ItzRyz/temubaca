import { eq } from "drizzle-orm";
import { ArrowDown, ArrowRight, CheckCircle2, ChevronRight, Clock, Info, Library, MapPin, PlusCircle, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata, siteUrl, snippet } from "@/config/site";
import { db } from "@/lib/db";
import { listBookListings, publicBookColumns } from "@/lib/db/queries/books";
import { hasBookmark } from "@/lib/db/queries/bookmarks";
import { listBookDataSources } from "@/lib/db/queries/catalog-admin";
import { getCatalogSettings } from "@/lib/db/queries/settings";
import { bookConditionValues, books } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { timeAgo } from "@/lib/format/relative-time";
import { uuidSchema } from "@/lib/validation/common";
import { BookmarkButton } from "@/features/bookmarks/components/bookmark-button";
import { BookListingForm } from "@/features/book-listings/components/book-listing-form";
import { ShareButton } from "@/features/books/components/share-button";
import { ReportForm } from "@/features/reports/components/report-form";
import { BorrowRequestDialog } from "@/features/borrowing/components/borrow-request-dialog";
import { genresForSubjects } from "@/features/books/genres";
import { mergeHoldings } from "@/features/libraries/access";
import { AccessRequestDialog } from "@/features/libraries/components/access-request-dialog";
import { HoldingBadge } from "@/features/libraries/components/holding-badge";
import { listHoldingsForBook, listManagedLibraries, openAccessRequestLibraries } from "@/lib/db/queries/libraries";
import { conditionNoteFromRules, guaranteeFromRules, loanDayChoices, maxLoanDaysFromRules, meetingPointsOf } from "@/features/borrowing/lifecycle";
import { findOpenRequestsForListings } from "@/lib/db/queries/borrowing";

type BookPageProps = {
    params: Promise<{ bookId: string }>;
};

const conditionLabels: Record<(typeof bookConditionValues)[number], string> = {
    NEW: "Baru",
    LIKE_NEW: "Sangat baik",
    GOOD: "Baik",
    FAIR: "Layak baca",
    POOR: "Perlu perhatian",
};

const sourceNames = { OPEN_LIBRARY: "Open Library", GOOGLE_BOOKS: "Google Books" } as const;
const sourceLinks = { OPEN_LIBRARY: "https://openlibrary.org", GOOGLE_BOOKS: "https://books.google.com" } as const;

/** DEC-06: the record's own provider links to that record; a provider that only filled gaps links to its site. */
function sourceHref(source: keyof typeof sourceLinks, book: { provider: string; providerId: string }) {
    if (source !== book.provider) return sourceLinks[source];
    return source === "OPEN_LIBRARY"
        ? `https://openlibrary.org/works/${encodeURIComponent(book.providerId)}`
        : `https://books.google.com/books?id=${encodeURIComponent(book.providerId)}`;
}

const findPublicBook = cache(async (bookId: string) => {
    const parsedId = uuidSchema.safeParse(bookId);
    if (!parsedId.success) return null;
    const [book] = await db.select({ ...publicBookColumns, syncedAt: books.syncedAt }).from(books).where(eq(books.id, parsedId.data)).limit(1);
    return book ?? null;
});

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
    const book = await findPublicBook((await params).bookId);
    if (!book) return {};
    const by = book.authors.length ? ` karya ${book.authors.join(", ")}` : "";
    return pageMetadata({
        title: book.title,
        description: snippet(book.description, `${book.title}${by}. Lihat salinan yang dibagikan warga dan perpustakaan yang mencatatnya di TemuBaca.`),
        path: `/books/${book.id}`,
        image: book.coverUrl,
        openGraph: { type: "book", authors: book.authors, isbn: book.isbn ?? undefined },
    });
}

const secondaryButtonClass = "flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";
const borrowButtonClass = "inline-flex min-h-9 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const headerActionClass = "inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";
const VISIBLE_COPIES = 4;

type BookPageSearch = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Figma "Detail Buku" revision 250:2312 with states 252:2036 (no owner), 252:2431 (guest), 253:2150 (no library). */
export default async function BookDetailPage({ params, searchParams }: BookPageProps & BookPageSearch) {
    const book = await findPublicBook((await params).bookId);
    if (!book) notFound();
    const showAllCopies = (await searchParams).salinan === "semua";

    const [user, listings, { settings }, sources, holdingRows] = await Promise.all([
        getCurrentUser(),
        listBookListings(book.id),
        getCatalogSettings(),
        listBookDataSources(book),
        listHoldingsForBook(book.id),
    ]);
    const [isBookmarked, openRequests, openAccess, managed] = user
        ? await Promise.all([
            hasBookmark(user.id, book.id),
            findOpenRequestsForListings(user.id, listings.map((listing) => listing.id)),
            openAccessRequestLibraries(user.id, book.id),
            listManagedLibraries(user.id),
        ])
        : [false, new Map<string, { id: string; status: string }>(), new Set<string>(), []];
    const managedIds = new Set(managed.map((library) => library.id));
    const holdings = mergeHoldings(holdingRows);
    const bookGenres = genresForSubjects(book.categories);
    const authors = book.authors.length > 0 ? book.authors.join(", ") : "Penulis belum tercatat";
    const details = [
        ["ISBN", book.isbn],
        ["Penerbit", book.publisher],
        ["Terbit pertama", book.publishedAt],
        ["Bahasa", book.language],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));
    const visibleCopies = showAllCopies ? listings : listings.slice(0, VISIBLE_COPIES);
    const hiddenCopies = listings.length - visibleCopies.length;
    const now = new Date();
    const returnTo = `/books/${book.id}`;

    const librariesText = holdings.length > 0 ? `Tercatat di ${holdings.length} perpustakaan` : "Belum tercatat di perpustakaan";
    const summary = listings.length > 0
        ? `${librariesText}, dan ada ${listings.length} salinan warga yang sedang ditawarkan.`
        : `${librariesText}, dan belum ada salinan warga yang ditawarkan.`;

    return (
        <main className="mx-auto w-full max-w-[1256px] px-4 pb-10 sm:px-6">
            <JsonLd data={{
                "@context": "https://schema.org",
                "@type": "Book",
                name: book.title,
                url: new URL(`/books/${book.id}`, siteUrl).toString(),
                ...(book.authors.length ? { author: book.authors.map((name) => ({ "@type": "Person", name })) } : {}),
                ...(book.isbn ? { isbn: book.isbn } : {}),
                ...(book.publisher ? { publisher: { "@type": "Organization", name: book.publisher } } : {}),
                ...(book.publishedAt ? { datePublished: book.publishedAt } : {}),
                ...(book.language ? { inLanguage: book.language } : {}),
                ...(book.coverUrl ? { image: book.coverUrl } : {}),
                ...(book.description ? { description: snippet(book.description, "") } : {}),
            }} />
            <nav aria-label="Breadcrumb" className="py-3 text-[13px] text-muted-foreground">
                <ol className="flex list-none flex-wrap items-center gap-1 p-0">
                    <li><Link href="/books" className="hover:text-foreground">Jelajahi</Link></li>
                    {bookGenres[0] && (
                        <>
                            <li aria-hidden="true"><ChevronRight className="size-3" /></li>
                            <li><Link href={`/books?category=${bookGenres[0].slug}`} className="hover:text-foreground">{bookGenres[0].label}</Link></li>
                        </>
                    )}
                    <li aria-hidden="true"><ChevronRight className="size-3" /></li>
                    <li aria-current="page" className="max-w-60 truncate font-semibold text-foreground">{book.title}</li>
                </ol>
            </nav>

            <div className="mt-4 grid gap-6 lg:grid-cols-[372px_1fr]">
                <div className="flex flex-col gap-6">
                    <section aria-label="Sampul dan aksi" className="rounded-2xl border border-border bg-card p-5 shadow-[0_4px_16px_rgba(31,41,36,0.05)]">
                        <div className="mx-auto flex aspect-[4/5] max-w-xs items-center justify-center overflow-hidden rounded-xl bg-[#ffdbd1] p-6 lg:max-w-none">
                            {book.coverUrl ? (
                                // Cover hosts depend on the catalog provider (DEC-06); next/image remote patterns are not fixed yet.
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={book.coverUrl} alt={`Sampul ${book.title}`} referrerPolicy="no-referrer" className="h-full rounded object-contain shadow-md" />
                            ) : (
                                <div aria-hidden="true" className="flex flex-col items-center gap-3 text-center">
                                    <span className="font-heading text-[32px] leading-tight font-semibold text-[#5c1a0a]">{book.title}</span>
                                    <span className="text-sm text-[#5c1a0a]/80">{authors}</span>
                                </div>
                            )}
                        </div>
                        <div className="mt-4 flex flex-col gap-2">
                            <a href="#cara-membaca" className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                                Lihat Cara Membaca <ArrowDown aria-hidden="true" className="size-4" />
                            </a>
                            <BookmarkButton
                                bookId={book.id}
                                isAuthenticated={user !== null}
                                initiallyBookmarked={isBookmarked}
                                className={`${secondaryButtonClass} disabled:opacity-60`}
                            />
                        </div>
                    </section>

                    {details.length > 0 && (
                        <section aria-labelledby="details-title" className="rounded-2xl border border-border bg-card p-5">
                            <h2 id="details-title" className="font-heading text-lg font-semibold">Detail Buku</h2>
                            <dl className="mt-3 divide-y divide-border">
                                {details.map(([label, value]) => (
                                    <div key={label} className="flex justify-between gap-4 py-2.5 text-sm">
                                        <dt className="text-muted-foreground">{label}</dt>
                                        <dd className="text-right font-medium">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                            {settings.showAttribution && sources.length > 0 && (
                                <p className="mt-3 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
                                    <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                                    <span>
                                        Sumber:{" "}
                                        {sources.map((source, index) => (
                                            <span key={source}>
                                                {index > 0 && ", "}
                                                <a href={sourceHref(source, book)} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">{sourceNames[source]}</a>
                                            </span>
                                        ))}
                                        {book.syncedAt && <> · diperbarui {timeAgo(book.syncedAt, now)}</>}. Data dapat tidak lengkap.
                                    </span>
                                </p>
                            )}
                        </section>
                    )}
                </div>

                <div className="flex min-w-0 flex-col gap-6">
                    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            {bookGenres.length > 0 ? (
                                <ul aria-label="Genre" className="flex list-none flex-wrap gap-2 p-0">
                                    {bookGenres.slice(0, 2).map((genre) => (
                                        <li key={genre.slug}>
                                            <Link href={`/books?category=${genre.slug}`} className="inline-flex rounded bg-[#e7efe8] px-2 py-0.5 text-xs font-semibold text-secondary-foreground hover:bg-[#d9e6db]">{genre.label}</Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : <span />}
                            <div className="flex gap-2">
                                <ShareButton title={book.title} className={headerActionClass} />
                                <ReportForm
                                    targetType="BOOK"
                                    targetId={book.id}
                                    targetName={book.title}
                                    targetMeta={authors}
                                    isAuthenticated={user !== null}
                                    label="Laporkan"
                                    triggerClassName={headerActionClass}
                                />
                            </div>
                        </div>
                        <h1 className="mt-3 font-heading text-[32px] leading-tight font-bold tracking-tight text-primary sm:text-[40px]">{book.title}</h1>
                        <p className="mt-2 text-sm text-muted-foreground">Karya <span className="font-semibold text-primary">{authors}</span></p>
                        <p className="mt-4 flex items-start gap-2 rounded-lg bg-[#e7efe8] px-3 py-2.5 text-sm text-secondary-foreground">
                            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {summary}
                        </p>
                    </section>

                    <section id="cara-membaca" aria-labelledby="access-title" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                        <h2 id="access-title" className="font-heading text-xl font-semibold">Cara Membaca di Sekitar Anda</h2>
                        <p className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-[#faf7f0] px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                            <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                            Ketersediaan bisa berubah. Konfirmasi kepada pemilik salinan sebelum bertemu di tempat umum.
                        </p>

                        <h3 className="mt-6 flex items-center gap-2 font-heading text-base font-semibold"><Library aria-hidden="true" className="size-4" /> Perpustakaan</h3>
                        {holdings.length > 0 ? (
                            <ul className="mt-3 flex list-none flex-col gap-3 p-0">
                                {holdings.map((holding) => (
                                    <li key={holding.libraryId} className="flex flex-col gap-3 rounded-xl border border-border bg-[#faf7f0] p-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="font-semibold"><Link href={`/libraries/${holding.libraryId}`} className="hover:underline">{holding.library.name}</Link></p>
                                            {holding.library.publicLocation && <p className="text-sm text-muted-foreground">{holding.library.publicLocation}</p>}
                                            <div className="mt-2"><HoldingBadge holding={holding} now={now} /></div>
                                            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
                                                {holding.library.placeId && <Link href={`/map?tempat=${holding.library.placeId}`} className="flex items-center gap-1 text-primary hover:underline"><MapPin aria-hidden="true" className="size-3" /> Peta Literasi</Link>}
                                                {(holding.sourceUrl ?? holding.library.catalogUrl) && (
                                                    <a href={(holding.sourceUrl ?? holding.library.catalogUrl)!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Rekaman katalog<span className="sr-only"> (tab baru)</span></a>
                                                )}
                                            </p>
                                        </div>
                                        <div className="shrink-0">
                                            {!holding.library.accessEnabled ? (
                                                <span className="text-xs text-muted-foreground">Datang langsung ke perpustakaan</span>
                                            ) : !user ? (
                                                <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className={borrowButtonClass}>Masuk untuk mengajukan</Link>
                                            ) : managedIds.has(holding.libraryId) ? (
                                                <Link href={`/libraries/${holding.libraryId}/manage`} className="text-xs font-semibold text-primary hover:underline">Perpustakaan Anda · Kelola</Link>
                                            ) : openAccess.has(holding.libraryId) ? (
                                                <Link href="/my-listings?tab=peminjaman&view=perpustakaan" className="inline-flex min-h-9 items-center rounded-lg bg-[#e7efe8] px-3 text-xs font-semibold text-primary hover:bg-[#d9e6db]">Pengajuan terkirim · Lihat</Link>
                                            ) : (
                                                <AccessRequestDialog
                                                    libraryId={holding.libraryId}
                                                    libraryName={holding.library.name}
                                                    bookId={book.id}
                                                    bookTitle={book.title}
                                                    accessRules={holding.library.accessRules}
                                                    pickupDays={holding.library.pickupDays}
                                                    triggerClassName={borrowButtonClass}
                                                />
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="mt-3 flex flex-col items-center rounded-xl border border-dashed border-border bg-[#faf7f0] px-5 py-6 text-center">
                                <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-[#e7efe8] text-primary"><Library className="size-4" /></span>
                                <p className="mt-3 font-heading text-base font-semibold">Belum tercatat di perpustakaan</p>
                                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                                    Belum ada perpustakaan di TemuBaca yang mencatat buku ini. Ini tidak berarti bukunya tidak ada di perpustakaan.
                                </p>
                                <Link href="/libraries" className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted">
                                    Lihat daftar perpustakaan <ChevronRight aria-hidden="true" className="size-4" />
                                </Link>
                            </div>
                        )}

                        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="flex items-center gap-2 font-heading text-base font-semibold"><UsersRound aria-hidden="true" className="size-4" /> Berbagi Buku</h3>
                            <p className="flex items-center gap-1 text-xs text-muted-foreground"><Info aria-hidden="true" className="size-3.5" /> Serah terima selalu di tempat umum</p>
                        </div>

                        {!user && listings.length > 0 && (
                            <div className="mt-3 flex flex-col gap-3 rounded-xl bg-[#e7efe8] p-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="flex items-start gap-3 text-sm">
                                    <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-primary"><UserRound className="size-4" /></span>
                                    <span>
                                        <span className="block font-semibold">Masuk untuk menyimpan dan membagikan buku</span>
                                        <span className="block text-xs text-muted-foreground">Semua salinan tetap bisa kamu lihat tanpa akun.</span>
                                    </span>
                                </p>
                                <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                                    Masuk / Daftar
                                </Link>
                            </div>
                        )}

                        {listings.length > 0 ? (
                            <>
                                <ul className="mt-3 grid list-none gap-4 p-0 md:grid-cols-2">
                                    {visibleCopies.map((listing) => (
                                        <li key={listing.id} className="flex flex-col rounded-xl border border-border bg-[#faf7f0] p-4">
                                            <p className="flex items-center gap-1 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                                                <UserRound aria-hidden="true" className="size-3" /> Perorangan
                                            </p>
                                            <div className="mt-1 flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold">{listing.ownerUser.displayName}</p>
                                                    <p className="text-xs text-muted-foreground">Bergabung sejak {listing.ownerUser.createdAt.getFullYear()}</p>
                                                </div>
                                                <span className="shrink-0 rounded-full bg-[#c9ecd6] px-2 py-0.5 text-[11px] font-semibold text-primary">Ditawarkan</span>
                                            </div>
                                            <ul className="mt-3 mb-4 flex list-none flex-col gap-1.5 p-0 text-xs text-foreground/85">
                                                <li className="flex items-start gap-1.5">
                                                    <MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                                                    {listing.publicLocation ? `Titik temu: ${listing.publicLocation}` : "Titik temu dipilih bersama di tempat umum"}
                                                </li>
                                                <li className="flex items-start gap-1.5"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /> Kondisi buku: {conditionLabels[listing.condition]}</li>
                                                {listing.borrowingRules && (
                                                    <li className="flex items-start gap-1.5"><Clock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /> <span className="line-clamp-2">{listing.borrowingRules}</span></li>
                                                )}
                                                {guaranteeFromRules(listing.borrowingRules) && (
                                                    <li className="flex items-start gap-1.5"><ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /> Jaminan non-uang: {guaranteeFromRules(listing.borrowingRules)}</li>
                                                )}
                                            </ul>
                                            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                                                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                    <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" /> Diperbarui {timeAgo(listing.updatedAt, now)}
                                                </p>
                                                {!user ? (
                                                    <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className={borrowButtonClass}>Masuk untuk meminjam</Link>
                                                ) : listing.ownerId === user.id ? (
                                                    <span className="rounded-lg bg-[#ebe9e1] px-3 py-1.5 text-xs font-semibold text-muted-foreground">Salinan Anda</span>
                                                ) : openRequests.has(listing.id) ? (
                                                    <Link href="/my-listings?tab=peminjaman&view=pinjam" className="inline-flex min-h-9 items-center rounded-lg bg-[#e7efe8] px-3 text-xs font-semibold text-primary hover:bg-[#d9e6db]">
                                                        Permintaan terkirim · Lihat
                                                    </Link>
                                                ) : (
                                                    <BorrowRequestDialog
                                                        listingId={listing.id}
                                                        bookTitle={book.title}
                                                        bookMeta={[authors, book.publisher].filter(Boolean).join(" • ")}
                                                        ownerName={listing.ownerUser.displayName}
                                                        conditionNote={conditionNoteFromRules(listing.borrowingRules)}
                                                        guarantee={guaranteeFromRules(listing.borrowingRules)}
                                                        meetingPoints={meetingPointsOf(listing.publicLocation)}
                                                        loanChoices={loanDayChoices(maxLoanDaysFromRules(listing.borrowingRules))}
                                                        triggerClassName={borrowButtonClass}
                                                    />
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-x-4">
                                                <ReportForm targetType="BOOK_LISTING" targetId={listing.id} targetName={book.title} targetMeta={`Salinan milik ${listing.ownerUser.displayName}`} isAuthenticated={user !== null} label="Laporkan listing" />
                                                {listing.ownerId !== user?.id && (
                                                    <ReportForm targetType="USER" targetId={listing.ownerId} targetName={listing.ownerUser.displayName} targetMeta="Pemilik buku" isAuthenticated={user !== null} label="Laporkan akun pemilik" />
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                                {hiddenCopies > 0 && (
                                    <p className="mt-4 text-right">
                                        <Link href={`${returnTo}?salinan=semua#cara-membaca`} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary hover:underline">
                                            Lihat {hiddenCopies} lainnya <ArrowRight aria-hidden="true" className="size-4" />
                                        </Link>
                                    </p>
                                )}
                            </>
                        ) : (
                            <div className="mt-3 flex flex-col items-center rounded-xl border border-dashed border-border bg-[#faf7f0] px-5 py-8 text-center">
                                <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-[#e7efe8] text-primary"><UsersRound className="size-4" /></span>
                                <p className="mt-3 font-heading text-base font-semibold">Belum ada yang berbagi buku ini</p>
                                <p className="mt-1 max-w-md text-sm text-muted-foreground">Jadilah yang pertama membagikan salinan di areamu.</p>
                                <a href="#punya-salinan" className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                                    <PlusCircle aria-hidden="true" className="size-4" /> Daftarkan Buku Anda
                                </a>
                            </div>
                        )}
                    </section>

                    <section aria-labelledby="about-title" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                        <h2 id="about-title" className="font-heading text-xl font-semibold text-primary">Tentang Buku</h2>
                        {book.description ? (
                            <p className="mt-4 text-base leading-7 whitespace-pre-line text-foreground/90">{book.description}</p>
                        ) : (
                            <p className="mt-4 text-sm text-muted-foreground">Sinopsis belum tersedia di katalog.</p>
                        )}
                    </section>

                    <section id="punya-salinan" aria-labelledby="share-copy-title" className="rounded-2xl bg-primary p-6 text-primary-foreground">
                        <h2 id="share-copy-title" className="font-heading text-xl font-semibold">Punya salinan di rumah?</h2>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-primary-foreground/80">
                            Bantu pembaca di sekitar Anda. Alamat rumah tidak pernah ditampilkan; serah terima dilakukan di titik temu publik.
                        </p>
                        <BookListingForm
                            bookId={book.id}
                            isAuthenticated={user !== null}
                            className="mt-5"
                            triggerClassName="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-card px-4 text-sm font-semibold text-primary hover:bg-card/90"
                        />
                    </section>
                </div>
            </div>
        </main>
    );
}
