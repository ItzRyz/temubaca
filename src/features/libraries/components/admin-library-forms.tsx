"use client";

import { UserMinus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Field, FormAlert, Select, Switch, TextInput } from "@/components/ui/form";
import { sendLoanRequest } from "@/features/borrowing/client";

const primary = "min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60";

/** Turns a library on the Peta Literasi into a TemuBaca library. */
export function CreateLibraryForm({ places }: { places: { id: string; name: string }[] }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [placeId, setPlaceId] = useState("");
    const [error, setError] = useState("");
    if (places.length === 0) return <p className="text-sm text-muted-foreground">Semua perpustakaan di Peta Literasi sudah terdaftar. Tambahkan tempat baru lewat Data Tempat.</p>;
    return (
        <form noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => {
            event.preventDefault();
            if (!placeId) return setError("Pilih perpustakaan.");
            startTransition(async () => {
                const result = await sendLoanRequest("/api/admin/libraries", "POST", { placeId });
                if (!result.ok) return setError(result.message);
                setPlaceId("");
                setError("");
                router.refresh();
            });
        }}>
            <Field label="Perpustakaan di Peta Literasi" className="flex-1">
                {(control) => (
                    <Select {...control} value={placeId} onChange={(event) => setPlaceId(event.target.value)}>
                        <option value="">Pilih tempat</option>
                        {places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
                    </Select>
                )}
            </Field>
            <button type="submit" disabled={pending} className={primary}>{pending ? "Menyimpan..." : "Jadikan Perpustakaan"}</button>
            <FormAlert>{error}</FormAlert>
        </form>
    );
}

type EditableLibrary = { id: string; name: string; publicLocation: string | null; regionCode: string | null; catalogUrl: string | null; websiteUrl: string | null; hiddenAt: Date | null };

/** Admin edit of a library's details and visibility. */
export function LibraryEditForm({ library }: { library: EditableLibrary }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [values, setValues] = useState({
        name: library.name, publicLocation: library.publicLocation ?? "", regionCode: library.regionCode ?? "", catalogUrl: library.catalogUrl ?? "",
        websiteUrl: library.websiteUrl ?? "", hidden: Boolean(library.hiddenAt),
    });
    const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
    const set = (key: keyof typeof values) => (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value }));

    function submit(event: FormEvent) {
        event.preventDefault();
        startTransition(async () => {
            const result = await sendLoanRequest(`/api/admin/libraries/${library.id}`, "PATCH", values);
            setMessage(result.ok ? { tone: "success", text: "Perpustakaan disimpan dan tercatat di jejak audit." } : { tone: "error", text: result.message });
            if (result.ok) router.refresh();
        });
    }

    return (
        <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-2">
            <Field label="Nama" required>{(control) => <TextInput {...control} value={values.name} maxLength={120} onChange={set("name")} />}</Field>
            <Field label="Alamat publik">{(control) => <TextInput {...control} value={values.publicLocation} maxLength={200} onChange={set("publicLocation")} />}</Field>
            <Field label="Kode kab/kota" hint="Format NN.NN, mis. 31.71.">{(control) => <TextInput {...control} value={values.regionCode} maxLength={5} onChange={set("regionCode")} />}</Field>
            <Field label="Tautan katalog resmi">{(control) => <TextInput {...control} type="url" value={values.catalogUrl} onChange={set("catalogUrl")} />}</Field>
            <Field label="Situs web">{(control) => <TextInput {...control} type="url" value={values.websiteUrl} onChange={set("websiteUrl")} />}</Field>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm sm:col-span-2">
                <span>Sembunyikan dari pembaca</span>
                <Switch checked={values.hidden} onCheckedChange={(hidden) => setValues((current) => ({ ...current, hidden }))} aria-label="Sembunyikan dari pembaca" />
            </label>
            <FormAlert tone={message?.tone} className="sm:col-span-2">{message?.text}</FormAlert>
            <button type="submit" disabled={pending} className={`${primary} justify-self-end sm:col-span-2`}>{pending ? "Menyimpan..." : "Simpan"}</button>
        </form>
    );
}

/** Appoint a manager by display name, or remove one. Emails are never shown here. */
export function LibraryManagersForm({ libraryId, managers }: { libraryId: string; managers: { userId: string; displayName: string }[] }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [query, setQuery] = useState("");
    const [found, setFound] = useState<{ id: string; displayName: string }[] | null>(null);
    const [error, setError] = useState("");
    const endpoint = `/api/admin/libraries/${libraryId}/managers`;

    async function search() {
        setError("");
        const response = await fetch(`/api/admin/libraries/accounts?q=${encodeURIComponent(query.trim())}`).catch(() => null);
        const payload = await response?.json().catch(() => null) as { data?: { id: string; displayName: string }[]; error?: { message?: string } } | null;
        if (!response?.ok || !payload?.data) return setError(payload?.error?.message ?? "Ketik minimal 2 huruf nama akun.");
        setFound(payload.data);
    }
    const change = (method: "POST" | "DELETE", userId: string) => startTransition(async () => {
        const result = await sendLoanRequest(endpoint, method, { userId });
        if (!result.ok) return setError(result.message);
        setFound(null);
        setQuery("");
        router.refresh();
    });

    return (
        <div className="flex flex-col gap-3">
            <ul className="flex list-none flex-col gap-2 p-0">
                {managers.length === 0 && <li className="text-sm text-muted-foreground">Belum ada pengelola.</li>}
                {managers.map((manager) => (
                    <li key={manager.userId} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                        {manager.displayName}
                        <button type="button" disabled={pending} onClick={() => change("DELETE", manager.userId)} className="flex min-h-9 items-center gap-1 rounded-md border border-border px-2 text-xs font-semibold hover:bg-muted">
                            <UserMinus aria-hidden="true" className="size-3.5" /> Cabut
                        </button>
                    </li>
                ))}
            </ul>
            <div className="flex gap-2">
                <TextInput aria-label="Cari nama akun" value={query} maxLength={80} onChange={(event) => setQuery(event.target.value)} placeholder="Nama tampilan akun" className="min-w-0 flex-1" />
                <button type="button" onClick={() => void search()} className="h-11 shrink-0 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/5">Cari</button>
            </div>
            {found && (found.length ? (
                <ul aria-label="Akun ditemukan" className="flex list-none flex-col gap-1 p-0">
                    {found.map((account) => (
                        <li key={account.id}>
                            <button type="button" disabled={pending} onClick={() => change("POST", account.id)} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-muted">
                                <UserPlus aria-hidden="true" className="size-4 text-primary" /> Tunjuk {account.displayName}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : <p className="text-sm text-muted-foreground">Akun tidak ditemukan.</p>)}
            <FormAlert>{error}</FormAlert>
        </div>
    );
}
