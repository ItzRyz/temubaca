/**
 * Seeded randomness for the synthetic dataset. `Math.random` is never used, so one seed always
 * gives the same rows. `fork(label)` derives an independent stream, so changing how one table is
 * generated does not reshuffle the others.
 */

/** FNV-1a, enough to turn a label into a 32-bit stream seed. */
function hash32(text: string) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

export type Rng = ReturnType<typeof createRng>;

/** mulberry32: small, fast, and good enough for test data (not for anything secret). */
export function createRng(seed: number) {
    let state = seed >>> 0;
    const next = () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const rng = {
        next,
        fork: (label: string) => createRng(hash32(`${seed}:${label}`)),
        int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
        chance: (probability: number) => next() < probability,
        pick: <T>(items: readonly T[]): T => {
            if (items.length === 0) throw new Error("pick() from an empty list");
            return items[Math.floor(next() * items.length)];
        },
        /** `entries` as [value, weight]; weights need not sum to 1. */
        weighted: <T>(entries: readonly (readonly [T, number])[]): T => {
            const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
            let roll = next() * total;
            for (const [value, weight] of entries) {
                roll -= weight;
                if (roll < 0) return value;
            }
            return entries[entries.length - 1][0];
        },
        /** Up to `count` distinct items, in random order. */
        sample: <T>(items: readonly T[], count: number): T[] => {
            const copy = [...items];
            const take = Math.min(count, copy.length);
            for (let i = 0; i < take; i += 1) {
                const j = i + Math.floor(next() * (copy.length - i));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
            return copy.slice(0, take);
        },
        normal: (mean: number, sd: number) => {
            const u = Math.max(next(), Number.EPSILON);
            return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
        },
        /** Heavy-tailed whole number: most values near `median`, a few far above. */
        logNormalInt: (median: number, sigma: number, min: number, max: number) => {
            const value = Math.round(median * Math.exp(rng.normal(0, sigma)));
            return Math.min(max, Math.max(min, value));
        },
        /** An instant between `from` and `to` (`from` when the range is empty). */
        date: (from: Date, to: Date) => new Date(from.getTime() + next() * Math.max(0, to.getTime() - from.getTime())),
        /** An instant strictly inside (`from`, `to`), or null when the range is empty. */
        between: (from: Date, to: Date) => {
            const width = to.getTime() - from.getTime();
            return width > 2 ? new Date(from.getTime() + 1 + next() * (width - 2)) : null;
        },
    };
    return rng;
}

/** Weighted draws from a fixed list, O(log n) per draw (cumulative weights + binary search). */
export function weightedSampler<T>(items: readonly T[], weightOf: (item: T, index: number) => number) {
    const cumulative: number[] = [];
    let total = 0;
    items.forEach((item, index) => {
        total += Math.max(0, weightOf(item, index));
        cumulative.push(total);
    });
    return {
        size: items.length,
        draw(rng: Rng): T | undefined {
            if (total <= 0) return undefined;
            const roll = rng.next() * total;
            let low = 0;
            let high = cumulative.length - 1;
            while (low < high) {
                const mid = (low + high) >> 1;
                if (cumulative[mid] > roll) high = mid;
                else low = mid + 1;
            }
            return items[low];
        },
    };
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
export const addMs = (date: Date, ms: number) => new Date(date.getTime() + ms);
export const addDays = (date: Date, days: number) => addMs(date, days * DAY_MS);
export const addHours = (date: Date, hours: number) => addMs(date, hours * HOUR_MS);
export const maxDate = (...dates: Date[]) => new Date(Math.max(...dates.map((date) => date.getTime())));
export const minDate = (...dates: Date[]) => new Date(Math.min(...dates.map((date) => date.getTime())));
