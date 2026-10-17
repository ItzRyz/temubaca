"use client";

import { Archive, Copy, MoreVertical, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { sendCommunityRequest } from "../client";

type MenuItem = { label: string; icon: typeof Archive; danger?: boolean; confirm?: string; run: () => Promise<{ ok: boolean; message?: string }> };

/** The "⋮" menu on event and merchandise rows. Destructive items ask once before running. */
function RowMenu({ label, items }: { label: string; items: MenuItem[] }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [confirming, setConfirming] = useState<MenuItem | null>(null);
    const [error, setError] = useState("");
    const [pending, startTransition] = useTransition();
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const close = (event: MouseEvent | KeyboardEvent) => {
            if (event instanceof KeyboardEvent ? event.key === "Escape" : !rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
                setConfirming(null);
            }
        };
        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", close);
        return () => {
            document.removeEventListener("mousedown", close);
            document.removeEventListener("keydown", close);
        };
    }, [open]);

    function run(item: MenuItem) {
        if (item.confirm && confirming !== item) return setConfirming(item);
        setError("");
        startTransition(async () => {
            const result = await item.run();
            if (!result.ok) return setError(result.message ?? "Tindakan gagal.");
            setOpen(false);
            setConfirming(null);
            router.refresh();
        });
    }

    return (
        <div ref={rootRef} className="relative">
            <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}
                className="flex size-10 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted">
                <MoreVertical aria-hidden="true" className="size-4" />
            </button>
            {open && (
                <div role="menu" className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-border bg-card p-1 shadow-lg">
                    {items.map((item) => (
                        <button key={item.label} type="button" role="menuitem" disabled={pending} onClick={() => run(item)}
                            className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-muted disabled:opacity-60 ${item.danger ? "text-destructive" : ""}`}>
                            <item.icon aria-hidden="true" className="size-4" /> {confirming === item ? item.confirm : item.label}
                        </button>
                    ))}
                    {error && <p role="alert" className="px-3 py-2 text-xs text-destructive">{error}</p>}
                </div>
            )}
        </div>
    );
}

const call = async (url: string, method: "POST" | "DELETE", body?: unknown) => {
    const result = await sendCommunityRequest(url, method, body);
    return result.ok ? { ok: true } : { ok: false, message: result.message };
};

export function EventRowMenu({ communityId, eventId, title, isDraft, isArchived }: { communityId: string; eventId: string; title: string; isDraft: boolean; isArchived: boolean }) {
    const url = `/api/communities/${communityId}/events/${eventId}`;
    const items: MenuItem[] = [{ label: "Duplikat sebagai draf", icon: Copy, run: () => call(url, "POST", { action: "duplicate" }) }];
    if (!isDraft && !isArchived) items.push({ label: "Arsipkan", icon: Archive, confirm: "Ya, arsipkan dari publik", run: () => call(url, "POST", { action: "archive" }) });
    if (isDraft) items.push({ label: "Hapus draf", icon: Trash2, danger: true, confirm: "Ya, hapus permanen", run: () => call(url, "DELETE") });
    return <RowMenu label={`Tindakan lain untuk ${title}`} items={items} />;
}

export function MerchandiseRowMenu({ communityId, itemId, title }: { communityId: string; itemId: string; title: string }) {
    const items: MenuItem[] = [{ label: "Hapus", icon: Trash2, danger: true, confirm: "Ya, hapus permanen", run: () => call(`/api/communities/${communityId}/merchandise/${itemId}`, "DELETE") }];
    return <RowMenu label={`Tindakan lain untuk ${title}`} items={items} />;
}

/** "Duplikat" button shown on finished events (Figma 293:2321). */
export function DuplicateEventButton({ communityId, eventId }: { communityId: string; eventId: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    return (
        <button type="button" disabled={pending} onClick={() => startTransition(async () => {
            const result = await sendCommunityRequest<{ id: string }>(`/api/communities/${communityId}/events/${eventId}`, "POST", { action: "duplicate" });
            if (result.ok) router.push(`/communities/${communityId}/manage/events/${result.data.id}`);
        })} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:bg-muted disabled:opacity-60">
            <Copy aria-hidden="true" className="size-4" /> Duplikat
        </button>
    );
}
