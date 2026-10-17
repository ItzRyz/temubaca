/**
 * Providers report ISO 639 codes ("ind", "id", "eng"); the catalog stores the Indonesian
 * label used by existing records and filters ("Indonesia", "Inggris").
 */
const languageLabels: Record<string, string> = {
    id: "Indonesia", ind: "Indonesia", in: "Indonesia",
    en: "Inggris", eng: "Inggris",
    ms: "Melayu", msa: "Melayu", may: "Melayu",
    jv: "Jawa", jav: "Jawa",
    su: "Sunda", sun: "Sunda",
    ar: "Arab", ara: "Arab",
    ja: "Jepang", jpn: "Jepang",
    zh: "Mandarin", chi: "Mandarin", zho: "Mandarin",
    ko: "Korea", kor: "Korea",
    nl: "Belanda", dut: "Belanda", nld: "Belanda",
    fr: "Prancis", fre: "Prancis", fra: "Prancis",
    de: "Jerman", ger: "Jerman", deu: "Jerman",
    es: "Spanyol", spa: "Spanyol",
};

export function languageLabel(code: string | null | undefined) {
    if (!code) return undefined;
    const normalized = code.trim().toLowerCase().replace(/^\/languages\//, "");
    if (!normalized) return undefined;
    return languageLabels[normalized] ?? normalized.toUpperCase();
}
