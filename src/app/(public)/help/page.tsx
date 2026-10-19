import type { Metadata } from "next";
import Link from "next/link";

import { PolicyPage, PolicySection } from "@/features/policies/components/policy-page";

export const metadata: Metadata = { title: "Bantuan", description: "Cara mendapat bantuan, melaporkan masalah, dan menghubungi pengelola TemuBaca." };

/** DEC-11 support channel: in-app reports now; the support email is added once a custom domain exists. */
export default function HelpPage() {
    return (
        <PolicyPage
            eyebrow="Bantuan"
            title="Pusat Bantuan"
            current="/help"
            intro={<p>Ada kendala atau perlu melaporkan sesuatu? Laporan di aplikasi adalah cara tercepat agar pengelola TemuBaca menindaklanjuti. Kami berusaha membalas dalam 3 hari kerja.</p>}
        >
            <PolicySection title="Melaporkan konten atau pengguna">
                <ul>
                    <li>Buka halaman buku, listing, komunitas, acara, atau merchandise yang bermasalah, lalu pilih “Laporkan”.</li>
                    <li>Pilih alasan dan jelaskan singkat. Pengelola meninjau setiap laporan; laporan tidak langsung menyembunyikan konten.</li>
                </ul>
            </PolicySection>

            <PolicySection title="Masalah pinjaman">
                <p>Buka <Link href="/my-listings?tab=peminjaman" className="font-semibold text-primary hover:underline">Buku Saya → Peminjaman</Link>, lalu pilih “Laporkan Masalah” pada pinjaman yang bersangkutan. Pinjaman terkunci sampai pengelola memutuskan.</p>
            </PolicySection>

            <PolicySection title="Akun dan data">
                <ul>
                    <li>Lupa kata sandi: pilih “Lupa kata sandi?” di halaman <Link href="/login" className="font-semibold text-primary hover:underline">Masuk</Link>.</li>
                    <li>Unduh salinan data atau hapus akun dari halaman <Link href="/profile" className="font-semibold text-primary hover:underline">Profil</Link>.</li>
                    <li>Listing yang disembunyikan pengelola dapat diajukan banding dari Buku Saya.</li>
                </ul>
            </PolicySection>

            <PolicySection title="Hubungi kami">
                <p>Alamat surel dukungan akan dicantumkan di sini setelah domain TemuBaca tersedia. Sampai saat itu, gunakan laporan di aplikasi.</p>
            </PolicySection>
        </PolicyPage>
    );
}
