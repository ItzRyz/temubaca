const relative = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });

/** "3 hari yang lalu", "menit ini" — Indonesian relative time; `fallback` when there is no date. */
export function timeAgo(value: Date | null | undefined, now = new Date(), fallback = "Belum pernah") {
    if (!value) return fallback;
    const minutes = Math.round((value.getTime() - now.getTime()) / 60_000);
    if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return relative.format(hours, "hour");
    const days = Math.round(hours / 24);
    if (Math.abs(days) < 30) return relative.format(days, "day");
    const months = Math.round(days / 30);
    if (Math.abs(months) < 12) return relative.format(months, "month");
    return relative.format(Math.round(days / 365), "year");
}
