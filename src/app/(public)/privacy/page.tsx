import type { Metadata } from "next";
import Link from "next/link";

import { PolicyPage, PolicySection } from "@/features/policies/components/policy-page";

export const metadata: Metadata = { title: "Kebijakan Privasi", description: "Data apa yang disimpan TemuBaca, untuk apa, berapa lama, dan cara mengunduh atau menghapusnya." };

export default function PrivacyPage() {
    return (
        <PolicyPage
            eyebrow="Kebijakan"
            title="Kebijakan Privasi"
            current="/privacy"
            intro={<p>Halaman ini menjelaskan data yang disimpan TemuBaca, alasan menyimpannya, siapa yang dapat melihatnya, dan berapa lama data itu disimpan. TemuBaca tidak menjual data pengguna dan tidak memakai iklan atau pelacak analitik pihak ketiga.</p>}
        >
            <PolicySection title="Data yang kami simpan">
                <ul>
                    <li><strong>Akun:</strong> nama tampilan, alamat surel, kata sandi (disimpan tersandi oleh layanan autentikasi), waktu kamu mengonfirmasi batas usia saat mendaftar, dan wilayah kabupaten/kota bila kamu mengisinya (opsional, tidak ditampilkan ke pengguna lain).</li>
                    <li><strong>Aktivitas baca:</strong> bookmark, minat bacaan, dan rekomendasi yang dihitung dari minat itu.</li>
                    <li><strong>Buku yang kamu bagikan:</strong> kondisi buku, aturan pinjam, dan titik temu publik yang kamu pilih. Alamat rumah tidak diminta dan jangan dicantumkan.</li>
                    <li><strong>Pinjam-meminjam:</strong> permintaan, pesan singkat, waktu serah terima dan pengembalian, perpanjangan, serta laporan masalah.</li>
                    <li><strong>Komunitas:</strong> profil dan kontak publik komunitas, keanggotaan, serta bukti verifikasi yang kamu unggah.</li>
                    <li><strong>Laporan dan moderasi:</strong> laporan konten yang kamu kirim dan keputusan pengelola atasnya.</li>
                    <li><strong>Data teknis:</strong> alamat IP dan identitas akun dipakai sementara untuk membatasi percobaan berlebihan (rate limit).</li>
                </ul>
            </PolicySection>

            <PolicySection title="Siapa yang dapat melihat">
                <ul>
                    <li>Pengguna lain melihat nama tampilanmu, buku yang kamu tawarkan, dan titik temu publik. Surel tidak ditampilkan kepada pengguna lain.</li>
                    <li>Detail pinjaman hanya terlihat oleh pemilik buku dan peminjamnya, serta pengelola bila ada sengketa.</li>
                    <li>Bukti verifikasi komunitas hanya dapat dibuka pemilik komunitas dan pengelola TemuBaca.</li>
                    <li>Pengelola TemuBaca dapat melihat data akun untuk menangani laporan, sengketa, dan penyalahgunaan. Setiap tindakan pengelola dicatat.</li>
                </ul>
            </PolicySection>

            <PolicySection title="Layanan yang kami pakai">
                <p>Data disimpan di Supabase (database, autentikasi, dan penyimpanan berkas) dan aplikasi dijalankan di Vercel. Keduanya berada di region Singapura. Pembatasan percobaan memakai Upstash. Data buku diambil dari Open Library dan Google Books. Pencarian katalog dikirim ke layanan tersebut tanpa data akunmu. Rekomendasi buku dan komunitas dihitung oleh layanan rekomendasi TemuBaca di FastAPI Cloud (region Amerika Serikat): yang dikirim hanya minat bacaan yang kamu simpan dan, untuk rekomendasi komunitas, kode kabupaten/kota di profilmu bila kamu mengisinya. Nama, surel, identitas akun, dan lokasi presisi tidak dikirim.</p>
            </PolicySection>

            <PolicySection title="Berapa lama data disimpan">
                <ul>
                    <li>Setelah kamu meminta penghapusan akun, ada masa tenggang 14 hari untuk membatalkan. Setelah itu bookmark, minat, listing tanpa riwayat, dan keanggotaan dihapus. Namamu di riwayat pinjam, laporan, dan catatan pengelola diganti menjadi “Akun dihapus”.</li>
                    <li>Detail laporan yang sudah diputus dihapus setelah 12 bulan.</li>
                    <li>Riwayat pinjaman yang selesai, catatan tindakan pengelola, dan bukti komunitas yang sudah ditinjau dihapus setelah 24 bulan.</li>
                    <li>Cadangan database mengikuti kebijakan bawaan Supabase.</li>
                </ul>
            </PolicySection>

            <PolicySection title="Hakmu atas data">
                <ul>
                    <li>Mengubah nama dan minat di <Link href="/profile" className="font-semibold text-primary hover:underline">Profil</Link>.</li>
                    <li>Mengunduh salinan datamu dalam format JSON dan menghapus akun dari pengaturan profil.</li>
                    <li>Menghapus semua bookmark dan minat sekaligus di tab Kendali Data Saya pada halaman Bookmark.</li>
                </ul>
            </PolicySection>

            <PolicySection title="Pengguna di bawah 18 tahun">
                <p>TemuBaca terbuka untuk usia 13 tahun ke atas. Pengguna yang belum 18 tahun sebaiknya memakai TemuBaca dengan sepengetahuan orang tua atau wali, dan selalu bertemu di ruang publik. Orang tua atau wali yang ingin akun anaknya dihapus dapat menghubungi kami lewat halaman <Link href="/help" className="font-semibold text-primary hover:underline">Bantuan</Link>.</p>
            </PolicySection>

            <PolicySection title="Cookie">
                <p>TemuBaca hanya memakai cookie yang diperlukan agar kamu tetap masuk (sesi autentikasi dan pilihan “Ingat saya”). Tidak ada cookie iklan atau analitik.</p>
            </PolicySection>
        </PolicyPage>
    );
}
