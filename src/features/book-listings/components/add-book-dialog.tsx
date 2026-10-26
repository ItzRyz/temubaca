"use client";

import { ArrowLeft, BookOpen, Check, Info, MapPin, Plus, Search, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { ChoiceOption, Field, FormAlert, Select, Switch, TextInput } from "@/components/ui/form";
import { regionByCode } from "@/features/regions/regions";
import { cn } from "@/lib/utils";

import { addMeetingPoint, composeListingDetails, conditionChoices, loanDayOptions, MAX_MEETING_POINTS } from "../listing-draft";

type LocalBook = { id: string; title: string; authors: string[]; publishedAt: string | null; publisher: string | null };
type ExternalBook = { provider: "OPEN_LIBRARY" | "GOOGLE_BOOKS"; providerId: string; title: string; authors: string[]; publishedAt?: string; publisher?: string; localBookId: string | null };
type Choice =
    | { kind: "local"; bookId: string; title: string }
    | { kind: "external"; provider: ExternalBook["provider"]; providerId: string; title: string };

const genres = ["Fiksi Sastra", "Fiksi Sejarah", "Puisi", "Nonfiksi", "Filsafat", "Biografi", "Anak & Remaja", "Agama & Spiritualitas", "Komik & Novel Grafis", "Lainnya"];
const providerNames = { OPEN_LIBRARY: "Open Library", GOOGLE_BOOKS: "Google Books" } as const;

async function postJson<T>(url: string, body: unknown) {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => null) as { data?: T; error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } } } | null;
    return { ok: response.ok, status: response.status, data: payload?.data, error: payload?.error };
}

/** Figma "Tambah Buku" (152:807) and its manual variant (159:833): pick or enter a book, then listing details. */
type PlaceSuggestion = { id: string; name: string; regionCode: string | null };

export function AddBookDialog() {
    const router = useRouter();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const pointInputId = useId();
    const [step, setStep] = useState<1 | 2>(1);
    const [manual, setManual] = useState(false);

    const [query, setQuery] = useState("");
    const [searching, setSearching] = useState(false);
    const [localResults, setLocalResults] = useState<LocalBook[]>([]);
    const [externalResults, setExternalResults] = useState<ExternalBook[]>([]);
    const [choice, setChoice] = useState<Choice | null>(null);

    const [manualBook, setManualBook] = useState({ title: "", author: "", publishedAt: "", publisher: "", isbn: "", category: "" });
    const [manualErrors, setManualErrors] = useState<Record<string, string>>({});

    const [condition, setCondition] = useState<(typeof conditionChoices)[number]["value"]>("LIKE_NEW");
    const [conditionNote, setConditionNote] = useState("");
    const [pointDraft, setPointDraft] = useState("");
    const [meetingPoints, setMeetingPoints] = useState<string[]>([]);
    // Meeting point name -> Peta Literasi place id, for points picked from the map (TB-027).
    const [mapPlaces, setMapPlaces] = useState<Record<string, string>>({});
    const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
    const [loanDays, setLoanDays] = useState<(typeof loanDayOptions)[number]>(14);
    const [offered, setOffered] = useState(true);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Debounced catalog search: TemuBaca first, then open catalogs (cached server-side).
    useEffect(() => {
        const term = query.trim();
        if (manual || term.length < 2) return;
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const [local, external] = await Promise.all([
                    fetch(`/api/books/search?q=${encodeURIComponent(term)}&limit=5`, { signal: controller.signal }).then((r) => r.json()).catch(() => null),
                    fetch(`/api/books/external?q=${encodeURIComponent(term)}`, { signal: controller.signal }).then((r) => r.json()).catch(() => null),
                ]);
                const localBooks: LocalBook[] = Array.isArray(local?.data) ? local.data : [];
                setLocalResults(localBooks);
                setExternalResults(((external?.data?.items ?? []) as ExternalBook[]).filter((book) => !book.localBookId).slice(0, 5));
            } finally {
                if (!controller.signal.aborted) setSearching(false);
            }
        }, 400);
        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [query, manual]);

    // Public libraries and meeting points from the Peta Literasi that match the typed point.
    useEffect(() => {
        const term = pointDraft.trim();
        if (term.length < 2) return;
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            const response = await fetch(`/api/places?types=LIBRARY,MEETING_POINT&q=${encodeURIComponent(term)}`, { signal: controller.signal }).then((r) => r.json()).catch(() => null);
            if (!controller.signal.aborted) setPlaceSuggestions(((response?.data?.items ?? []) as PlaceSuggestion[]).slice(0, 5));
        }, 300);
        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [pointDraft]);

    function reset() {
        setStep(1); setManual(false); setQuery(""); setLocalResults([]); setExternalResults([]); setChoice(null);
        setManualBook({ title: "", author: "", publishedAt: "", publisher: "", isbn: "", category: "" }); setManualErrors({});
        setCondition("LIKE_NEW"); setConditionNote(""); setPointDraft(""); setMeetingPoints([]); setMapPlaces({}); setPlaceSuggestions([]); setLoanDays(14); setOffered(true); setError(null);
    }

    function open() {
        reset();
        dialogRef.current?.showModal();
    }

    function close() {
        dialogRef.current?.close();
    }

    function validateManual() {
        const errors: Record<string, string> = {};
        if (!manualBook.title.trim()) errors.title = "Judul wajib diisi.";
        if (manualBook.author.trim().length < 2) errors.author = "Penulis wajib diisi.";
        if (manualBook.publishedAt && !/^\d{4}$/.test(manualBook.publishedAt.trim())) errors.publishedAt = "Tahun terbit 4 digit, mis. 2015.";
        if (manualBook.isbn && !/^(?:\d{9}[\dX]|\d{13})$/.test(manualBook.isbn.replace(/[-\s]/g, ""))) errors.isbn = "ISBN berisi 10 atau 13 digit.";
        if (!manualBook.category) errors.category = "Genre wajib dipilih.";
        setManualErrors(errors);
        return Object.keys(errors).length === 0;
    }

    function next() {
        setError(null);
        if (manual) {
            // Field errors already explain what is missing.
            if (validateManual()) setStep(2);
        } else if (choice) {
            setStep(2);
        } else {
            setError("Pilih buku dari hasil pencarian, atau isi data manual.");
        }
    }

    function addPoint() {
        setMeetingPoints((points) => addMeetingPoint(points, pointDraft));
        setPointDraft("");
        setPlaceSuggestions([]);
    }

    function addMapPlace(place: PlaceSuggestion) {
        const next = addMeetingPoint(meetingPoints, place.name);
        if (next !== meetingPoints) {
            setMeetingPoints(next);
            setMapPlaces((places) => ({ ...places, [next[next.length - 1]]: place.id }));
        }
        setPointDraft("");
        setPlaceSuggestions([]);
    }

    function removePoint(point: string) {
        setMeetingPoints(meetingPoints.filter((item) => item !== point));
        setMapPlaces((places) => Object.fromEntries(Object.entries(places).filter(([name]) => name !== point)));
    }

    function onPointKey(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === "Enter") {
            event.preventDefault();
            addPoint();
        }
    }

    async function resolveBookId() {
        if (manual) {
            const result = await postJson<{ bookId: string }>("/api/books/manual", {
                title: manualBook.title.trim(),
                author: manualBook.author.trim(),
                category: manualBook.category,
                ...(manualBook.publishedAt.trim() ? { publishedAt: manualBook.publishedAt.trim() } : {}),
                ...(manualBook.publisher.trim() ? { publisher: manualBook.publisher.trim() } : {}),
                ...(manualBook.isbn.trim() ? { isbn: manualBook.isbn.trim() } : {}),
            });
            if (!result.ok || !result.data) throw new Error(result.error?.message ?? "Data buku belum dapat disimpan.");
            return result.data.bookId;
        }
        if (choice?.kind === "local") return choice.bookId;
        if (choice?.kind === "external") {
            const result = await postJson<{ bookId: string }>("/api/books/import", { provider: choice.provider, providerId: choice.providerId });
            if (!result.ok || !result.data) throw new Error(result.status === 429 ? "Terlalu banyak penambahan buku. Tunggu sebentar." : result.error?.message ?? "Buku belum dapat ditambahkan dari katalog.");
            return result.data.bookId;
        }
        throw new Error("Pilih buku terlebih dahulu.");
    }

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (meetingPoints.length === 0) {
            setError("Tambahkan minimal satu titik temu publik.");
            return;
        }
        setPending(true);
        setError(null);
        try {
            const bookId = await resolveBookId();
            const details = composeListingDetails({ meetingPoints, loanDays, conditionNote });
            const meetingPlaceIds = meetingPoints.flatMap((point) => (mapPlaces[point] ? [mapPlaces[point]] : []));
            const result = await postJson("/api/book-listings", { bookId, condition, availability: offered ? "AVAILABLE" : "UNAVAILABLE", ...details, meetingPlaceIds });
            if (!result.ok) {
                setError(result.status === 429 ? "Terlalu banyak perubahan. Coba lagi sebentar." : result.error?.message ?? "Listing belum dapat disimpan.");
                return;
            }
            close();
            router.refresh();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Koneksi terputus. Coba lagi.");
        } finally {
            setPending(false);
        }
    }

    const bookOption = (key: string, selected: boolean, onSelect: () => void, title: string, meta: string) => (
        <li key={key}>
            <ChoiceOption
                type="radio"
                name="book-choice"
                checked={selected}
                onChange={onSelect}
                className={cn("min-h-14 rounded-none border-b border-border px-4 last:border-b-0", selected && "border-l-4 border-l-primary bg-[#e7efe8]")}
            >
                <span aria-hidden="true" className={cn("flex size-9 shrink-0 items-center justify-center rounded", selected ? "bg-primary text-primary-foreground" : "bg-[#e7efe8] text-primary")}><BookOpen className="size-4" /></span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate font-heading font-semibold">{title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{meta}</span>
                </span>
                {selected && <Check aria-hidden="true" className="size-4 text-primary" />}
            </ChoiceOption>
        </li>
    );

    return (
        <>
            <button type="button" onClick={open} className="flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                <Plus aria-hidden="true" className="size-4" /> Tambah Buku
            </button>
            <dialog
                ref={dialogRef}
                aria-labelledby={titleId}
                className="m-auto w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-2xl border border-border bg-card p-0 text-foreground shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] backdrop:bg-[rgba(0,23,14,0.6)] backdrop:backdrop-blur-[2px]"
            >
                <div className="flex items-start justify-between gap-4 border-b border-border px-6 pt-5 pb-4">
                    <div>
                        <h2 id={titleId} className="font-heading text-2xl font-semibold text-primary">Tambah Buku</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{manual ? "Isi data buku secara manual jika tidak ditemukan di katalog." : "Cari buku dari katalog, lalu atur cara Anda membagikannya."}</p>
                        <ol className="mt-3 flex list-none items-center gap-3 p-0 text-sm">
                            {[manual ? "Data buku" : "Pilih buku", "Detail untuk peminjam"].map((label, index) => {
                                const current = step === index + 1;
                                const done = step > index + 1;
                                return (
                                    <li key={label} aria-current={current ? "step" : undefined} className="flex items-center gap-2">
                                        {index > 0 && <span aria-hidden="true" className="h-px w-10 bg-border" />}
                                        <span aria-hidden="true" className={cn("flex size-6 items-center justify-center rounded-full text-xs font-semibold", current || done ? "bg-primary text-primary-foreground" : "bg-[#ebe9e1] text-muted-foreground")}>
                                            {done ? <Check className="size-3.5" /> : index + 1}
                                        </span>
                                        <span className={current || done ? "font-semibold text-primary" : "text-muted-foreground"}>{label}</span>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                    <button type="button" onClick={close} aria-label="Tutup dialog" className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted"><X aria-hidden="true" className="size-4" /></button>
                </div>

                <form onSubmit={save} noValidate className="flex max-h-[70vh] flex-col">
                    <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
                        {step === 1 && !manual && (
                            <section aria-labelledby="pick-title" className="flex flex-col gap-2">
                                <h3 id="pick-title" className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Buku</h3>
                                <label className="flex h-11 items-center gap-2 rounded-lg border border-input px-3 focus-within:ring-2 focus-within:ring-ring">
                                    <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="sr-only">Cari judul, penulis, atau ISBN</span>
                                    <input autoFocus type="search" value={query} onChange={(event) => { setQuery(event.target.value); setChoice(null); }} maxLength={200} placeholder="Cari judul, penulis, atau ISBN..." className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                                </label>
                                <div aria-live="polite" className="text-xs text-muted-foreground">
                                    {query.trim().length < 2 ? "Ketik minimal 2 karakter." : searching ? "Mencari…" : localResults.length + externalResults.length === 0 ? "Tidak ada hasil." : null}
                                </div>
                                {(localResults.length > 0 || externalResults.length > 0) && (
                                    <ul aria-label="Hasil pencarian buku" className="list-none overflow-hidden rounded-lg border border-border p-0">
                                        {localResults.map((book) => bookOption(`l-${book.id}`, choice?.kind === "local" && choice.bookId === book.id, () => setChoice({ kind: "local", bookId: book.id, title: book.title }), book.title, ["Di katalog TemuBaca", book.authors[0], book.publishedAt, book.publisher].filter(Boolean).join(" • ")))}
                                        {externalResults.map((book) => bookOption(`e-${book.provider}-${book.providerId}`, choice?.kind === "external" && choice.providerId === book.providerId, () => setChoice({ kind: "external", provider: book.provider, providerId: book.providerId, title: book.title }), book.title, [providerNames[book.provider], book.authors[0], book.publishedAt, book.publisher].filter(Boolean).join(" • ")))}
                                    </ul>
                                )}
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <span className="text-muted-foreground">Sumber data: katalog TemuBaca, Open Library, dan Google Books</span>
                                    <button type="button" onClick={() => { setManual(true); setManualBook((book) => ({ ...book, title: query.trim() })); setError(null); }} className="min-h-10 font-semibold text-primary hover:underline">
                                        Tidak menemukan bukunya? Isi data manual
                                    </button>
                                </div>
                            </section>
                        )}

                        {step === 1 && manual && (
                            <section aria-labelledby="manual-title" className="flex flex-col gap-4">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 id="manual-title" className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Data buku</h3>
                                    <button type="button" onClick={() => setManual(false)} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary hover:underline"><ArrowLeft aria-hidden="true" className="size-4" /> Kembali ke pencarian katalog</button>
                                </div>
                                <FormAlert tone="info">Data manual tidak terhubung ke katalog sehingga tidak diperbarui otomatis. Pastikan judul dan penulis sudah benar.</FormAlert>
                                <Field label="Judul buku" required error={manualErrors.title}>
                                    {(control) => <TextInput {...control} value={manualBook.title} onChange={(event) => setManualBook({ ...manualBook, title: event.target.value })} maxLength={255} />}
                                </Field>
                                <Field label="Penulis" required error={manualErrors.author}>
                                    {(control) => <TextInput {...control} value={manualBook.author} onChange={(event) => setManualBook({ ...manualBook, author: event.target.value })} maxLength={255} />}
                                </Field>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field label={<>Tahun terbit <span className="font-normal text-muted-foreground">(opsional)</span></>} error={manualErrors.publishedAt}>
                                        {(control) => <TextInput {...control} inputMode="numeric" value={manualBook.publishedAt} onChange={(event) => setManualBook({ ...manualBook, publishedAt: event.target.value })} maxLength={4} placeholder="2015" />}
                                    </Field>
                                    <Field label={<>Penerbit <span className="font-normal text-muted-foreground">(opsional)</span></>}>
                                        {(control) => <TextInput {...control} value={manualBook.publisher} onChange={(event) => setManualBook({ ...manualBook, publisher: event.target.value })} maxLength={255} />}
                                    </Field>
                                    <Field label={<>ISBN <span className="font-normal text-muted-foreground">(opsional)</span></>} hint="10 atau 13 digit. Membantu mencegah buku ganda." error={manualErrors.isbn}>
                                        {(control) => <TextInput {...control} inputMode="numeric" value={manualBook.isbn} onChange={(event) => setManualBook({ ...manualBook, isbn: event.target.value })} maxLength={17} placeholder="978-xxx-xxx-xxx-x" />}
                                    </Field>
                                    <Field label="Genre" required error={manualErrors.category}>
                                        {(control) => (
                                            <Select {...control} value={manualBook.category} onChange={(event) => setManualBook({ ...manualBook, category: event.target.value })}>
                                                <option value="">Pilih genre</option>
                                                {genres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
                                            </Select>
                                        )}
                                    </Field>
                                </div>
                                <p className="flex items-start gap-2 text-xs text-muted-foreground"><Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /> Unggah foto sampul belum tersedia; sampul pengganti dengan judul buku akan ditampilkan.</p>
                            </section>
                        )}

                        {step === 2 && (
                            <section aria-labelledby="detail-title" className="flex flex-col gap-4">
                                <h3 id="detail-title" className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Detail untuk peminjam</h3>
                                <p className="text-sm">Buku: <strong className="font-heading">{manual ? manualBook.title : choice?.title}</strong></p>
                                <fieldset className="flex flex-col gap-2">
                                    <legend className="mb-2 text-sm font-medium">Kondisi buku <span aria-hidden="true" className="text-destructive">*</span></legend>
                                    <div className="flex flex-wrap gap-2">
                                        {conditionChoices.map((item) => (
                                            <ChoiceOption key={item.value} type="radio" name="condition" value={item.value} checked={condition === item.value} onChange={() => setCondition(item.value)}
                                                className={cn("min-h-11 rounded-lg border px-3", condition === item.value ? "border-primary bg-[#e7efe8] font-semibold" : "border-border")}>
                                                {item.label}
                                            </ChoiceOption>
                                        ))}
                                    </div>
                                    <TextInput aria-label="Catatan kondisi (opsional)" value={conditionNote} onChange={(event) => setConditionNote(event.target.value)} maxLength={300} placeholder="Catatan kondisi (opsional), mis. halaman mulus, tersampul mika bening." />
                                </fieldset>
                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor={pointInputId} className="text-sm font-medium">Titik temu publik <span aria-hidden="true" className="text-destructive">*</span></label>
                                    <div className="flex gap-2">
                                        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input px-3 focus-within:ring-2 focus-within:ring-ring">
                                            <MapPin aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                                            <input id={pointInputId} value={pointDraft} onChange={(event) => setPointDraft(event.target.value)} onKeyDown={onPointKey} maxLength={80} disabled={meetingPoints.length >= MAX_MEETING_POINTS}
                                                aria-describedby={`${pointInputId}-hint`} placeholder="Tempat umum, mis. stasiun, taman, kafe" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                                        </label>
                                        <button type="button" onClick={addPoint} disabled={!pointDraft.trim() || meetingPoints.length >= MAX_MEETING_POINTS} className="h-11 shrink-0 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50">Tambah</button>
                                    </div>
                                    {pointDraft.trim().length >= 2 && placeSuggestions.length > 0 && meetingPoints.length < MAX_MEETING_POINTS && (
                                        <ul aria-label="Saran dari Peta Literasi" className="flex list-none flex-col overflow-hidden rounded-lg border border-border p-0">
                                            {placeSuggestions.map((place) => (
                                                <li key={place.id} className="border-b border-border last:border-b-0">
                                                    <button type="button" onClick={() => addMapPlace(place)} className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
                                                        <MapPin aria-hidden="true" className="size-4 shrink-0 text-primary" />
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate font-medium">{place.name}</span>
                                                            <span className="block truncate text-xs text-muted-foreground">Peta Literasi · {regionByCode(place.regionCode)?.name ?? "Wilayah belum tercatat"}</span>
                                                        </span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {meetingPoints.length > 0 && (
                                        <ul aria-label="Titik temu dipilih" className="flex list-none flex-wrap gap-2 p-0">
                                            {meetingPoints.map((point) => (
                                                <li key={point} className="flex items-center gap-1 rounded-lg bg-[#e7efe8] py-1 pr-1 pl-2.5 text-sm">
                                                    <MapPin aria-hidden="true" className="size-3.5 text-primary" /> {point}
                                                    {mapPlaces[point] && <span className="text-xs text-muted-foreground">· Peta Literasi</span>}
                                                    <button type="button" onClick={() => removePoint(point)} aria-label={`Hapus ${point}`} className="flex size-8 items-center justify-center rounded hover:bg-card"><X aria-hidden="true" className="size-3.5" /></button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    <p id={`${pointInputId}-hint`} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                        <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" /> Pilih tempat umum yang ramai, maksimal {MAX_MEETING_POINTS}; ketik untuk melihat saran dari Peta Literasi. Alamat rumah Anda tidak pernah ditampilkan.
                                    </p>
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field label="Lama pinjam" required>
                                        {(control) => (
                                            <Select {...control} value={loanDays} onChange={(event) => setLoanDays(Number(event.target.value) as (typeof loanDayOptions)[number])}>
                                                {loanDayOptions.map((days) => <option key={days} value={days}>{days} hari</option>)}
                                            </Select>
                                        )}
                                    </Field>
                                    <div className="flex flex-col gap-1.5">
                                        <span id={`${titleId}-offer`} className="text-sm font-medium">Penawaran</span>
                                        <div className="flex h-11 items-center justify-between rounded-lg border border-input px-3.5 text-sm">
                                            {offered ? "Tawarkan sekarang" : "Simpan sebagai arsip pribadi"}
                                            <Switch checked={offered} onCheckedChange={setOffered} aria-labelledby={`${titleId}-offer`} />
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">Matikan penawaran untuk menyimpan buku sebagai arsip pribadi. Buku tidak muncul pada hasil pencarian publik.</p>
                            </section>
                        )}

                        <FormAlert>{error}</FormAlert>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-border bg-[#f6f4ee] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">Dengan menyimpan, Anda menyetujui <Link href="/about" className="font-semibold text-primary hover:underline">etika berbagi TemuBaca</Link>.</p>
                        <div className="flex justify-end gap-2">
                            {step === 2 ? (
                                <button type="button" onClick={() => setStep(1)} className="h-11 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted">Kembali</button>
                            ) : (
                                <button type="button" onClick={close} className="h-11 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted">Batal</button>
                            )}
                            {step === 1 ? (
                                <button type="button" onClick={next} className="h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Lanjut</button>
                            ) : (
                                <button type="submit" disabled={pending} className="flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                                    <Check aria-hidden="true" className="size-4" /> {pending ? "Menyimpan…" : "Simpan Buku"}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </dialog>
        </>
    );
}
