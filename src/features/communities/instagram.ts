/** Follower counts are re-read once a day, failures included, so the API is not asked on every view. */
export const INSTAGRAM_REFRESH_HOURS = 24;

export function instagramNeedsRefresh(community: { instagramHandle: string | null; instagramCheckedAt: Date | null }, now = new Date()) {
    if (!community.instagramHandle) return false;
    return !community.instagramCheckedAt || now.getTime() - community.instagramCheckedAt.getTime() > INSTAGRAM_REFRESH_HOURS * 60 * 60 * 1000;
}

const compact = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });

/** "1,2 rb pengikut Instagram", or null when there is no count to show. */
export function instagramFollowersLabel(count: number | null | undefined) {
    return count === null || count === undefined ? null : `${compact.format(count)} pengikut Instagram`;
}
