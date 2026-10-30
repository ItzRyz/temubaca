import type { Metadata } from "next";

import { LoansPanel, type LoanFilter } from "@/features/borrowing/components/loans-panel";
import { loadManageContext } from "@/features/community-management/server";
import { listLoansForCommunity } from "@/lib/db/queries/borrowing";

export const metadata: Metadata = { title: "Peminjaman koleksi komunitas" };

const loanFilters: LoanFilter[] = ["all", "action", "ongoing", "history"];

/** Requests and loans of the community's collection (30 Okt 2026); any manager answers them for the community. */
export default async function ManageLoansPage({ params, searchParams }: PageProps<"/communities/[communityId]/manage/loans">) {
    const { communityId } = await params;
    const { can, user } = await loadManageContext(communityId);
    if (!can.manageContent) {
        return <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Peminjaman tersedia setelah komunitas terverifikasi.</p>;
    }
    const query = await searchParams;
    const filter = loanFilters.find((value) => value === query.filter) ?? "all";
    const q = (typeof query.q === "string" ? query.q : "").trim().slice(0, 100);
    const now = new Date();
    const loans = await listLoansForCommunity(communityId, user.id, now);

    return (
        <section aria-labelledby="loans-title">
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <h2 id="loans-title" className="font-heading text-xl font-semibold">Peminjaman Koleksi</h2>
                <p className="mt-1 text-sm text-muted-foreground">Permintaan pinjam untuk buku komunitas. Setujui, atur serah terima di titik temu publik, dan konfirmasi pengembalian atas nama komunitas.</p>
            </div>
            <LoansPanel loans={loans} view="pinjamkan" filter={filter} query={q} now={now} basePath={`/communities/${communityId}/manage/loans`} />
        </section>
    );
}
