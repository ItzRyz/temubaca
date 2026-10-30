import "server-only";

import data from "./districts.json";

import { regionByCode } from "./regions";

/** Kecamatan by kab/kota (Kemendagri NN.NN.NN, 30 Okt 2026); built by scripts/regions/build-districts.ts. */
const byCity = data as unknown as Record<string, [code: string, name: string][]>;

export const DISTRICT_CODE_PATTERN = /^\d{2}\.\d{2}\.\d{2}$/;

export function districtsOf(cityCode: string) {
    return (byCity[cityCode] ?? []).map(([code, name]) => ({ code, name }));
}

/** Whether `code` is a kecamatan of the kab/kota `cityCode`. */
export function isDistrictOf(code: string, cityCode: string) {
    return DISTRICT_CODE_PATTERN.test(code) && code.startsWith(`${cityCode}.`) && (byCity[cityCode] ?? []).some(([item]) => item === code);
}

export function districtName(code: string | null | undefined) {
    if (!code) return undefined;
    return byCity[code.slice(0, 5)]?.find(([item]) => item === code)?.[1];
}

/**
 * How a member's area reads to other members, at the level chosen in Pengaturan → Peta & Lokasi: kecamatan
 * (falling back to kab/kota when not filled), kab/kota, or only the province. Never anything finer.
 */
export function memberAreaLabel(member: { regionCode: string | null; districtCode: string | null }, precision: "DISTRICT" | "CITY" | "PROVINCE") {
    const region = regionByCode(member.regionCode);
    if (!region) return undefined;
    if (precision === "PROVINCE") return region.provinceName;
    const district = precision === "DISTRICT" ? districtName(member.districtCode) : undefined;
    return district ? `Kec. ${district}, ${region.name}` : region.name;
}
