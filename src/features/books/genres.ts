/**
 * Catalog genres for the /books filter. Provider subjects (Open Library, Google Books) are English,
 * overlapping, and partly not genres ("Earth (planet)", "New York Times reviewed"), so each genre
 * lists the subject patterns it covers. The labels include the manual-entry genres of Tambah Buku,
 * which therefore match themselves. Subjects no genre covers are simply not offered as filters.
 */
export type Genre = { slug: string; label: string; pattern: string };

/** Patterns are Postgres/JS regular expressions matched against the lower-cased subject. */
export const genres: Genre[] = [
    { slug: "sastra-indonesia", label: "Sastra Indonesia", pattern: "^indonesia$|indonesian (fiction|literature)|^indonesia, fiction|pre-independent indonesia" },
    { slug: "fiksi-sastra", label: "Fiksi Sastra", pattern: "^fiksi sastra$|fiction|^novels?$|^roman$|literature|slice of life" },
    { slug: "fiksi-sejarah", label: "Fiksi Sejarah", pattern: "^fiksi sejarah$|historical fiction|fiction, historical" },
    { slug: "sejarah", label: "Sejarah", pattern: "^history$|^historical$|^sejarah$|anti-imperialis" },
    { slug: "romansa", label: "Romansa", pattern: "romance|romansa|man-woman relationships" },
    { slug: "keluarga", label: "Keluarga", pattern: "family|mothers and daughters|fathers and sons" },
    { slug: "persahabatan", label: "Persahabatan", pattern: "friendship|persahabatan" },
    { slug: "pendidikan", label: "Pendidikan", pattern: "^education|pendidikan" },
    { slug: "isu-sosial", label: "Isu Sosial", pattern: "poverty|social (conditions|issues)" },
    { slug: "kesehatan-mental", label: "Kesehatan Mental", pattern: "mental health|kesehatan mental" },
    { slug: "puisi", label: "Puisi", pattern: "^puisi$|poetry" },
    { slug: "nonfiksi", label: "Nonfiksi", pattern: "^nonfiksi$|non-?fiction" },
    { slug: "filsafat", label: "Filsafat", pattern: "filsafat|philosophy" },
    { slug: "biografi", label: "Biografi", pattern: "biografi|biography|autobiography" },
    { slug: "anak-remaja", label: "Anak & Remaja", pattern: "^anak & remaja$|juvenile|young adult|children" },
    { slug: "agama", label: "Agama & Spiritualitas", pattern: "^agama|religion|spiritual|islam" },
    { slug: "komik", label: "Komik & Novel Grafis", pattern: "^komik|comic|graphic novel" },
];

const bySlug = new Map(genres.map((genre) => [genre.slug, genre]));

export function genreBySlug(slug: string | undefined) {
    return slug ? bySlug.get(slug) : undefined;
}

/** Genres a book belongs to, in taxonomy order (most specific first for Indonesian literature). */
export function genresForSubjects(subjects: string[]) {
    const lowered = subjects.map((subject) => subject.toLocaleLowerCase("en"));
    return genres.filter((genre) => {
        const regex = new RegExp(genre.pattern);
        return lowered.some((subject) => regex.test(subject));
    });
}

/** The first genre's label for a card chip, or null when no genre covers the book's subjects. */
export function primaryGenreLabel(subjects: string[]) {
    return genresForSubjects(subjects)[0]?.label ?? null;
}
