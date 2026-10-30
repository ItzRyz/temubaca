/**
 * The borrower's preferred meeting time (30 Okt 2026): a date and a clock time in WIB, stored as one instant.
 * Pure helpers shared by the form, the server, and the loan cards.
 */

export const MEETING_MAX_DAYS_AHEAD = 60;
const WIB = "Asia/Jakarta";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Today's date in WIB as `YYYY-MM-DD`, for the date input's minimum. */
export function wibDate(now = new Date()) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: WIB, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * The instant for a WIB date and time, or a message explaining why it is not usable. Both empty: no
 * preference. A time needs a date; a date needs a time, so the owner never sees a made-up hour.
 */
export function meetingTimeFrom(date: string | undefined, clock: string | undefined, now = new Date()): { at: Date | null } | { error: string } {
    if (!date && !clock) return { at: null };
    if (!date) return { error: "Pilih tanggal pertemuan untuk jam yang dipilih." };
    if (!clock) return { error: "Pilih jam pertemuan untuk tanggal yang dipilih." };
    if (!DATE.test(date) || !CLOCK.test(clock)) return { error: "Tanggal atau jam pertemuan tidak valid." };
    // WIB has no daylight saving, so a fixed +07:00 offset keeps the hour exactly as chosen.
    const at = new Date(`${date}T${clock}:00+07:00`);
    if (Number.isNaN(at.getTime()) || wibDate(at) !== date) return { error: "Tanggal pertemuan tidak valid." };
    if (at.getTime() < now.getTime()) return { error: "Waktu pertemuan sudah lewat. Pilih waktu yang akan datang." };
    if (at.getTime() > now.getTime() + MEETING_MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) return { error: `Pilih waktu pertemuan dalam ${MEETING_MAX_DAYS_AHEAD} hari ke depan.` };
    return { at };
}

const dayFormat = new Intl.DateTimeFormat("id-ID", { timeZone: WIB, weekday: "long", day: "numeric", month: "short", year: "numeric" });
const clockFormat = new Intl.DateTimeFormat("id-ID", { timeZone: WIB, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "Sabtu, 2 Nov 2026 · 09.30 WIB"; older requests show their free text; otherwise "Belum ditentukan". */
export function meetingTimeLabel(request: { preferredAt: Date | null; preferredTime: string | null }) {
    if (request.preferredAt) return `${dayFormat.format(request.preferredAt)} · ${clockFormat.format(request.preferredAt)} WIB`;
    return request.preferredTime?.trim() || "Belum ditentukan";
}
