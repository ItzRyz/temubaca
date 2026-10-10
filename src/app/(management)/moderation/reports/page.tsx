import { ReportReviewCard } from "@/features/reports/components/report-review-card";
import { listReports } from "@/lib/db/queries/reports";

export const dynamic = "force-dynamic";

export default async function ModerationReportsPage() {
    const { items } = await listReports({ limit: 100, offset: 0 });
    return (
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12 sm:px-8 sm:py-16">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Pengelolaan platform</p>
            <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">Tinjauan laporan</h1>
            <p className="mt-3 text-sm text-muted-foreground">Informasi laporan dan catatan hasil hanya tersedia bagi admin.</p>
            {items.length ? <ul className="mt-8 grid list-none gap-4 p-0">{items.map((report) => <ReportReviewCard key={report.id} report={report} />)}</ul> : <p className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Belum ada laporan.</p>}
        </main>
    );
}
