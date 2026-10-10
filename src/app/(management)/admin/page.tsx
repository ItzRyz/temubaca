import Link from "next/link";

import { countReportsByStatus } from "@/lib/db/queries/reports";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
    const [pending, reviewing] = await Promise.all([
        countReportsByStatus("PENDING"),
        countReportsByStatus("REVIEWING"),
    ]);

    return (
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12 sm:px-8 sm:py-16">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Pengelolaan platform</p>
            <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">Admin TemuBaca</h1>
            <p className="mt-3 text-sm text-muted-foreground">Ringkasan antrean yang memerlukan tinjauan manusia.</p>
            <section aria-label="Ringkasan laporan" className="mt-8 grid gap-4 sm:grid-cols-2">
                <article className="rounded-2xl border border-border/70 bg-card p-6">
                    <p className="text-sm font-medium text-muted-foreground">Laporan menunggu</p>
                    <p className="mt-2 font-heading text-3xl font-semibold">{pending}</p>
                </article>
                <article className="rounded-2xl border border-border/70 bg-card p-6">
                    <p className="text-sm font-medium text-muted-foreground">Laporan sedang ditinjau</p>
                    <p className="mt-2 font-heading text-3xl font-semibold">{reviewing}</p>
                </article>
            </section>
            <Link href="/moderation/reports" className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Buka antrean laporan</Link>
        </main>
    );
}
