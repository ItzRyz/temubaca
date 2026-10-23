/**
 * Community recommendation rules shared by the ML path and the SQL baseline (TB-060), without
 * server-only imports so unit tests can drive them.
 */
import { regionByCode } from "@/features/regions/regions";

export type LocationScore = 0 | 0.5 | 1;

export type CommunityCandidate = { id: string; interests: string[]; regionCode: string | null };

const fold = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");

/** Community tags the user also saved, in the community's order. Old raw-subject interests never match a tag. */
export function sharedInterests(subjects: string[], communityInterests: string[]) {
    const saved = new Set(subjects.map(fold));
    return communityInterests.filter((label) => saved.has(fold(label)));
}

/** Same kab/kota 1, same province 0.5, otherwise 0; the same rule as the ML Service. */
export function locationScore(userRegionCode: string | null, communityRegionCode: string | null): LocationScore {
    const user = regionByCode(userRegionCode);
    const community = regionByCode(communityRegionCode);
    if (!user || !community) return 0;
    if (user.code === community.code) return 1;
    return user.provinceCode === community.provinceCode ? 0.5 : 0;
}

/**
 * Reason shown on the card. Only the community's own public region is named; the user's region is
 * never shown (TB-041).
 */
export function communityReason(matched: string[], location: LocationScore, communityRegionCode: string | null) {
    const region = regionByCode(communityRegionCode);
    const parts: string[] = [];
    if (matched.length) parts.push(`Sesuai minat: ${matched.join(", ")}`);
    if (region && location === 1) parts.push(`Di ${region.name}`);
    else if (region && location === 0.5) parts.push(`Di provinsi ${region.provinceName}`);
    return parts.join(" · ") || "Komunitas terverifikasi di TemuBaca";
}

/**
 * SQL-baseline ranking (DEC-08): binary cosine of saved interests and community tags, weighted
 * 0.7/0.3 with location like the ML Service. Only positive scores are kept; ties keep id order.
 */
export function rankCommunities<T extends CommunityCandidate>(subjects: string[], userRegionCode: string | null, candidates: T[]) {
    const distinct = new Set(subjects.map(fold)).size;
    return candidates
        .map((community) => {
            const matched = sharedInterests(subjects, community.interests);
            const interestScore = matched.length && distinct ? matched.length / Math.sqrt(distinct * community.interests.length) : 0;
            const location = locationScore(userRegionCode, community.regionCode);
            return { community, matched, location, score: 0.7 * interestScore + 0.3 * location };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.community.id.localeCompare(b.community.id));
}
