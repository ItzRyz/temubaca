import { CircleCheck, Clock, FileText, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CommunityProfileForm, VerificationRequestForm } from "@/features/community-management/components/community-forms";
import { CommunityBannerForm, CommunityLogoForm } from "@/features/community-management/components/community-logo-form";
import { loadManageContext } from "@/features/community-management/server";
import { CommunityPlaceForm } from "@/features/places/components/community-place-form";
import { listCommunitySubmissions } from "@/lib/db/queries/community-management";
import { findCommunityPlace } from "@/lib/db/queries/places";
import { lastCommunityApproval, listCommunityVerifications } from "@/lib/db/queries/verifications";
import { MapTilesFromSettings } from "@/features/places/components/map-tiles-from-settings";

export const metadata: Metadata = { title: "Kelola komunitas" };

const monthYear = new Intl.DateTimeFormat("id-ID", { month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const dateTime = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const submissionStatus: Record<string, string> = { PENDING: "Menunggu ditinjau", APPROVED: "Disetujui", REJECTED: "Tidak disetujui", REVOKED: "Dicabut" };

/** Profil Komunitas + Status Verifikasi (owner). Managers start on the events list. */
export default async function ManageCommunityProfilePage({ params, searchParams }: PageProps<"/communities/[communityId]/manage">) {
    const { communityId } = await params;
    const { community, role, status, can } = await loadManageContext(communityId);
    if (role !== "owner") redirect(`/communities/${communityId}/manage/events`);
    const justApplied = (await searchParams).baru === "1";

    const [submissions, approval, history, place] = await Promise.all([
        listCommunitySubmissions(communityId),
        lastCommunityApproval(communityId),
        listCommunityVerifications(communityId, 5),
        findCommunityPlace(communityId),
    ]);
    const pendingSubmission = submissions.find((item) => item.status === "PENDING");
    const lastDecision = history[0];

    return (
        <div className="flex flex-col gap-6">
            {justApplied && (
                <p role="status" className="flex gap-3 rounded-xl bg-[#e7efe8] p-4 text-sm">
                    <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                    {status === "VERIFIED" ? (
                        <span><span className="block font-semibold">Komunitas terdaftar</span>Profil langsung tampil untuk umum. Anda bisa mulai menambah acara, merchandise, dan koleksi buku.</span>
                    ) : (
                        <span><span className="block font-semibold">Pengajuan terkirim</span>Tim TemuBaca akan meninjau bukti aktivitas. Profil belum tampil untuk umum sampai disetujui; Anda tetap bisa merapikannya di sini.</span>
                    )}
                </p>
            )}

            {can.editProfile && (
                <div className="grid gap-6 lg:grid-cols-2">
                    <CommunityLogoForm community={{ id: community.id, name: community.name, logoPath: community.logoPath }} />
                    <CommunityBannerForm community={{ id: community.id, bannerPath: community.bannerPath }} />
                </div>
            )}

            {can.editProfile ? (
                <CommunityProfileForm
                    communityId={communityId}
                    initial={{
                        name: community.name,
                        description: community.description ?? "",
                        regionCode: community.regionCode ?? "",
                        publicLocation: community.publicLocation ?? "",
                        interests: community.interests ?? [],
                        contactEmail: community.contactEmail ?? "",
                        instagramHandle: community.instagramHandle ?? "",
                        whatsappNumber: community.whatsappNumber ? `0${community.whatsappNumber.replace(/^\+62/, "")}` : "",
                    }}
                />
            ) : (
                <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Profil komunitas yang ditangguhkan tidak dapat diubah.</p>
            )}

            {can.editProfile && (
                <MapTilesFromSettings>
                    <CommunityPlaceForm
                        communityId={communityId}
                        verified={status === "VERIFIED"}
                        saved={place ? { ...place, hidden: Boolean(place.hiddenAt) } : null}
                    />
                </MapTilesFromSettings>
            )}

            <section aria-labelledby="verification-title" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <h2 id="verification-title" className="font-heading text-xl font-semibold text-primary">Status Verifikasi</h2>
                <p className="mt-1 text-sm text-muted-foreground">Verifikasi berarti profil komunitas telah ditinjau pengelola TemuBaca. Ini bukan jaminan atas seluruh kegiatan komunitas.</p>

                <div className="mt-5 flex gap-4 rounded-xl bg-[#e7efe8] p-4">
                    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary">
                        {status === "VERIFIED" ? <ShieldCheck className="size-5" /> : status === "PENDING" ? <Clock className="size-5" /> : <ShieldAlert className="size-5 text-destructive" />}
                    </span>
                    <div className="text-sm">
                        {status === "VERIFIED" && (
                            <>
                                <p className="font-heading text-base font-semibold">Komunitas terverifikasi</p>
                                <p className="text-muted-foreground">Aktif sejak {approval ? monthYear.format(approval) : "-"}. Ajukan pembaruan bila ada perubahan pengurus atau titik temu.</p>
                            </>
                        )}
                        {status === "PENDING" && (
                            <>
                                <p className="font-heading text-base font-semibold">Menunggu peninjauan</p>
                                <p className="text-muted-foreground">Diajukan {submissions[0] ? dateTime.format(submissions[0].createdAt) : ""}. Acara, merchandise, dan pengurus bisa diatur setelah disetujui.</p>
                            </>
                        )}
                        {status === "REJECTED" && (
                            <>
                                <p className="font-heading text-base font-semibold">Pengajuan belum disetujui</p>
                                <p className="text-muted-foreground">{lastDecision?.note ? `Catatan peninjau: ${lastDecision.note}` : "Peninjau tidak menuliskan catatan."} Perbaiki profil atau bukti, lalu ajukan ulang.</p>
                            </>
                        )}
                        {status === "SUSPENDED" && (
                            <>
                                <p className="font-heading text-base font-semibold">Komunitas ditangguhkan</p>
                                <p className="text-muted-foreground">{lastDecision?.note ? `Alasan: ${lastDecision.note}` : "Hubungi admin TemuBaca untuk informasi lebih lanjut."} Profil, acara, dan merchandise tidak tampil untuk umum.</p>
                            </>
                        )}
                    </div>
                </div>

                {submissions.length > 0 && (
                    <div className="mt-5">
                        <h3 className="text-sm font-semibold">Riwayat pengajuan</h3>
                        <ul className="mt-2 flex list-none flex-col divide-y divide-border rounded-xl border border-border p-0 text-sm">
                            {submissions.map((item) => (
                                <li key={item.id} className="flex flex-col gap-1 px-4 py-3">
                                    <p className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="font-medium">{dateTime.format(item.createdAt)}</span>
                                        <span className="rounded-full bg-[#ebe9e1] px-2 py-0.5 text-xs font-semibold">{submissionStatus[item.status] ?? item.status}</span>
                                    </p>
                                    <a href={item.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow" className="truncate text-primary hover:underline">{item.evidenceUrl}</a>
                                    {item.fileName && (
                                        <a href={`/api/communities/${communityId}/submissions/${item.id}/file`} className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                                            <FileText aria-hidden="true" className="size-3.5" /> {item.fileName}
                                        </a>
                                    )}
                                    {item.reviewNote && <p className="text-xs text-muted-foreground">Catatan peninjau: {item.reviewNote}</p>}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {can.submitVerification && !pendingSubmission && <div className="mt-5"><VerificationRequestForm communityId={communityId} mode={status === "REJECTED" ? "retry" : "renew"} /></div>}
                {status === "VERIFIED" && pendingSubmission && (
                    <p className="mt-5 text-sm text-muted-foreground">Pembaruan verifikasi sedang ditinjau. Status Anda tetap terverifikasi selama ditinjau.</p>
                )}
            </section>
        </div>
    );
}
