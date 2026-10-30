import { BookCheck, CalendarDays, MapPin, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { memberAreaLabel } from "@/features/regions/districts";
import { getSettings } from "@/lib/db/queries/settings";
import { getCurrentUser } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/login-redirect";
import { canViewBorrowerProfile, getBorrowerProfile } from "@/lib/db/queries/borrower-profile";
import { uuidSchema } from "@/lib/validation/common";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Profil peminjam" };

const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const monthYear = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

function initialsOf(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "TB";
}

function Stars({ rating, className }: { rating: number; className?: string }) {
    return (
        <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${rating} dari 5 bintang`} role="img">
            {[1, 2, 3, 4, 5].map((value) => (
                <Star key={value} aria-hidden="true" className={cn("size-4", value <= rating ? "fill-[#e8a33d] text-[#e8a33d]" : "text-border")} />
            ))}
        </span>
    );
}

/**
 * A borrower's returns and lenders' reviews (30 Okt 2026), opened from a loan card. Only the borrower,
 * admins, and lenders who received a request from them may see it; others get a 404.
 */
export default async function BorrowerProfilePage({ params }: PageProps<"/members/[userId]">) {
    const { userId } = await params;
    if (!uuidSchema.safeParse(userId).success) notFound();
    const viewer = await getCurrentUser();
    if (!viewer) return redirectToLogin();
    if (!(await canViewBorrowerProfile(viewer, userId))) notFound();
    const [data, { settings: map }] = await Promise.all([getBorrowerProfile(userId), getSettings("map")]);
    if (!data) notFound();
    const { profile, returnedCount, returns, reviews, average } = data;
    // As precise as Pengaturan → Peta & Lokasi allows: kecamatan, kab/kota, or province.
    const area = memberAreaLabel(profile, map.locationPrecision);

    return (
        <main className="mx-auto w-full max-w-[960px] px-4 py-8 sm:px-6 sm:py-10">
            <nav aria-label="Breadcrumb" className="text-[13px] text-muted-foreground">
                <Link href="/my-listings?tab=peminjaman" className="hover:text-foreground">Pinjam &amp; pinjamkan</Link> / <span className="text-foreground">Profil peminjam</span>
            </nav>

            <section aria-labelledby="borrower-name" className="mt-4 flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:p-6">
                <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[#e7efe8] font-heading text-xl font-semibold text-primary">{initialsOf(profile.displayName)}</span>
                <div className="min-w-0 flex-1">
                    <h1 id="borrower-name" className="truncate font-heading text-2xl font-semibold text-primary">{profile.displayName}</h1>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><CalendarDays aria-hidden="true" className="size-4" /> Bergabung {monthYear.format(profile.createdAt)}</span>
                        {area && <span className="flex items-center gap-1"><MapPin aria-hidden="true" className="size-4" /> {area}</span>}
                    </p>
                </div>
                <dl className="grid grid-cols-2 gap-6 sm:text-right">
                    <div>
                        <dt className="text-xs text-muted-foreground">Buku dikembalikan</dt>
                        <dd className="font-heading text-2xl font-semibold">{returnedCount}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">Ulasan pemberi pinjam</dt>
                        <dd className="font-heading text-2xl font-semibold">{average === null ? "–" : <>{average.toLocaleString("id-ID", { maximumFractionDigits: 1 })}<span className="text-sm font-normal text-muted-foreground"> / 5 · {reviews.length}</span></>}</dd>
                    </div>
                </dl>
            </section>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <section aria-labelledby="reviews-title">
                    <h2 id="reviews-title" className="font-heading text-xl font-semibold">Ulasan pemberi pinjam</h2>
                    {reviews.length > 0 ? (
                        <ul className="mt-3 flex list-none flex-col gap-3 p-0">
                            {reviews.map((review) => (
                                <li key={review.id} className="rounded-xl border border-border bg-card p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <Stars rating={review.rating} />
                                        <time dateTime={review.createdAt.toISOString()} className="text-xs text-muted-foreground">{dateFormat.format(review.createdAt)}</time>
                                    </div>
                                    {review.comment && <p className="mt-2 text-sm leading-6">{review.comment}</p>}
                                    <p className="mt-2 text-xs text-muted-foreground">{review.reviewer} · <span className="italic">{review.title}</span></p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Belum ada ulasan dari pemberi pinjam.</p>
                    )}
                </section>

                <section aria-labelledby="returns-title">
                    <h2 id="returns-title" className="font-heading text-xl font-semibold">Riwayat pengembalian</h2>
                    {returns.length > 0 ? (
                        <ul className="mt-3 flex list-none flex-col divide-y divide-border rounded-xl border border-border bg-card p-0">
                            {returns.map((item) => (
                                <li key={item.borrowingId} className="flex items-start gap-3 p-4">
                                    <BookCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                                    <div className="min-w-0">
                                        <Link href={`/books/${item.bookId}`} className="font-semibold hover:underline">{item.title}</Link>
                                        <p className="text-xs text-muted-foreground">
                                            Dari {item.lender}{item.returnedAt ? ` · dikembalikan ${dateFormat.format(item.returnedAt)}` : ""}
                                        </p>
                                    </div>
                                    <span className="ml-auto shrink-0 rounded-full bg-[#c9ecd6] px-2 py-0.5 text-[11px] font-semibold text-primary">Dikembalikan</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Belum ada buku yang selesai dipinjam dan dikembalikan.</p>
                    )}
                    {returnedCount > returns.length && <p className="mt-2 text-xs text-muted-foreground">Menampilkan {returns.length} pengembalian terbaru dari {returnedCount}.</p>}
                </section>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">Hanya nama tampilan, wilayah, dan riwayat pinjam di TemuBaca yang ditampilkan. Kontak dan alamat tidak pernah dibagikan.</p>
        </main>
    );
}
