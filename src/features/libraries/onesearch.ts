/**
 * Parsing Indonesia OneSearch (VuFind 3) answers for TB-023. No server-only imports, so it is tested
 * against saved pages. The search RSS lists record links but no library; a record page names the
 * institution and building in its "Lokasi" table. Record ids start with a repository code (`IOS19238.`),
 * and records from one repository share their institution.
 */

/** ISBN-13 digits for a stored ISBN-10 or ISBN-13, or null when it is neither. */
export function toIsbn13(isbn: string | null | undefined) {
    const value = (isbn ?? "").replace(/[-\s]/g, "").toUpperCase();
    if (/^\d{13}$/.test(value)) return value;
    if (!/^\d{9}[\dX]$/.test(value)) return null;
    const core = `978${value.slice(0, 9)}`;
    const sum = [...core].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
    return `${core}${(10 - (sum % 10)) % 10}`;
}

const decode = (text: string) => text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/\s+/g, " ").trim();

/** Record ids from a search RSS page, in order, without duplicates. */
export function parseSearchRss(xml: string) {
    const total = Number(xml.match(/<opensearch:totalResults>(\d+)<\/opensearch:totalResults>/)?.[1] ?? 0);
    const ids = [...xml.matchAll(/<link>https:\/\/onesearch\.id\/Record\/([^<\s]+)<\/link>/g)].map((match) => decodeURIComponent(match[1]));
    return { total, recordIds: [...new Set(ids)] };
}

/** The repository a record comes from (`IOS19238`), or the whole id when it has no such prefix. */
export function repositoryOf(recordId: string) {
    return recordId.match(/^(IOS\d+)\./)?.[1] ?? recordId;
}

/** The "Lokasi" table of a record page: building (library), institution, city, province. */
export function parseRecordLocation(html: string) {
    const table = html.match(/<table class="table table-condensed table-holding">([\s\S]*?)<\/table>/)?.[1] ?? "";
    const cell = (label: string) => {
        const match = table.match(new RegExp(`<th>\\s*${label}\\s*</th>\\s*<td>([\\s\\S]*?)</td>`));
        return match ? decode(match[1].replace(/<[^>]*>/g, " ")) || null : null;
    };
    return { building: cell("Gedung"), institution: cell("Institusi"), city: cell("Kota"), province: cell("Provinsi") };
}

/** How a library's `oneSearchInstitution` is compared with a record's building or institution. */
export const institutionKey = (name: string) => decode(name).toLocaleLowerCase("id-ID");
