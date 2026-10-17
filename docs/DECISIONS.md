# DECISIONS — Catatan Keputusan dan Pertanyaan Terbuka

Status awal: semua butir di bawah belum mendapat keputusan eksplisit dalam sumber yang dapat dibaca. Pemilik dan tanggal keputusan perlu diisi tim.

| ID | Pertanyaan | Dampak | Status |
|---|---|---|---|
| DEC-01 | Platform mana yang menjadi sumber autentikasi, hosting, dan database final? | Arsitektur, biaya, akses | Terbuka |
| DEC-02 | Apa aturan lengkap siklus pinjam, tenggat, pembatalan, pengembalian, kerusakan, dan sengketa? | Data, UI, keselamatan | Diputuskan pemilik repo, 18 Okt 2026 (lihat di bawah); perpanjangan pinjaman masih terbuka |
| DEC-03 | Merchandise MVP berupa katalog dengan transaksi di luar platform atau checkout/pesanan di TemuBaca? | Scope, pembayaran, hukum, operasional, data alamat | Terbuka; checkout diblokir |
| DEC-04 | Siapa yang boleh membuat/mengelola komunitas dan bagaimana verifikasinya? | Role, moderasi, kualitas data | Terbuka |
| DEC-05 | Apakah acara/komunitas/merchandise dimoderasi sebelum publikasi? | Alur admin dan waktu tayang | Terbuka |
| DEC-06 | Provider katalog buku final dan aturan penggunaan/atribusi apa? | Kelengkapan, cache, legalitas | Sebagian: pemilik repo (17 Okt 2026) memilih Open Library sebagai sumber utama dan Google Books sebagai pelengkap; adapter dipakai untuk sinkron ulang oleh admin. Aturan atribusi tampilan, cache, dan kuota production masih terbuka |
| DEC-07 | Provider peta, geocoding, dan kebijakan lokasi apa? | Biaya, privasi, akurasi | Leaflet/OSM kandidat |
| DEC-08 | Apakah rekomendasi MVP perlu layanan ML terpisah, atau cukup baseline di aplikasi? | Kompleksitas dan deployment | Python/FastAPI kandidat |
| DEC-09 | Target pengguna/usia, wilayah peluncuran, serta kebutuhan bahasa? | UX dan kebijakan | Sasaran 18–25 tercatat; belum dikunci |
| DEC-10 | Tanggal, target kompetisi/demo, dan metrik keberhasilan? | Prioritas dan release | Belum tersedia |
| DEC-11 | Retensi, penghapusan akun, backup, dukungan dan penanganan laporan? | Produksi dan kepatuhan | Terbuka |
| DEC-12 | Harga merchandise, stok, varian, pengiriman dan hubungan penjual-pembeli? | Model listing/checkout | Terbuka |
| DEC-13 | Bagaimana memodelkan ketersediaan buku di perpustakaan secara terpisah dari akses yang diberikan setelah permintaan pinjam? Tetapkan sumber data, pemilik pembaruan, status, kesegaran, dan penanganan duplikasi. | Skema, integrasi, akurasi UI, privasi dan operasional | Terbuka; TB-023 diblokir |

Catat keputusan dengan format: **keputusan; konteks; opsi yang dipertimbangkan; alasan; pemilik; tanggal; dampak pada dokumen/task**. Setelah diputuskan, perbarui dokumen terkait dan tandai task yang diblokir. Jangan menyimpulkan keputusan dari teknologi kandidat atau narasi kompetisi di dokumen lama.

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
