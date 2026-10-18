# DECISIONS — Catatan Keputusan dan Pertanyaan Terbuka

Status awal: semua butir di bawah belum mendapat keputusan eksplisit dalam sumber yang dapat dibaca. Pemilik dan tanggal keputusan perlu diisi tim.

| ID | Pertanyaan | Dampak | Status |
|---|---|---|---|
| DEC-01 | Platform mana yang menjadi sumber autentikasi, hosting, dan database final? | Arsitektur, biaya, akses | Diputuskan pemilik repo, 18 Okt 2026 (lihat di bawah); paket production, domain, dan backup masih terbuka |
| DEC-02 | Apa aturan lengkap siklus pinjam, tenggat, pembatalan, pengembalian, kerusakan, dan sengketa? | Data, UI, keselamatan | Diputuskan pemilik repo, 18 Okt 2026 (lihat di bawah); perpanjangan pinjaman masih terbuka |
| DEC-03 | Merchandise MVP berupa katalog dengan transaksi di luar platform atau checkout/pesanan di TemuBaca? | Scope, pembayaran, hukum, operasional, data alamat | Terbuka; checkout diblokir |
| DEC-04 | Siapa yang boleh membuat/mengelola komunitas dan bagaimana verifikasinya? | Role, moderasi, kualitas data | Diputuskan pemilik repo, 18 Okt 2026 (lihat di bawah) |
| DEC-05 | Apakah acara/komunitas/merchandise dimoderasi sebelum publikasi? | Alur admin dan waktu tayang | Diputuskan pemilik repo, 18 Okt 2026: komunitas baru ditinjau; konten komunitas terverifikasi langsung tampil |
| DEC-06 | Provider katalog buku final dan aturan penggunaan/atribusi apa? | Kelengkapan, cache, legalitas | Sebagian: pemilik repo (17 Okt 2026) memilih Open Library sebagai sumber utama dan Google Books sebagai pelengkap; adapter dipakai untuk sinkron ulang oleh admin. Aturan atribusi tampilan, cache, dan kuota production masih terbuka |
| DEC-07 | Provider peta, geocoding, dan kebijakan lokasi apa? | Biaya, privasi, akurasi | Leaflet/OSM kandidat |
| DEC-08 | Apakah rekomendasi MVP perlu layanan ML terpisah, atau cukup baseline di aplikasi? | Kompleksitas dan deployment | Python/FastAPI kandidat |
| DEC-09 | Target pengguna/usia, wilayah peluncuran, serta kebutuhan bahasa? | UX dan kebijakan | Sasaran 18–25 tercatat; belum dikunci |
| DEC-10 | Tanggal, target kompetisi/demo, dan metrik keberhasilan? | Prioritas dan release | Belum tersedia |
| DEC-11 | Retensi, penghapusan akun, backup, dukungan dan penanganan laporan? | Produksi dan kepatuhan | Diputuskan pemilik repo, 18 Okt 2026 untuk penghapusan akun, ekspor, dan retensi (lihat di bawah); kanal dukungan dan backup production masih terbuka |
| DEC-12 | Harga merchandise, stok, varian, pengiriman dan hubungan penjual-pembeli? | Model listing/checkout | Terbuka |
| DEC-13 | Bagaimana memodelkan ketersediaan buku di perpustakaan secara terpisah dari akses yang diberikan setelah permintaan pinjam? Tetapkan sumber data, pemilik pembaruan, status, kesegaran, dan penanganan duplikasi. | Skema, integrasi, akurasi UI, privasi dan operasional | Terbuka; TB-023 diblokir |

Catat keputusan dengan format: **keputusan; konteks; opsi yang dipertimbangkan; alasan; pemilik; tanggal; dampak pada dokumen/task**. Setelah diputuskan, perbarui dokumen terkait dan tandai task yang diblokir. Jangan menyimpulkan keputusan dari teknologi kandidat atau narasi kompetisi di dokumen lama.

## DEC-01 — Hosting, auth, dan database (diputuskan 18 Okt 2026)

- **Keputusan:**
  - Aplikasi Next.js di-hosting di **Vercel**.
  - Auth, Postgres, dan Storage tetap di **Supabase**.
  - Staging memakai **project Supabase terpisah** dengan migrasi yang sama, plus deploy Vercel staging sendiri. Data staging tidak bercampur dengan dev atau production.
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
  - Masih terbuka: paket Vercel dan Supabase production, domain, dan jangka waktu backup.

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
  - "Perpanjang" dari Figma belum dibuat karena aturan perpanjangan belum diputuskan.

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
  - Kanal dukungan pengguna dan SLA penanganan laporan belum diputuskan.
