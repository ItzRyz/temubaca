import type { Metadata } from "next";
import Link from "next/link";

import { PolicyPage, PolicySection } from "@/features/policies/components/policy-page";

export const metadata: Metadata = { title: "Syarat Layanan", description: "Aturan memakai TemuBaca: akun, pinjam-meminjam buku, komunitas, merchandise, dan moderasi." };

export default function TermsPage() {
    return (
        <PolicyPage
            eyebrow="Kebijakan"
            title="Syarat Layanan"
            current="/terms"
            intro={<p>Dengan membuat akun atau memakai TemuBaca, kamu menyetujui aturan di bawah ini. TemuBaca adalah ruang warga untuk menemukan buku, saling meminjamkan buku fisik, dan terhubung dengan komunitas baca.</p>}
        >
            <PolicySection title="Akun">
                <ul>
                    <li>Kamu harus berusia minimal 13 tahun. Bila belum 18 tahun, pakai TemuBaca dengan sepengetahuan orang tua atau wali.</li>
                    <li>Gunakan nama dan surel yang benar, jaga kerahasiaan kata sandi, dan satu orang cukup satu akun.</li>
                    <li>Kamu bertanggung jawab atas isi yang kamu tulis: listing, pesan, laporan, dan konten komunitas.</li>
                </ul>
            </PolicySection>

            <PolicySection title="Pinjam-meminjam buku">
                <ul>
                    <li>Pemilik buku menentukan apakah permintaan diterima. Serah terima dan pengembalian dikonfirmasi oleh kedua pihak.</li>
                    <li>Tenggat dihitung sejak serah terima. Peminjam dapat mengajukan perpanjangan satu kali, maksimal 14 hari, sebelum tenggat; pemilik boleh menerima atau menolak.</li>
                    <li>Kembalikan buku dalam kondisi seperti saat dipinjam. Kerusakan, kehilangan, atau buku yang tidak dikembalikan dilaporkan lewat “Laporkan Masalah” dan diputuskan pengelola.</li>
                    <li>TemuBaca tidak memungut biaya, tidak mengenakan denda, dan tidak menangani ganti rugi uang. Kesepakatan lain di luar itu menjadi tanggung jawab kedua pihak.</li>
                    <li>Selalu bertemu di ruang publik. Lihat <Link href="/safety" className="font-semibold text-primary hover:underline">Panduan Keamanan</Link>.</li>
                </ul>
            </PolicySection>

            <PolicySection title="Komunitas dan merchandise">
                <ul>
                    <li>Komunitas baru ditinjau pengelola sebelum tampil. Komunitas terverifikasi dapat menerbitkan acara dan merchandise tanpa tinjauan lebih dulu.</li>
                    <li>Merchandise hanya berupa katalog. Pembayaran, pengiriman, dan pengembalian dana terjadi langsung dengan komunitas di luar TemuBaca, dan TemuBaca bukan pihak dalam transaksi itu.</li>
                </ul>
            </PolicySection>

            <PolicySection title="Yang tidak boleh">
                <ul>
                    <li>Menipu, melecehkan, mengancam, atau membahayakan pengguna lain.</li>
                    <li>Meminta atau membagikan alamat rumah, data pribadi orang lain, atau data pembayaran lewat TemuBaca.</li>
                    <li>Menawarkan buku bajakan, barang terlarang, atau konten yang melanggar hukum.</li>
                    <li>Menyalahgunakan laporan, membuat akun palsu, atau mengganggu sistem.</li>
                </ul>
            </PolicySection>

            <PolicySection title="Moderasi">
                <p>Pengelola dapat menyembunyikan listing, menangguhkan komunitas, atau menangguhkan akun yang melanggar aturan. Pemilik listing yang disembunyikan dapat mengajukan banding dari halaman Buku Saya. Laporan dikirim lewat tombol “Laporkan” di halaman terkait.</p>
            </PolicySection>

            <PolicySection title="Data buku dan perubahan layanan">
                <ul>
                    <li>Informasi buku berasal dari Open Library dan Google Books dan dapat tidak lengkap atau keliru.</li>
                    <li>TemuBaca masih dikembangkan. Fitur dan aturan ini dapat berubah; tanggal pembaruan tercantum di atas.</li>
                </ul>
            </PolicySection>
        </PolicyPage>
    );
}
