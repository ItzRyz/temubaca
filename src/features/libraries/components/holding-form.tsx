"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";

import { Field, FormAlert, Select, TextInput } from "@/components/ui/form";
import { sendLoanRequest } from "@/features/borrowing/client";

type FoundBook = { id: string; title: string; authors: string[] };

const statusOptions = {
    manager: [["AVAILABLE", "Tersedia"], ["ON_LOAN", "Sedang dipinjam"], ["LISTED", "Tercatat di koleksi (status tidak dipantau)"]],
    curated: [["LISTED", "Tercatat di koleksi"], ["UNKNOWN", "Status tidak diketahui"]],
} as const;

/**
 * Records a book in a library's collection. A manager may say a copy is available or on loan; admin
 * curation only says the library holds it, with the official catalog record as proof (DEC-13).
 */
export function HoldingForm({ endpoint, kind }: { endpoint: string; kind: "manager" | "curated" }) {
    const router = useRouter();
    const ids = { search: useId() };
    const [pending, startTransition] = useTransition();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<FoundBook[] | null>(null);
    const [book, setBook] = useState<FoundBook | null>(null);
    const [status, setStatus] = useState<string>(statusOptions[kind][0][0]);
    const [copiesTotal, setCopiesTotal] = useState("");
    const [copiesAvailable, setCopiesAvailable] = useState("");
    const [callNumber, setCallNumber] = useState("");
    const [sourceUrl, setSourceUrl] = useState("");
    const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

    async function search() {
        if (query.trim().length < 2) return setMessage({ tone: "error", text: "Ketik minimal 2 huruf judul atau ISBN." });
        setMessage(null);
        const response = await fetch(`/api/books/search?q=${encodeURIComponent(query.trim())}&limit=8`).catch(() => null);
        const payload = await response?.json().catch(() => null) as { data?: FoundBook[] } | null;
        if (!response?.ok || !payload?.data) return setMessage({ tone: "error", text: "Pencarian belum berhasil. Coba lagi." });
        setResults(payload.data);
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        if (!book) return setMessage({ tone: "error", text: "Pilih buku dari hasil pencarian." });
        startTransition(async () => {
            const result = await sendLoanRequest(endpoint, "PUT", { bookId: book.id, status, copiesTotal, copiesAvailable, callNumber, sourceUrl });
            if (!result.ok) return setMessage({ tone: "error", text: result.message });
            setMessage({ tone: "ok", text: `${book.title} dicatat.` });
            setBook(null);
            setResults(null);
            setQuery("");
            setSourceUrl("");
            router.refresh();
        });
    }

    return (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
                <label htmlFor={ids.search} className="text-sm font-medium">Cari buku di katalog TemuBaca</label>
                <div className="flex gap-2">
                    <input id={ids.search} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }}
                        maxLength={200} placeholder="Judul, penulis, atau ISBN" className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                    <button type="button" onClick={() => void search()} className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/5">
                        <Search aria-hidden="true" className="size-4" /> Cari
                    </button>
                </div>
                {results && (results.length ? (
                    <ul aria-label="Hasil pencarian buku" className="flex list-none flex-col overflow-hidden rounded-lg border border-border p-0">
                        {results.map((item) => (
                            <li key={item.id} className="border-b border-border last:border-b-0">
                                <button type="button" onClick={() => { setBook(item); setResults(null); }} aria-pressed={book?.id === item.id}
                                    className="flex min-h-11 w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted">
                                    <span className="font-medium">{item.title}</span>
                                    <span className="text-xs text-muted-foreground">{item.authors.join(", ")}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-sm text-muted-foreground">Buku tidak ditemukan. Tambahkan dulu lewat katalog.</p>)}
                {book && <p className="text-sm">Dipilih: <strong>{book.title}</strong></p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Status">
                    {(control) => (
                        <Select {...control} value={status} onChange={(event) => setStatus(event.target.value)}>
                            {statusOptions[kind].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </Select>
                    )}
                </Field>
                <Field label={<>Nomor panggil <span className="font-normal text-muted-foreground">(opsional)</span></>}>
                    {(control) => <TextInput {...control} value={callNumber} maxLength={60} onChange={(event) => setCallNumber(event.target.value)} placeholder="mis. 899.221 HIR l" />}
                </Field>
                <Field label={kind === "curated" ? "Tautan rekaman di katalog resmi" : <>Tautan katalog <span className="font-normal text-muted-foreground">(opsional)</span></>}
                    required={kind === "curated"} className="sm:col-span-2"
                    hint={kind === "curated" ? "Bukti bahwa buku ini memang tercatat di katalog perpustakaan, mis. halaman rekaman JAKLITERA." : undefined}>
                    {(control) => <TextInput {...control} type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} />}
                </Field>
                {kind === "manager" && (
                    <>
                        <Field label={<>Jumlah eksemplar <span className="font-normal text-muted-foreground">(opsional)</span></>}>
                            {(control) => <TextInput {...control} inputMode="numeric" value={copiesTotal} onChange={(event) => setCopiesTotal(event.target.value.replace(/\D/g, ""))} />}
                        </Field>
                        <Field label={<>Eksemplar tersedia <span className="font-normal text-muted-foreground">(opsional)</span></>}>
                            {(control) => <TextInput {...control} inputMode="numeric" value={copiesAvailable} onChange={(event) => setCopiesAvailable(event.target.value.replace(/\D/g, ""))} />}
                        </Field>
                    </>
                )}
            </div>
            {kind === "manager" && <p className="text-xs text-muted-foreground">Status &quot;Tersedia&quot; dan &quot;Sedang dipinjam&quot; tampil ke pembaca selama 24 jam sejak disimpan; setelah itu tampil &quot;status belum diperbarui&quot;.</p>}
            {message && <FormAlert tone={message.tone === "ok" ? "success" : undefined}>{message.text}</FormAlert>}
            <button type="submit" disabled={pending} className="min-h-11 self-end rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {pending ? "Menyimpan..." : "Simpan ke Koleksi"}
            </button>
        </form>
    );
}
