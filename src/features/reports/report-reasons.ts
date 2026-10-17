export type ReportTargetType = "BOOK" | "BOOK_LISTING" | "COMMUNITY" | "EVENT" | "MERCHANDISE_LISTING" | "USER";

type Reason = { value: string; description: string };

const inappropriate: Reason = { value: "Konten tidak pantas", description: "Ujaran kebencian, pelecehan, atau konten terlarang." };
const other: Reason = { value: "Lainnya", description: "Masalah lain yang perlu ditinjau pengelola." };

/**
 * Reasons per content type (Figma 25:6948, 213:1239, 213:1461, 213:1687, 213:1911). The chosen title is
 * sent as the free-text `reason`, so admins see the same words the reader picked.
 */
const reasons: Record<ReportTargetType, Reason[]> = {
    BOOK: [
        { value: "Informasi keliru", description: "Data buku, jadwal, atau titik temu tidak akurat." },
        inappropriate,
        { value: "Penipuan atau tidak aman", description: "Permintaan biaya di luar platform, titik temu berisiko, atau hal mencurigakan lain." },
        other,
    ],
    BOOK_LISTING: [
        { value: "Informasi keliru", description: "Kondisi buku, aturan, atau titik temu salinan tidak akurat." },
        inappropriate,
        { value: "Penipuan atau tidak aman", description: "Permintaan biaya di luar platform, titik temu berisiko, atau hal mencurigakan lain." },
        other,
    ],
    COMMUNITY: [
        { value: "Informasi keliru", description: "Profil, deskripsi, atau kegiatan komunitas tidak akurat." },
        { value: "Status verifikasi menyesatkan", description: "Label terverifikasi tidak sesuai dengan kenyataan." },
        inappropriate,
        { value: "Penipuan atau tidak aman", description: "Meminta uang di luar platform atau hal mencurigakan lain." },
        other,
    ],
    EVENT: [
        { value: "Informasi keliru", description: "Waktu, lokasi, atau tautan acara tidak akurat." },
        { value: "Acara tidak berlangsung", description: "Acara dibatalkan atau tidak ada, tetapi masih tampil." },
        inappropriate,
        { value: "Penipuan atau tidak aman", description: "Lokasi berisiko, biaya tersembunyi, atau hal mencurigakan lain." },
        other,
    ],
    MERCHANDISE_LISTING: [
        { value: "Informasi keliru", description: "Harga, stok, atau deskripsi barang tidak sesuai." },
        { value: "Listing tidak sesuai", description: "Barang atau penjual tidak sesuai dengan komunitas yang tertera." },
        { value: "Konten tidak pantas", description: "Barang atau gambar yang dilarang atau tidak pantas." },
        { value: "Penipuan atau tidak aman", description: "Meminta pembayaran mencurigakan atau hal berisiko lain." },
        other,
    ],
    USER: [
        { value: "Perilaku tidak pantas", description: "Pelecehan, ancaman, atau bahasa kasar." },
        { value: "Menyamar sebagai orang lain", description: "Akun memakai identitas orang lain atau komunitas lain." },
        { value: "Penipuan atau tidak aman", description: "Meminta uang, data pribadi, atau bertemu di tempat berisiko." },
        other,
    ],
};

export function reportReasonsFor(targetType: ReportTargetType) {
    return reasons[targetType];
}
