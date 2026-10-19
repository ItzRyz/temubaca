# DECISIONS — Catatan Keputusan dan Pertanyaan Terbuka

Status awal: semua butir di bawah belum mendapat keputusan eksplisit dalam sumber yang dapat dibaca. Pemilik dan tanggal keputusan perlu diisi tim.

| ID | Pertanyaan | Dampak | Status |
|---|---|---|---|
| DEC-01 | Platform mana yang menjadi sumber autentikasi, hosting, dan database final? | Arsitektur, biaya, akses | Diputuskan pemilik repo, 18 Okt 2026 (lihat di bawah), termasuk paket gratis, domain `temubaca.vercel.app`, dan backup bawaan Supabase sampai sebelum peluncuran publik |
| DEC-02 | Apa aturan lengkap siklus pinjam, tenggat, pembatalan, pengembalian, kerusakan, dan sengketa? | Data, UI, keselamatan | Diputuskan pemilik repo, 18 Okt 2026 (lihat di bawah), termasuk perpanjangan satu kali |
| DEC-03 | Merchandise MVP berupa katalog dengan transaksi di luar platform atau checkout/pesanan di TemuBaca? | Scope, pembayaran, hukum, operasional, data alamat | Diputuskan pemilik repo, 18 Okt 2026: katalog saja, transaksi di luar TemuBaca (lihat di bawah) |
| DEC-04 | Siapa yang boleh membuat/mengelola komunitas dan bagaimana verifikasinya? | Role, moderasi, kualitas data | Diputuskan pemilik repo, 18 Okt 2026 (lihat di bawah) |
| DEC-05 | Apakah acara/komunitas/merchandise dimoderasi sebelum publikasi? | Alur admin dan waktu tayang | Diputuskan pemilik repo, 18 Okt 2026: komunitas baru ditinjau; konten komunitas terverifikasi langsung tampil |
| DEC-06 | Provider katalog buku final dan aturan penggunaan/atribusi apa? | Kelengkapan, cache, legalitas | Sebagian: pemilik repo (17 Okt 2026) memilih Open Library sebagai sumber utama dan Google Books sebagai pelengkap; adapter dipakai untuk sinkron ulang oleh admin. Atribusi dan sinkron ulang otomatis diputuskan 18 Okt 2026 (lihat di bawah); kuota production masih terbuka |
| DEC-07 | Provider peta, geocoding, dan kebijakan lokasi apa? | Biaya, privasi, akurasi | Terbuka. Pemilik repo belum punya preferensi (18 Okt 2026). Leaflet/OSM dengan lokasi tingkat kecamatan/kota tetap kandidat |
| DEC-08 | Apakah rekomendasi MVP perlu layanan ML terpisah, atau cukup baseline di aplikasi? | Kompleksitas dan deployment | Terbuka. Pemilik repo belum punya preferensi (18 Okt 2026). Baseline di aplikasi (TB-040) tetap berjalan; Python/FastAPI kandidat |
| DEC-09 | Target pengguna/usia, wilayah peluncuran, serta kebutuhan bahasa? | UX dan kebijakan | Diputuskan pemilik repo, 18 Okt 2026: semua usia 13+, seluruh Indonesia (lihat di bawah) |
| DEC-10 | Tanggal, target kompetisi/demo, dan metrik keberhasilan? | Prioritas dan release | Tanggal diputuskan pemilik repo, 18 Okt 2026: 30 Okt 2026 dengan fitur lengkap (lihat di bawah); metrik keberhasilan masih terbuka |
| DEC-11 | Retensi, penghapusan akun, backup, dukungan dan penanganan laporan? | Produksi dan kepatuhan | Diputuskan pemilik repo, 18 Okt 2026 untuk penghapusan akun, ekspor, dan retensi (lihat di bawah); kanal dukungan (surel + laporan di aplikasi) dan backup diputuskan 18 Okt 2026 |
| DEC-12 | Harga merchandise, stok, varian, pengiriman dan hubungan penjual-pembeli? | Model listing/checkout | Diputuskan pemilik repo, 18 Okt 2026 (lihat bersama DEC-03 di bawah) |
| DEC-13 | Bagaimana memodelkan ketersediaan buku di perpustakaan secara terpisah dari akses yang diberikan setelah permintaan pinjam? Tetapkan sumber data, pemilik pembaruan, status, kesegaran, dan penanganan duplikasi. | Skema, integrasi, akurasi UI, privasi dan operasional | Arah diputuskan pemilik repo, 18 Okt 2026: integrasi katalog perpustakaan (lihat di bawah). TB-023 tetap tertahan sampai riset sumber data selesai |

Catat keputusan dengan format: **keputusan; konteks; opsi yang dipertimbangkan; alasan; pemilik; tanggal; dampak pada dokumen/task**. Setelah diputuskan, perbarui dokumen terkait dan tandai task yang diblokir. Jangan menyimpulkan keputusan dari teknologi kandidat atau narasi kompetisi di dokumen lama.

## DEC-01 — Hosting, auth, dan database (diputuskan 18 Okt 2026)

- **Keputusan:**
  - Aplikasi Next.js di-hosting di **Vercel**.
  - Auth, Postgres, dan Storage tetap di **Supabase**.
  - Staging memakai **project Supabase terpisah** dengan migrasi yang sama, plus deploy Vercel staging sendiri. Data staging tidak bercampur dengan dev atau production.
  - **Revisi 18 Okt 2026 (paket gratis Supabase, dua project):** project cloud yang ada menjadi production. Dev dan E2E berjalan di Supabase lokal (Docker, `supabase start` + `bun run db:local`). Staging di project cloud kedua bersifat opsional, dan dibuat bila perlu menguji preview deploy terhadap DB terpisah.
  - Region **Singapura** untuk keduanya: fungsi Vercel di `sin1` (`regions` di `vercel.json`) dan project Supabase staging/production di `ap-southeast-1`. Fungsi dan database berada di region yang sama.
  - Tugas retensi harian dijalankan **Vercel Cron** (`vercel.json`, pukul 19.00 UTC = 02.00 WIB). Cron memanggil `GET /api/internal/retention` dengan `Authorization: Bearer $CRON_SECRET`.
- **Konteks:** DEC-01 memblokir staging, deployment, penjadwal retensi, dan konfigurasi koneksi production (TB-044, TB-048 s.d. TB-050).
- **Opsi yang dipertimbangkan:**
  - Hosting: Vercel, VPS/Docker (Railway, Fly.io, VPS sendiri), atau Cloudflare/Netlify lewat adapter.
  - Auth/DB: tetap Supabase, atau ganti sebagian (Postgres atau auth lain).
  - Staging: project Supabase terpisah, Supabase Branching, atau memakai project dev.
  - Penjadwal: cron hosting, Supabase `pg_cron`, atau GitHub Actions.
- **Alasan:**
  - Vercel mendukung fitur Next.js 16 yang dipakai (proxy, RSC, server actions) tanpa adapter.
  - Supabase sudah dipakai dan teruji, jadi tidak perlu migrasi.
  - Project staging terpisah memenuhi syarat TB-050 (layanan terpisah).
  - Cron ikut hosting, jadi tidak ada layanan tambahan.
- **Pemilik:** pemilik repo.
- **Tanggal:** 18 Okt 2026.
- **Dampak:**
  - Fungsi Vercel bersifat serverless. `DATABASE_URL` runtime memakai pooler Supabase mode transaksi (port 6543), dengan `DATABASE_POOL_MAX` kecil (mis. 3). `DIRECT_URL` (koneksi langsung atau mode sesi) dipakai untuk migrasi.
  - `vercel.json` berisi jadwal cron. `GET /api/internal/retention` disembunyikan (404) tanpa `CRON_SECRET`.
  - Region Supabase tidak bisa diubah setelah project dibuat, jadi pilih `ap-southeast-1` saat membuat project staging dan production.
  - **Paket production (18 Okt 2026):** tetap Vercel Hobby dan Supabase Free, dengan domain `temubaca.vercel.app` dan backup bawaan Supabase. Keputusan ini ditinjau ulang sebelum peluncuran publik.
  - Opsi yang dipertimbangkan: membeli domain sendiri, atau naik ke Supabase Pro (backup harian, tanpa jeda proyek) dan Vercel Pro.
  - Risiko yang diterima: project Supabase Free dapat dijeda bila tidak aktif, dan backup bawaan paket gratis terbatas.

## DEC-02 — Siklus pinjam (diputuskan 18 Okt 2026)

- **Keputusan:**
  - Peminjam mengajukan permintaan dengan titik temu dari daftar pemilik, lama pinjam 7/14/21/30 hari (maksimal sesuai aturan listing), waktu bertemu opsional, dan pesan.
  - Pemilik menerima, atau menolak dengan alasan dari daftar tetap.
  - Menerima satu permintaan membuat salinan `RESERVED`, dan permintaan lain yang menunggu otomatis ditolak ("Buku sedang tidak tersedia").
  - Peminjam dapat membatalkan selama permintaan belum ditanggapi. Setelah diterima, kedua pihak dapat membatalkan sebelum serah terima.
  - **Serah terima dan pengembalian dikonfirmasi kedua pihak.** Pinjaman baru berjalan, atau selesai, setelah dua konfirmasi.
  - Tenggat dihitung dari serah terima. Pinjaman yang lewat tenggat tampil "Terlambat N hari", dan pemilik dapat mengirim pengingat di aplikasi (sekali per 24 jam). Tidak ada denda.
  - Kerusakan, kehilangan, buku tidak dikembalikan, atau masalah lain dilaporkan salah satu pihak lewat "Laporkan Masalah". Pinjaman menjadi `DISPUTED` dan terkunci sampai admin memutuskan Dikembalikan (salinan `AVAILABLE`) atau Hilang (salinan `UNAVAILABLE`). Keputusan ini tercatat di riwayat pinjaman dan `admin_audit_logs`.
  - Tidak ada ganti rugi uang di platform.
- **Konteks:** frame Figma Ajukan Pinjam (`299:2608`), Buku Saya - Peminjaman (`297:2494`, `298:2551`), dan Tolak Permintaan (`300:2608`).
- **Opsi yang dipertimbangkan:**
  - Konfirmasi oleh pemilik saja, atau oleh kedua pihak.
  - Antrean satu permintaan per buku.
  - Lama pinjam tetap.
  - Penundaan alur sengketa.
- **Alasan:** konfirmasi dua pihak memberi bukti yang lebih kuat bila terjadi sengketa. Alur lainnya mengikuti pola Figma.
- **Pemilik:** pemilik repo.
- **Tanggal:** 18 Okt 2026.
- **Dampak:**
  - Migrasi `0008_borrowing_lifecycle` dan tabel riwayat `borrow_events`.
  - Endpoint `/api/borrow-requests`, `/api/borrowings`, dan `/api/admin/borrowings`.
  - TB-025 tidak lagi tertahan.
  - **Perpanjangan (18 Okt 2026):** peminjam dapat mengajukan perpanjangan **satu kali** selama pinjaman berjalan dan sebelum tenggat. Pemilik menerima atau menolak. Tambahan waktu maksimal 14 hari dari tenggat lama. Opsi yang dipertimbangkan: tanpa perpanjangan, atau berkali-kali dengan persetujuan pemilik. Dibuat lewat migrasi `0013_loan_extension` (kolom `extension*` di `borrowings`, event `EXTENSION_*`), aksi `request_extension`/`approve_extension`/`reject_extension` di `PATCH /api/borrowings/[borrowingId]`, dan tombol "Perpanjang" di Buku Saya - Peminjaman.

## DEC-04 dan DEC-05 — Pengelolaan dan verifikasi komunitas (diputuskan 18 Okt 2026)

- **Keputusan:**
  - Setiap akun yang masuk dapat mengajukan komunitas: nama, deskripsi, wilayah dan titik pertemuan publik, surel kontak, Instagram/WhatsApp opsional, serta tautan bukti aktivitas (wajib) dengan catatan atau berkas opsional (PDF/JPG/PNG, maks. 5 MB).
  - Komunitas berstatus `PENDING` sampai admin menyetujuinya di Peninjauan. Satu akun maksimal punya 3 pengajuan yang menunggu. Pengajuan yang ditolak dapat dikirim ulang dengan bukti baru.
  - Pemilik mengubah profil dan kontak, mengundang pengurus lewat tautan sekali pakai (berlaku 7 hari, dapat dicabut), mencabut pengurus, dan mengajukan pembaruan verifikasi.
  - Pengurus mengelola acara dan merchandise.
  - Komunitas `VERIFIED` menerbitkan acara, merchandise, dan perubahan profil tanpa tinjauan lebih dulu. Pengawasan dilakukan lewat laporan pengguna, dan admin tetap dapat menangguhkan komunitas.
  - Pembaruan verifikasi tidak menurunkan status. Admin hanya mengonfirmasi (tanggal persetujuan diperbarui) atau mengabaikannya dengan alasan.
  - Berkas bukti disimpan di bucket Supabase Storage privat `community-evidence` dan hanya dapat dibuka pemilik atau admin lewat URL bertanda tangan 60 detik.
- **Konteks:** frame Figma Kelola Komunitas (`25:5622`), Acara (`293:2321`, `293:2789`), dan Merchandise (`308:2665`, `309:2665`, `309:2922`, `309:3271`).
- **Opsi yang dipertimbangkan:**
  - Komunitas hanya dibuat admin.
  - Pengelolaan oleh pemilik saja.
  - Bukti berupa tautan saja.
  - Moderasi setiap acara dan merchandise sebelum terbit.
- **Pemilik:** pemilik repo.
- **Tanggal:** 18 Okt 2026.
- **Dampak:**
  - Migrasi `0009_community_management` menambah tabel `community_submissions` dan `community_invites`, kolom kontak komunitas, lokasi acara (fisik/daring, nama tempat), serta kategori, keterangan stok, dan kontak khusus merchandise.
  - Endpoint baru di `/api/communities/...`, `/api/community-invites/accept`, dan `/api/admin/community-submissions/[submissionId]`.
  - TB-030, TB-032, dan TB-033 dapat dikerjakan.
  - Unggah logo dan foto merchandise belum dibuat; hanya berkas bukti yang disimpan.

## DEC-03 dan DEC-12 — Merchandise (diputuskan 18 Okt 2026)

- **Keputusan:**
  - Merchandise MVP berupa **katalog saja**. Transaksi terjadi di luar TemuBaca. Platform tidak menerima pembayaran, tidak menyimpan alamat, dan tidak mencatat pesanan.
  - Setiap listing memuat:
    - kontak yang dapat dihubungi untuk transaksi/pembelian;
    - harga (tetap, atau tanpa harga tetap) dan status stok;
    - varian (mis. ukuran atau warna) sebagai teks, tanpa stok per varian;
    - catatan pengiriman atau pengambilan (mis. COD, ambil di acara, kirim);
    - foto, maksimal 3 per item, disimpan di Supabase Storage.
- **Konteks:** TB-033 dan TB-034 sudah menampilkan katalog dengan kontak pembelian dan pernyataan bahwa transaksi terjadi di luar TemuBaca.
- **Opsi yang dipertimbangkan:**
  - Checkout di TemuBaca (gateway pembayaran, alamat, status pesanan, refund).
  - Katalog dulu, checkout sesudah MVP.
- **Alasan:** checkout butuh gateway pembayaran, data alamat, dan kajian hukum, yang tidak sepadan untuk MVP.
- **Pemilik:** pemilik repo.
- **Tanggal:** 18 Okt 2026.
- **Dampak:**
  - Checkout dan pembayaran tetap di luar cakupan.
  - Dibuat lewat migrasi `0014_merchandise_details` (`variants`, `fulfillmentNote`, `photoPaths` maks. 3), bucket publik `merchandise-photos` (dibuat otomatis saat unggah pertama, JPG/PNG/WebP maks. 2 MB), endpoint `POST /api/communities/[communityId]/merchandise/photos`, dan form Kelola Merchandise.
  - Foto yang diunggah tetapi tidak jadi disimpan tetap tertinggal di bucket; belum ada pembersihan otomatis.

## DEC-06 — Atribusi dan sinkron katalog (diputuskan 18 Okt 2026)

- **Keputusan:**
  - Detail buku menampilkan sumber rekaman ("Sumber: Open Library" atau "Sumber: Google Books") dengan tautan ke halaman rekaman di provider.
  - Metadata disimpan di DB. Sampul diambil langsung dari URL provider.
  - Rekaman disinkron ulang **otomatis secara berkala** (bulanan) lewat cron, selain sinkron manual oleh admin.
- **Opsi yang dipertimbangkan:** atribusi dengan sinkron manual saja.
- **Pemilik:** pemilik repo.
- **Tanggal:** 18 Okt 2026.
- **Dampak:**
  - Dibuat 19 Okt 2026:
    - Tautan sumber di detail buku menuju rekaman provider pemilik rekaman (`openlibrary.org/works/<id>` atau `books.google.com/books?id=<id>`). Provider yang hanya melengkapi data ditautkan ke situsnya.
    - Sinkron ulang berkala ikut cron harian `GET /api/internal/retention` (Vercel Hobby hanya mengizinkan cron harian). Setiap hari maks. 12 rekaman Open Library/Google Books yang lebih tua dari ambang "usang" di Pengaturan (bawaan 30 hari) disinkron, yang tertua dulu. Dengan 330 buku, setiap rekaman tersegarkan kira-kira sebulan sekali.
    - Rekaman yang gagal disinkron tidak dicoba lagi selama 7 hari. Rekaman manual tidak disinkron otomatis.
    - Log memakai pemicu `SCHEDULED` (migrasi `0015_scheduled_book_sync`) tanpa aktor.
  - Kuota Google Books production masih terbuka.

## DEC-09 — Target pengguna dan wilayah (diputuskan 18 Okt 2026)

- **Keputusan:** pengguna **semua usia 13 tahun ke atas**, wilayah **seluruh Indonesia**, antarmuka berbahasa Indonesia.
- **Opsi yang dipertimbangkan:** usia 18–25 di Jabodetabek, atau usia 18–25 di seluruh Indonesia.
- **Pemilik:** pemilik repo.
- **Tanggal:** 18 Okt 2026.
- **Dampak:**
  - Pengguna di bawah umur perlu kebijakan tambahan: batas usia minimal saat daftar, kebijakan privasi dan syarat layanan untuk anak, serta panduan keamanan bertemu langsung saat pinjam-meminjam.
  - Pemilihan lokasi dan peta (DEC-07) harus mencakup seluruh Indonesia.

## DEC-10 — Target rilis (diputuskan 18 Okt 2026)

- **Keputusan:** demo/rilis pada **30 Okt 2026 dengan fitur lengkap**.
- **Opsi yang dipertimbangkan:** belum ditetapkan, dalam 1 bulan, atau dalam 3 bulan.
- **Pemilik:** pemilik repo.
- **Tanggal:** 18 Okt 2026.
- **Dampak:**
  - Sisa waktu 12 hari. Fitur yang masih tertahan keputusan atau riset (peta DEC-07, ketersediaan perpustakaan DEC-13) berisiko tidak selesai dan perlu diprioritaskan atau disepakati ulang.
  - Metrik keberhasilan masih terbuka.

## DEC-11 (lanjutan) — Kanal dukungan (diputuskan 18 Okt 2026)

- **Keputusan:**
  - Dukungan lewat **surel** yang ditampilkan di halaman bantuan, ditambah laporan di aplikasi yang sudah ada.
  - Target balasan 3 hari kerja.
  - Alamat surel memakai domain sendiri (mis. `halo@<domain>`) dan dipasang setelah domain tersedia. Selama production memakai `temubaca.vercel.app`, alamatnya belum ditetapkan.
- **Opsi yang dipertimbangkan:** WhatsApp ditambah surel, atau laporan di aplikasi saja.
- **Pemilik:** pemilik repo.
- **Tanggal:** 18 Okt 2026.

## DEC-13 — Ketersediaan buku di perpustakaan (arah diputuskan 18 Okt 2026)

- **Keputusan:** ketersediaan perpustakaan diambil lewat **integrasi katalog perpustakaan** (mis. OPAC atau iPusnas) bila API atau sumber data terbuka tersedia. Datanya disimpan di model tersendiri, terpisah dari `book_accesses`.
- **Opsi yang dipertimbangkan:**
  - Daftar yang dikurasi admin, dengan tanggal "terakhir dicek".
  - Menunda dan menyembunyikan bagian perpustakaan.
- **Pemilik:** pemilik repo.
- **Tanggal:** 18 Okt 2026.
- **Dampak:**
  - Perlu riset dulu: perpustakaan mana yang punya API atau ekspor terbuka, syarat penggunaannya, dan kebutuhan izin atau perjanjian.
  - Sumber data, status, kesegaran, dan penanganan duplikasi ditetapkan setelah riset itu.
  - TB-023 tetap tertahan sampai sumber data pertama tersedia. Sampai saat itu, bagian perpustakaan tetap ditandai belum tersedia.

## DEC-11 — Penghapusan akun, ekspor, dan retensi (diputuskan 18 Okt 2026)

- **Keputusan:**
  - "Hapus Akun Saya" (konfirmasi dengan mengetik HAPUS) langsung menonaktifkan akun: akun menjadi baca-saja, listing disembunyikan, permintaan pinjam yang menunggu dibatalkan atau ditolak, dan status menjadi "Menunggu Penghapusan".
  - Selama 14 hari pengguna dapat membatalkan setelah masuk lagi. Setelah itu tugas retensi menghapus bookmark, minat, listing tanpa riwayat, keanggotaan, dan komunitas yang belum terverifikasi. Listing dengan riwayat pinjam disembunyikan dan dibersihkan dari lokasi dan aturan. Nama di riwayat pinjam, laporan, dan jejak audit diganti "Akun dihapus", lalu pengguna Supabase Auth dihapus.
  - Penghapusan ditolak selama masih ada pinjaman yang diterima, berjalan, atau dalam sengketa, atau selama pengguna memiliki komunitas terverifikasi. Kepemilikan dapat diserahkan ke pengurus aktif lewat menu Pengurus, atau admin diminta menangguhkan komunitasnya.
  - Pengguna dapat mengunduh salinan datanya dalam JSON (maks. 3 kali per jam).
  - Retensi: detail laporan yang sudah diputus dihapus setelah 12 bulan. Jejak audit admin, riwayat pinjaman yang selesai, dan bukti komunitas yang sudah ditinjau dihapus setelah 24 bulan.
  - Backup mengikuti kebijakan bawaan Supabase.
- **Konteks:** frame Figma Dialog Hapus Akun (`210:1145`), statistik "Menunggu Penghapusan" di Data Pengguna (`147:807`), dan bagian Retensi & Data di Pengaturan (`161:859`).
- **Opsi yang dipertimbangkan:**
  - Hapus langsung tanpa masa tenggang.
  - Anonimkan tanpa syarat (pinjaman dibatalkan dan komunitas ditangguhkan otomatis).
  - Tanpa ekspor.
  - Simpan tanpa batas.
- **Pemilik:** pemilik repo.
- **Tanggal:** 18 Okt 2026.
- **Dampak:**
  - Migrasi `0010_account_deletion_and_retention`.
  - Endpoint `/api/me/account-deletion`, `/api/me/export`, `/api/admin/retention`, `/api/internal/retention`, dan `/api/communities/[communityId]/owner`.
  - Penjadwal harian: Vercel Cron (DEC-01).
  - Kanal dukungan dan SLA: lihat DEC-11 (lanjutan) di atas.
