"use client";

import { Check, PauseCircle, RotateCcw, X, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

import { decisionRequiresNote, type CommunityReviewDecision } from "../community-review";

const decisionUi: Record<CommunityReviewDecision, { label: string; icon: LucideIcon; tone: "primary" | "danger" }> = {
    APPROVE: { label: "Setujui Verifikasi", icon: Check, tone: "primary" },
    REJECT: { label: "Tolak", icon: X, tone: "danger" },
    SUSPEND: { label: "Tangguhkan", icon: PauseCircle, tone: "danger" },
    REINSTATE: { label: "Pulihkan Verifikasi", icon: RotateCcw, tone: "primary" },
};

const reviewQueueHref = "/moderation/reports?tab=communities&view={status}&item={id}";

/**
 * Approve / reject / suspend / reinstate a community; the server re-validates the transition.
 * `nextHref` is where to go afterwards: `{status}` and `{id}` are filled in so the item stays selected.
 */
export function CommunityDecisionPanel({ communityId, decisions, nextHref = reviewQueueHref }: {
    communityId: string;
    decisions: CommunityReviewDecision[];
    nextHref?: string;
}) {
    const router = useRouter();
    const noteId = useId();
    const [note, setNote] = useState("");
    const [pending, setPending] = useState<CommunityReviewDecision | null>(null);
    const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

    if (decisions.length === 0) return null;
    const noteRequired = decisions.some(decisionRequiresNote);

    async function decide(decision: CommunityReviewDecision) {
        if (decisionRequiresNote(decision) && note.trim().length < 3) {
            setMessage({ tone: "error", text: "Alasan wajib diisi untuk menolak atau menangguhkan komunitas." });
            return;
        }
        setPending(decision);
        setMessage(null);
        try {
            const response = await fetch(`/api/admin/communities/${communityId}/review`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ decision, note: note.trim() || undefined }),
            });
            const payload = await response.json() as { success?: boolean; data?: { status: string }; error?: { message?: string } };
            if (!response.ok || !payload.success) {
                setMessage({ tone: "error", text: payload.error?.message ?? "Keputusan belum dapat disimpan." });
                return;
            }
            setMessage({ tone: "ok", text: "Keputusan disimpan dan dicatat di jejak audit." });
            setNote("");
            // The community now belongs to another status filter; follow it so the result stays visible.
            const nextStatus = payload.data?.status;
            if (nextStatus) router.replace(nextHref.replace("{status}", nextStatus).replace("{id}", communityId), { scroll: false });
            else router.refresh();
        } catch {
            setMessage({ tone: "error", text: "Keputusan belum dapat disimpan. Periksa koneksi lalu coba lagi." });
        } finally {
            setPending(null);
        }
    }

    return (
        <div className="flex flex-col gap-3 bg-[#f1f0ea] p-5">
            <label htmlFor={noteId} className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Catatan keputusan</label>
            <textarea
                id={noteId}
                rows={3}
                maxLength={2000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={noteRequired ? "Wajib diisi jika menolak atau menangguhkan." : "Opsional."}
                className="rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            {message && (
                <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "rounded bg-destructive/10 px-3 py-2 text-sm text-destructive" : "text-sm text-primary"}>
                    {message.text}
                </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
                {decisions.map((decision) => {
                    const { label, icon: Icon, tone } = decisionUi[decision];
                    return (
                        <button
                            key={decision}
                            type="button"
                            onClick={() => decide(decision)}
                            disabled={pending !== null}
                            className={cn(
                                "flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold disabled:opacity-60",
                                tone === "primary" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-destructive bg-card text-destructive hover:bg-destructive/5",
                            )}
                        >
                            <Icon aria-hidden="true" className="size-4" /> {pending === decision ? "Menyimpan…" : label}
                        </button>
                    );
                })}
            </div>
            <p className="text-xs text-muted-foreground">Keputusan tercatat di jejak audit beserta nama peninjau dan waktunya.</p>
        </div>
    );
}
