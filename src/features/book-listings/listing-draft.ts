/** Figma "Tambah Buku" offers three condition grades; they map onto the stored scale. */
export const conditionChoices = [
    { value: "LIKE_NEW", label: "Sangat baik" },
    { value: "GOOD", label: "Baik" },
    { value: "FAIR", label: "Layak baca" },
] as const;

export const loanDayOptions = [7, 14, 21, 30] as const;

export const MAX_MEETING_POINTS = 3;

/** Normalise a typed meeting point and add it once; returns the list unchanged when it is a duplicate or full. */
export function addMeetingPoint(points: string[], value: string) {
    const point = value.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!point || points.length >= MAX_MEETING_POINTS) return points;
    if (points.some((existing) => existing.toLocaleLowerCase("id-ID") === point.toLocaleLowerCase("id-ID"))) return points;
    return [...points, point];
}

/**
 * Listings store one public location and free-text rules, so the dialog's structured fields are
 * folded into them: meeting points joined with " & ", the loan period and condition note as lines.
 */
export function composeListingDetails(input: { meetingPoints: string[]; loanDays: number; conditionNote?: string }) {
    const lines = [`Lama pinjam: ${input.loanDays} hari.`];
    const note = input.conditionNote?.trim();
    if (note) lines.push(`Catatan kondisi: ${note}`);
    return {
        publicLocation: input.meetingPoints.join(" & ") || undefined,
        borrowingRules: lines.join("\n"),
    };
}
