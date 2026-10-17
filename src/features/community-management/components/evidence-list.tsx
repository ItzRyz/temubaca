import { FileText, Link2 } from "lucide-react";

import { getCommunityContacts, listCommunitySubmissions } from "@/lib/db/queries/community-management";

import { communityContactLinks } from "../contacts";
import { ReverificationReview } from "./team-panel";

const dateTime = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const statusText: Record<string, string> = { PENDING: "Menunggu", APPROVED: "Disetujui", REJECTED: "Tidak disetujui", REVOKED: "Dicabut" };

function formatSize(bytes: number | null) {
    if (!bytes) return "";
    return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Admin view of a community's evidence (DEC-04); files open through short-lived signed URLs. */
export async function CommunityEvidence({ communityId }: { communityId: string }) {
    const [community, submissions] = await Promise.all([getCommunityContacts(communityId), listCommunitySubmissions(communityId, 5)]);
    if (!community) return null;
    const contacts = communityContactLinks(community);

    return (
        <div className="flex flex-col gap-4 border-t border-border p-5 text-sm">
            <div>
                <h3 className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Kontak publik</h3>
                {contacts.length > 0 ? (
                    <ul className="mt-2 flex list-none flex-col gap-1 p-0">
                        {contacts.map((contact) => <li key={contact.kind}><span className="text-muted-foreground">{contact.label}:</span> {contact.value}</li>)}
                    </ul>
                ) : <p className="mt-2 text-muted-foreground">Belum diisi.</p>}
            </div>
            <div>
                <h3 className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Bukti aktivitas</h3>
                {submissions.length === 0 ? (
                    <p className="mt-2 text-muted-foreground">Tidak ada bukti tercatat (komunitas lama sebelum DEC-04).</p>
                ) : (
                    <ol className="mt-2 flex list-none flex-col gap-3 p-0">
                        {submissions.map((item) => (
                            <li key={item.id} className="rounded-lg border border-border p-3">
                                <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                    <span>{dateTime.format(item.createdAt)}</span>
                                    <span className="rounded-full bg-[#ebe9e1] px-2 py-0.5 font-semibold text-foreground">{statusText[item.status] ?? item.status}</span>
                                </p>
                                <a href={item.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-1.5 flex items-center gap-1.5 break-all text-primary hover:underline">
                                    <Link2 aria-hidden="true" className="size-3.5 shrink-0" /> {item.evidenceUrl}
                                </a>
                                {item.fileName && (
                                    <a href={`/api/communities/${community.id}/submissions/${item.id}/file`} className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                                        <FileText aria-hidden="true" className="size-3.5" /> {item.fileName} {item.fileSize ? `(${formatSize(item.fileSize)})` : ""}
                                    </a>
                                )}
                                {item.note && <p className="mt-1.5 text-xs whitespace-pre-line text-foreground/80">“{item.note}”</p>}
                                {item.reviewNote && <p className="mt-1.5 text-xs text-muted-foreground">Catatan peninjau: {item.reviewNote}</p>}
                                {item.status === "PENDING" && community.status === "VERIFIED" && (
                                    <>
                                        <p className="mt-2 text-xs text-muted-foreground">Pembaruan verifikasi: status komunitas tetap terverifikasi apa pun keputusannya.</p>
                                        <ReverificationReview submissionId={item.id} />
                                    </>
                                )}
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </div>
    );
}
