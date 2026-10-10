import { ArrowRight, BadgeCheck, Bookmark, BookOpen, ShieldCheck, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { countUserBookmarks, listSavedBooks } from "@/lib/db/queries/bookmarks";
import { countUserBookListings } from "@/lib/db/queries/books";
import { listUserCommunities } from "@/lib/db/queries/communities";
import { listUserInterests } from "@/lib/db/queries/interests";

export const metadata: Metadata = { title: "Profil saya" };

const communityStatus = {
    VERIFIED: { label: "Terverifikasi", className: "bg-[#c9ecd6] text-primary" },
    PENDING: { label: "Menunggu verifikasi", className: "bg-[#f1f0ea] text-foreground/80" },
    REJECTED: { label: "Ditolak", className: "bg-destructive/10 text-destructive" },
    SUSPENDED: { label: "Ditangguhkan", className: "bg-destructive/10 text-destructive" },
} as const;

const roleLabels = { OWNER: "Pemilik", MANAGER: "Pengelola", MEMBER: "Anggota" } as const;

function initialsOf(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "TB";
}

const cardClass = "rounded-2xl border border-border bg-card p-5 sm:p-6";

export default async function ProfilePage() {
    const user = await getCurrentUser();
    if (!user) redirect("/login");

    const [listingCount, bookmarkCount, saved, communities, interests] = await Promise.all([
        countUserBookListings(user.id),
        countUserBookmarks(user.id),
        listSavedBooks(user.id, 3),
        listUserCommunities(user.id),
        listUserInterests(user.id),
    ]);

    const stats = [
        { icon: BookOpen, value: listingCount, label: "Buku Terdaftar", href: "/my-listings", tone: "bg-[#f1f0ea] text-foreground" },
        { icon: Bookmark, value: bookmarkCount, label: "Bookmark", href: "/bookmarks", tone: "bg-[#c9ecd6] text-primary" },
        { icon: UsersRound, value: communities.length, label: "Komunitas", href: "/communities", tone: "bg-[#e7efe8] text-primary" },
    ];

    return (
        <main className="mx-auto w-full max-w-[1256px] px-4 py-8 sm:px-6 sm:py-10">
            <header>
                <h1 className="font-heading text-[32px] leading-tight font-semibold text-primary">Profil Saya</h1>
                <p className="mt-1 max-w-2xl text-base text-muted-foreground">
                    Atur identitas, minat bacaan, dan privasimu. Lokasi hanya tampil secara umum kepada pengguna lain.
                </p>
            </header>

            <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
                <div className="flex flex-col gap-6">
                    <section aria-label="Identitas" className={`${cardClass} flex flex-col items-center text-center`}>
                        <span aria-hidden="true" className="flex size-22 items-center justify-center rounded-full bg-primary font-heading text-3xl text-primary-foreground">
                            {initialsOf(user.displayName)}
                        </span>
                        <p className="mt-4 font-heading text-xl font-semibold">{user.displayName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{user.role === "ADMIN" ? "Admin TemuBaca" : "Pembaca TemuBaca"}</p>
                        <Link href="/settings" className="mt-5 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Ubah Profil</Link>
                    </section>

                    <section aria-labelledby="interests-title" className={cardClass}>
                        <div className="flex items-center justify-between">
                            <h2 id="interests-title" className="font-heading text-lg font-semibold">Minat Bacaan</h2>
                            <Link href="/bookmarks?tab=interests" className="text-sm font-semibold text-primary hover:underline">Kelola</Link>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">Dipakai untuk rekomendasi buku. Dapat dihapus kapan saja.</p>
                        {interests.length > 0 ? (
                            <ul className="mt-4 flex list-none flex-wrap gap-2 p-0">
                                {interests.map((interest) => (
                                    <li key={interest.id} className="rounded-md bg-[#e7efe8] px-3 py-1.5 text-sm text-secondary-foreground">{interest.subject}</li>
                                ))}
                            </ul>
                        ) : (
                            <Link href="/bookmarks?tab=interests" className="mt-4 inline-flex rounded-md border border-dashed border-border px-3 py-1.5 text-sm hover:bg-muted">+ Tambah minat</Link>
                        )}
                    </section>
                </div>

                <div className="flex min-w-0 flex-col gap-6">
                    <dl className="grid gap-4 sm:grid-cols-3">
                        {stats.map(({ icon: Icon, value, label, href, tone }) => (
                            <div key={label} className="relative flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/40">
                                <span aria-hidden="true" className={`flex size-10 items-center justify-center rounded-lg ${tone}`}><Icon className="size-5" /></span>
                                <div className="flex flex-col-reverse">
                                    <dt className="text-sm">
                                        <Link href={href} className="after:absolute after:inset-0 hover:underline">{label}</Link>
                                    </dt>
                                    <dd className="font-heading text-xl font-semibold">{value}</dd>
                                </div>
                            </div>
                        ))}
                    </dl>

                    <section aria-labelledby="my-communities-title" className={cardClass}>
                        <h2 id="my-communities-title" className="font-heading text-lg font-semibold">Komunitas saya</h2>
                        {communities.length > 0 ? (
                            <ul className="mt-4 flex list-none flex-col gap-3 p-0">
                                {communities.map((community) => {
                                    const status = communityStatus[community.status];
                                    return (
                                        <li key={community.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <p className="font-heading text-base font-semibold">{community.name}</p>
                                                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${status.className}`}>
                                                        {community.status === "VERIFIED" && <BadgeCheck aria-hidden="true" className="size-3" />} {status.label}
                                                    </span>
                                                    <span className="text-muted-foreground">{roleLabels[community.role]}</span>
                                                </p>
                                            </div>
                                            {community.status === "VERIFIED" && (
                                                <Link href={`/communities/${community.id}`} className="self-start rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted sm:self-auto">Lihat Komunitas</Link>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                                Kamu belum tergabung di komunitas. <Link href="/communities" className="font-semibold text-primary hover:underline">Jelajahi komunitas</Link>
                            </p>
                        )}
                        <p className="mt-3 text-xs text-muted-foreground">Verifikasi berarti profil telah ditinjau pengelola. Ini bukan jaminan atas seluruh kegiatan komunitas.</p>
                    </section>

                    <section aria-labelledby="my-bookmarks-title" className={cardClass}>
                        <div className="flex items-center justify-between">
                            <h2 id="my-bookmarks-title" className="font-heading text-lg font-semibold">Bookmark saya</h2>
                            {bookmarkCount > saved.length && (
                                <Link href="/bookmarks" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Lihat semua <ArrowRight aria-hidden="true" className="size-3.5" /></Link>
                            )}
                        </div>
                        {saved.length > 0 ? (
                            <ul className="mt-4 flex list-none flex-col gap-3 p-0">
                                {saved.map((book) => (
                                    <li key={book.bookmarkId} className="flex gap-4 rounded-xl border border-border p-4">
                                        <span aria-hidden="true" className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-primary text-primary-foreground">
                                            {book.coverUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={book.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
                                            ) : <BookOpen className="size-5 opacity-70" />}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                {book.categories[0] && <span className="rounded bg-[#f1f0ea] px-2 py-0.5 font-semibold text-foreground/80">{book.categories[0]}</span>}
                                                {book.publisher}
                                            </p>
                                            <h3 className="mt-1 font-heading text-base font-semibold"><Link href={`/books/${book.id}`} className="hover:underline">{book.title}</Link></h3>
                                            <p className="text-sm text-muted-foreground">{book.authors.join(", ") || "Penulis belum tercatat"}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Belum ada buku tersimpan.</p>
                        )}
                    </section>

                    <section aria-labelledby="privacy-title" className={cardClass}>
                        <h2 id="privacy-title" className="border-b border-border pb-3 font-heading text-lg font-semibold">Privasi &amp; Data</h2>
                        <dl className="divide-y divide-border text-sm">
                            {[
                                ["Lokasi perangkat", "Belum dipakai. Fitur peta dan izin lokasi masih menunggu keputusan DEC-07; pencarian manual tetap tersedia."],
                                ["Notifikasi permintaan pinjam", "Belum tersedia karena alur pinjam masih menunggu DEC-02."],
                                ["Unduh atau hapus akun dan data", "Belum tersedia. Kebijakan retensi dan penghapusan akun masih menunggu DEC-11."],
                            ].map(([term, detail]) => (
                                <div key={term} className="py-3">
                                    <dt className="font-medium">{term}</dt>
                                    <dd className="mt-0.5 text-xs text-muted-foreground">{detail}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                </div>
            </div>

            <section className="mt-8 flex gap-4 rounded-xl bg-[#e7efe8] p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-card text-primary"><ShieldCheck aria-hidden="true" className="size-5" /></span>
                <div>
                    <h2 className="font-heading text-lg font-semibold">Privasimu di TemuBaca</h2>
                    <p className="text-sm text-foreground/80">Alamat rumah tidak pernah ditampilkan. Serah terima buku dilakukan di titik temu publik yang disepakati.</p>
                </div>
            </section>
        </main>
    );
}
