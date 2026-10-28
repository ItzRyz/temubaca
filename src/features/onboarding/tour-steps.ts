/**
 * "Panduan TemuBaca" (owner's decision 28 Okt 2026): a spotlight tour shown once after the first
 * "Pilih minat", and again from the account menu. Targets are `data-tour` attributes in the header.
 */

export const TOUR_TARGETS = ["nav-books", "nav-communities", "nav-map", "account-menu"] as const;
export type TourTarget = (typeof TOUR_TARGETS)[number];

export type TourStep = { id: string; target?: TourTarget; title: string; body: string };

export const tourSteps: TourStep[] = [
    {
        id: "welcome",
        title: "Selamat datang di TemuBaca",
        body: "Di sini kamu bisa menemukan buku, meminjam atau meminjamkannya ke sesama pembaca, dan bergabung dengan komunitas baca. Panduan singkat ini menunjukkan tempat semuanya.",
    },
    {
        id: "books",
        target: "nav-books",
        title: "Cari buku",
        body: "Buka Jelajahi untuk mencari buku. Di halaman buku kamu bisa melihat perpustakaan yang mencatatnya dan salinan milik warga yang bisa dipinjam.",
    },
    {
        id: "communities",
        target: "nav-communities",
        title: "Temukan komunitas",
        body: "Komunitas berisi klub baca, agenda acara, dan merchandise dari komunitas literasi terverifikasi.",
    },
    {
        id: "map",
        target: "nav-map",
        title: "Peta Literasi",
        body: "Lihat perpustakaan, titik temu publik, dan acara di sekitarmu, lengkap dengan petunjuk arah.",
    },
    {
        id: "account",
        target: "account-menu",
        title: "Menu akunmu",
        body: "Dari sini kamu membuka koleksi buku, permintaan pinjam, minat, dan komunitasmu. Titik merah berarti ada yang menunggu tanggapanmu.",
    },
    {
        id: "done",
        title: "Siap mulai",
        body: "Coba cari buku pertamamu atau bagikan buku yang kamu punya. Panduan ini bisa dibuka lagi kapan saja dari menu akun.",
    },
];

/** The query flag that opens the tour once after "Pilih minat". */
export const TOUR_QUERY = "panduan";

/** `next` with the tour flag added; `next` must already be a safe same-site path. */
export function withTourFlag(next: string) {
    const [path, query = ""] = next.split("?");
    const params = new URLSearchParams(query);
    params.set(TOUR_QUERY, "1");
    return `${path}?${params.toString()}`;
}
