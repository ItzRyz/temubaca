import { genres, type Genre } from "@/features/books/genres";

const byLabel = new Map(genres.map((genre) => [genre.label.toLocaleLowerCase("id-ID"), genre]));

/** The genre an interest names, or undefined for a raw provider subject saved before genres existed. */
export function genreForInterest(subject: string): Genre | undefined {
    return byLabel.get(subject.trim().toLocaleLowerCase("id-ID"));
}

/**
 * Interests a book's subjects satisfy, as the saved interest text (the genre label for genre interests).
 * Genre interests match through the genre pattern like the /books filter; other interests match a subject exactly.
 */
export function matchInterests(categories: string[], interests: string[]) {
    const subjects = categories.map((category) => category.trim().toLocaleLowerCase("en"));
    return interests.filter((interest) => {
        const genre = genreForInterest(interest);
        if (genre) {
            const regex = new RegExp(genre.pattern);
            return subjects.some((subject) => regex.test(subject));
        }
        const exact = interest.trim().toLocaleLowerCase("en");
        return subjects.includes(exact);
    });
}
