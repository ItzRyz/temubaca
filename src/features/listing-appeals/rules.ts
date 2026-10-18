/** Figma "Ajukan Banding" (301:2608): reasons an owner gives when asking for a hidden listing back. */
export const appealReasons = [
    "Saya sudah memperbaiki informasi buku",
    "Laporan tidak sesuai kenyataan",
    "Lainnya",
] as const;

export const APPEAL_DETAILS_MAX = 500;
/** Photos only, as in the Figma upload hint ("JPG atau PNG"). */
export const APPEAL_FILE_TYPES = ["image/jpeg", "image/png"] as const;

export function appealFileError(file: { size: number; type: string }) {
    if (!(APPEAL_FILE_TYPES as readonly string[]).includes(file.type)) return "Foto harus JPG atau PNG.";
    if (file.size > 5 * 1024 * 1024) return "Ukuran foto maksimal 5 MB.";
    if (file.size === 0) return "Berkas kosong.";
    return null;
}
