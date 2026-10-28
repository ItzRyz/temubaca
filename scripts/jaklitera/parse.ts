/**
 * Parsing JAKLITERA (Dispusip DKI Jakarta's catalog, perpustakaan.jakarta.go.id, INLIS) pages for
 * scripts/import-jaklitera.ts. Search pages list record links; a record page names its ISBNs, call
 * number, and per location group the copies that can be borrowed, read on site, or are on loan.
 */

export const JAKLITERA_BASE = "https://perpustakaan.jakarta.go.id";

/** ISBN-13 digits for an ISBN-10 or ISBN-13 (hyphens and spaces ignored), or null. */
export function toIsbn13(isbn: string | null | undefined) {
    const value = (isbn ?? "").replace(/[-\s]/g, "").toUpperCase();
    if (/^\d{13}$/.test(value)) return value;
    if (!/^\d{9}[\dX]$/.test(value)) return null;
    const core = `978${value.slice(0, 9)}`;
    const sum = [...core].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
    return `${core}${(10 - (sum % 10)) % 10}`;
}

/** The ISBN-10 of a 978- ISBN-13, which the catalog often stores instead; null otherwise. */
export function toIsbn10(isbn13: string) {
    if (!/^978\d{10}$/.test(isbn13)) return null;
    const core = isbn13.slice(3, 12);
    const sum = [...core].reduce((total, digit, index) => total + Number(digit) * (10 - index), 0);
    const check = (11 - (sum % 11)) % 11;
    return `${core}${check === 10 ? "X" : check}`;
}

const lines = (html: string) => html.replace(/<[^>]*>/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);

/** Record control numbers on a search page, in order, without duplicates. */
export function parseSearchPage(html: string) {
    return [...new Set([...html.matchAll(/book\/detail\?cn=([A-Z0-9]+)/g)].map((match) => match[1]))];
}

export type RecordCopies = { locations: string[]; borrowable: number; onSite: number; onLoan: number };

/** ISBNs (as ISBN-13), call number, and the copy groups of a record page. */
export function parseRecordPage(html: string) {
    const text = lines(html);
    const after = (label: string, from = 0) => {
        const index = text.indexOf(label, from);
        return index >= 0 && index + 1 < text.length ? text[index + 1] : null;
    };
    const isbns = text.flatMap((line, index) => line === "ISBN" && text[index + 1] ? text[index + 1].split(/[;,]/).map(toIsbn13) : [])
        .filter((value): value is string => Boolean(value));
    const groups: RecordCopies[] = [];
    text.forEach((line, index) => {
        if (line !== "Tersedia di:") return;
        const locations: string[] = [];
        for (let next = index + 1; next < text.length && text[next].startsWith("~"); next += 1) locations.push(text[next].slice(1).trim());
        const count = (label: string) => Number(after(label, index) ?? 0) || 0;
        groups.push({ locations, borrowable: count("Dapat Dipinjam:"), onSite: count("Baca di Tempat:"), onLoan: count("Sedang Dipinjam:") });
    });
    return { isbns: [...new Set(isbns)], callNumber: after("Call Number"), groups };
}
