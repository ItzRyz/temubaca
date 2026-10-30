import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { accessActionBlocker, accessState, accessStateLabels, type AccessAction } from "@/features/libraries/access";
import { AccessActions } from "@/features/libraries/components/access-actions";
import { HoldingBadge } from "@/features/libraries/components/holding-badge";
import { HoldingForm } from "@/features/libraries/components/holding-form";
import { LibrarySettingsForm } from "@/features/libraries/components/library-settings-form";
import { RemoveHoldingButton } from "@/features/libraries/components/remove-holding-button";
import { getCurrentUser } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/login-redirect";
import { findLibrary, isLibraryManager, listAccessRequestsForLibrary, listHoldingsForLibrary } from "@/lib/db/queries/libraries";
import { cn } from "@/lib/utils";
import { libraryIdParamSchema } from "@/lib/validation/schemas/library.schema";
import { LIBRARY_ACCESS_REQUESTS_OPEN } from "@/features/libraries/access";

export const metadata: Metadata = { title: "Kelola perpustakaan" };
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ libraryId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const dateTime = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const allTabs = [["pengajuan", "Pengajuan"], ["koleksi", "Koleksi"], ["pengaturan", "Pengaturan"]] as const;
// Requests and their settings closed on 30 Okt 2026 (no library lending through TemuBaca); the collection stays.
const tabs = allTabs.filter(([value]) => LIBRARY_ACCESS_REQUESTS_OPEN || value === "koleksi");
const managerActions: AccessAction[] = ["approve", "reject", "collected"];

/** A library's manager answers access requests, keeps the collection, and sets the access rules (TB-023). */
export default async function ManageLibraryPage({ params, searchParams }: PageProps) {
    const user = await getCurrentUser();
    if (!user) return redirectToLogin();
    const parsed = libraryIdParamSchema.safeParse(await params);
    if (!parsed.success) notFound();
    const library = await findLibrary(parsed.data.libraryId, { includeHidden: true });
    if (!library || !(await isLibraryManager(user.id, library.id))) notFound();
    const query = await searchParams;
    const tab = tabs.find(([value]) => value === query.tab)?.[0] ?? tabs[0][0];
    const now = new Date();
    const [requests, holdings] = await Promise.all([
        tab === "pengajuan" ? listAccessRequestsForLibrary(library.id) : Promise.resolve([]),
        tab === "koleksi" ? listHoldingsForLibrary(library.id) : Promise.resolve([]),
    ]);

    return (
        <main className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6 sm:py-10">
            <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground"><Link href="/my-libraries" className="hover:underline">Perpustakaan Saya</Link> / {library.name}</nav>
            <h1 className="mt-3 font-heading text-[30px] leading-tight font-semibold text-primary">Kelola {library.name}</h1>
            {library.hiddenAt && <p className="mt-2 rounded-lg bg-[#fbecc4] px-3 py-2 text-sm text-[#5c3d00]">Perpustakaan ini sedang disembunyikan admin dan tidak tampil ke pembaca.</p>}
            <p className="mt-1 text-sm"><Link href={`/libraries/${library.id}`} className="font-semibold text-primary hover:underline">Lihat halaman publik</Link></p>

            {tabs.length > 1 && <nav aria-label="Bagian kelola" className="mt-6 flex w-fit gap-1 rounded-xl border border-border bg-[#f1f0ea] p-1">
                {tabs.map(([value, label]) => (
                    <Link key={value} href={value === tabs[0][0] ? `/libraries/${library.id}/manage` : `/libraries/${library.id}/manage?tab=${value}`} aria-current={tab === value ? "page" : undefined}
                        className={cn("rounded-lg px-4 py-2 text-sm", tab === value ? "bg-card font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                        {label}
                    </Link>
                ))}
            </nav>}

            {tab === "pengajuan" && (
                requests.length === 0 ? (
                    <p className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                        {library.accessEnabled ? "Belum ada pengajuan." : "Belum ada pengajuan. Aktifkan penerimaan pengajuan di tab Pengaturan."}
                    </p>
                ) : (
                    <ul className="mt-6 flex list-none flex-col gap-3 p-0">
                        {requests.map((request) => {
                            const state = accessState(request, now);
                            const actions = managerActions.filter((action) => accessActionBlocker(request, "manager", action, now) === null);
                            return (
                                <li key={request.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:justify-between">
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-muted-foreground">{accessStateLabels[state]} · diajukan {dateTime.format(request.createdAt)}</p>
                                        <p className="mt-1 font-semibold">{request.book.title}</p>
                                        <p className="text-sm text-muted-foreground">oleh {request.requesterName}</p>
                                        {request.message && <p className="mt-2 rounded-lg bg-[#f1efe6] px-3 py-2 text-sm italic">“{request.message}”</p>}
                                        {request.expiresAt && (state === "APPROVED" || state === "EXPIRED") && <p className="mt-1 text-xs text-muted-foreground">Batas ambil {dateTime.format(request.expiresAt)}</p>}
                                        {request.responseNote && <p className="mt-1 text-xs text-muted-foreground">Catatan Anda: {request.responseNote}</p>}
                                    </div>
                                    <AccessActions accessId={request.id} actions={actions} />
                                </li>
                            );
                        })}
                    </ul>
                )
            )}

            {tab === "koleksi" && (
                <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <section aria-labelledby="add-title" className="h-fit rounded-xl border border-border bg-card p-5">
                        <h2 id="add-title" className="font-heading text-lg font-semibold">Catat buku</h2>
                        <div className="mt-3"><HoldingForm endpoint={`/api/libraries/${library.id}/holdings`} kind="manager" /></div>
                    </section>
                    <section aria-labelledby="list-title">
                        <h2 id="list-title" className="font-heading text-lg font-semibold">Koleksi ({holdings.length})</h2>
                        <ul className="mt-3 flex list-none flex-col gap-3 p-0">
                            {holdings.map((holding) => (
                                <li key={`${holding.bookId}-${holding.source}`} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4">
                                    <div className="min-w-0">
                                        <p className="font-semibold">{holding.book.title}</p>
                                        <p className="text-sm text-muted-foreground">{holding.copiesTotal !== null ? `${holding.copiesAvailable ?? "?"} dari ${holding.copiesTotal} eksemplar · ` : ""}{holding.callNumber ?? ""}</p>
                                        <div className="mt-1"><HoldingBadge holding={holding} now={now} /></div>
                                    </div>
                                    {holding.source === "MANAGER" && <RemoveHoldingButton endpoint={`/api/libraries/${library.id}/holdings`} bookId={holding.bookId} bookTitle={holding.book.title} />}
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>
            )}

            {tab === "pengaturan" && (
                <section className="mt-6 max-w-2xl rounded-xl border border-border bg-card p-5">
                    <LibrarySettingsForm libraryId={library.id} initial={{ accessEnabled: library.accessEnabled, accessRules: library.accessRules, pickupDays: library.pickupDays }} />
                </section>
            )}
        </main>
    );
}
