import type { Metadata } from "next";
import Link from "next/link";

import { PolicyPage, PolicySection } from "@/features/policies/components/policy-page";

export const metadata: Metadata = { title: "Panduan Keamanan", description: "Cara aman bertemu, meminjam buku, dan membeli merchandise komunitas lewat TemuBaca." };

export default function SafetyPage() {
    return (
        <PolicyPage
            eyebrow="Panduan"
            title="Panduan Keamanan"
            current="/safety"
            intro={<p>Pinjam-meminjam di TemuBaca berarti bertemu orang yang belum kamu kenal. Panduan ini membantu agar setiap pertemuan tetap aman dan nyaman.</p>}
        >
            <PolicySection title="Sebelum bertemu">
                <ul>
                    <li>Pilih titik temu publik yang ramai, seperti perpustakaan, taman kota, atau kafe. Jangan pernah bertemu di rumah.</li>
                    <li>Jangan bagikan alamat rumah, nomor identitas, atau data rekening.</li>
                    <li>Atur waktu bertemu pada siang atau sore hari, dan beri tahu orang terdekat ke mana kamu pergi.</li>
                </ul>
            </PolicySection>

            <PolicySection title="Untuk pengguna di bawah 18 tahun">
                <ul>
                    <li>Beri tahu orang tua atau wali sebelum meminjam atau meminjamkan buku.</li>
                    <li>Ajak orang tua, wali, atau teman saat bertemu.</li>
                    <li>Tolak ajakan berpindah ke tempat sepi atau ke percakapan pribadi yang membuatmu tidak nyaman, lalu laporkan.</li>
                </ul>
            </PolicySection>

            <PolicySection title="Saat serah terima">
                <ul>
                    <li>Periksa kondisi buku bersama, lalu konfirmasi serah terima di aplikasi. Pinjaman baru berjalan setelah kedua pihak mengonfirmasi.</li>
                    <li>Lakukan hal yang sama saat buku dikembalikan.</li>
                </ul>
            </PolicySection>

            <PolicySection title="Membeli merchandise komunitas">
                <ul>
                    <li>Hubungi komunitas hanya lewat kontak yang tercantum di halaman item atau profil komunitas terverifikasi.</li>
                    <li>Pastikan tujuan pembayaran atas nama komunitas. Waspadai pihak yang mengaku pengurus lewat kontak lain.</li>
                </ul>
            </PolicySection>

            <PolicySection title="Bila ada masalah">
                <ul>
                    <li>Untuk pinjaman yang bermasalah, pakai “Laporkan Masalah” di Buku Saya. Pengelola akan meninjau bersama kedua pihak.</li>
                    <li>Untuk akun, listing, komunitas, atau acara yang mencurigakan, pakai tombol “Laporkan” di halamannya.</li>
                    <li>Bila kamu dalam bahaya, segera hubungi 112 atau pihak berwenang terdekat. TemuBaca tidak dapat memberi bantuan darurat.</li>
                </ul>
                <p>Info lain ada di halaman <Link href="/help" className="font-semibold text-primary hover:underline">Bantuan</Link>.</p>
            </PolicySection>
        </PolicyPage>
    );
}
