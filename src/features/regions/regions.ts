import { kabkota, provinces } from "./data";

/** A kab/kota code (`NN.NN`); the first two digits are the province. */
export const KABKOTA_CODE_PATTERN = /^\d{2}\.\d{2}$/;

const provinceNames = new Map(provinces);
const kabkotaNames = new Map(kabkota);

export type Region = { code: string; name: string; provinceCode: string; provinceName: string };

/** The kab/kota for a code, or undefined when the code is not in the reference table. */
export function regionByCode(code: string | null | undefined): Region | undefined {
    if (!code) return undefined;
    const name = kabkotaNames.get(code);
    if (!name) return undefined;
    const provinceCode = code.slice(0, 2);
    return { code, name, provinceCode, provinceName: provinceNames.get(provinceCode) ?? "" };
}

export function isKnownKabkota(code: string) {
    return KABKOTA_CODE_PATTERN.test(code) && kabkotaNames.has(code);
}

export function provinceOptions() {
    return provinces.map(([code, name]) => ({ code, name }));
}

export function kabkotaOptions(provinceCode: string) {
    return kabkota.filter(([code]) => code.startsWith(`${provinceCode}.`)).map(([code, name]) => ({ code, name }));
}
