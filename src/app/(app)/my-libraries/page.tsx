import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/login-redirect";
import { listManagedLibraries } from "@/lib/db/queries/libraries";

export const metadata: Metadata = { title: "Perpustakaan Saya" };
export const dynamic = "force-dynamic";

/** Libraries this account runs (appointed by an admin, TB-023). */
export default async function MyLibrariesPage() {
    const user = await getCurrentUser();
    if (!user) return redirectToLogin();
    const libraries = await listManagedLibraries(user.id);

    return (
        <main className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6 sm:py-10">
            <h1 className="font-heading text-[30px] leading-tight font-semibold text-primary">Perpustakaan Saya</h1>
            <p className="mt-1 text-sm text-muted-foreground">
                Perpustakaan yang Anda kelola di TemuBaca: catat buku di koleksinya agar pembaca tahu ke mana harus datang.
            </p>
            {libraries.length === 0 ? (
                <p className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Anda belum menjadi pengelola perpustakaan. Pengelola ditunjuk oleh admin TemuBaca.
                </p>
            ) : (
                <ul className="mt-6 flex list-none flex-col gap-3 p-0">
                    {libraries.map((library) => (
                        <li key={library.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                            <div>
                                <p className="font-semibold">{library.name}</p>
                                <p className="text-xs text-muted-foreground">{library.hiddenAt ? "Disembunyikan admin" : "Tampil di halaman Perpustakaan"}</p>
                            </div>
                            <Link href={`/libraries/${library.id}/manage`} className="flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Kelola</Link>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}
