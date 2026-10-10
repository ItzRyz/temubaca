export type MerchandisePrice = {
    priceAmount: string | null;
    currency: string | null;
    priceNote: string | null;
};

export const merchandiseAvailabilityLabels = {
    AVAILABLE: "Tersedia",
    UNAVAILABLE: "Tidak tersedia",
    RESERVED: "Dipesan",
} as const;

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

/** Formats the listed price; IDR (or no currency) uses Rupiah, other currencies are shown as stored. */
export function formatMerchandisePrice(item: MerchandisePrice) {
    if (item.priceAmount === null) return item.priceNote || "Harga belum dicantumkan";
    const amount = Number(item.priceAmount);
    if ((!item.currency || item.currency === "IDR") && Number.isFinite(amount)) return rupiah.format(amount);
    return `${item.priceAmount}${item.currency ? ` ${item.currency}` : ""}`;
}
