# Product Requirements Document — TemuBaca

**Versi:** 2.0 • **Status:** Draft kerja • **Platform:** Web application

## 1. Ringkasan

TemuBaca membantu orang menemukan buku, mencari cara mengakses buku fisik, dan terhubung dengan komunitas serta kegiatan literasi di sekitarnya. Platform juga memberi komunitas literasi ruang untuk menawarkan merchandise kepada pengunjung. Jual-beli merchandise merupakan kemampuan komunitas; rincian pembayaran, pengiriman, dan penanganan sengketa masih harus diputuskan sebelum transaksi daring diaktifkan.

Alur nilai: **Temukan buku → Cari akses → Baca/berbagi → Temukan komunitas dan kegiatan → Dukung komunitas**.

## 2. Masalah dan tujuan

Informasi buku, perpustakaan, peminjaman antaranggota, komunitas, dan acara sering berada di kanal berbeda. Ketertarikan membaca dapat terhenti ketika orang tidak mengetahui buku itu tersedia di mana atau siapa yang bisa membantu.

Tujuan produk:
1. Memudahkan penemuan buku dan informasi dasarnya.
2. Memperlihatkan pilihan akses: perpustakaan dan berbagi buku; ketersediaan harus diberi sumber dan waktu pembaruan.
3. Menghubungkan pembaca ke komunitas dan acara literasi setempat.
4. Membantu komunitas menerbitkan profil, acara, dan daftar merchandise yang dikelola komunitasnya.
5. Memberi rekomendasi yang dapat dijelaskan, setelah data dan pendekatannya disepakati.

## 3. Pengguna

- **Pembaca:** mencari buku, akses, komunitas, dan acara.
- **Pemilik buku:** menawarkan buku untuk dipinjamkan dan menanggapi permintaan.
- **Pengelola komunitas:** mengelola profil, acara, dan (jika diaktifkan) merchandise.
- **Pengelola platform:** meninjau laporan, verifikasi, dan konten sesuai kebijakan.
- **Perpustakaan/organisasi:** sumber informasi akses; kewenangan pengelolaan datanya belum ditentukan.

Rentang usia 18–25 tercatat sebagai sasaran awal pada PRD sumber, bukan batas akses produk yang telah disepakati.

## 4. Ruang lingkup produk

### Fondasi produk yang tercatat
- Pencarian dan detail buku dari katalog eksternal (Open Library kandidat; pilihan final belum dikunci).
- Informasi akses buku melalui perpustakaan dan book sharing.
- Peta/lokasi untuk perpustakaan, komunitas, kegiatan, dan titik temu publik.
- Profil komunitas dan acara.
- Bookmark dan preferensi minat.
- Rekomendasi buku/komunitas yang relevan.
- Permintaan pinjam dan pengelolaan status pengembalian.

### Kemampuan komunitas merchandise
Pengelola komunitas dapat membuat dan mengelola daftar merchandise yang terkait dengan profil komunitas. Setiap daftar setidaknya memiliki nama, deskripsi, foto (opsional), harga atau keterangan harga, status ketersediaan, dan cara menghubungi/menyelesaikan pembelian sesuai kebijakan yang kelak dipilih. Pembeli melihat komunitas penjual dan status barang.

**Batas yang belum diputuskan:** apakah MVP hanya katalog dengan transaksi di luar platform, atau menerima pesanan/pembayaran di dalam platform. Jangan membangun pembayaran, escrow, pengiriman, komisi, atau refund sebelum keputusan dan kebijakannya disetujui.

### Di luar scope sampai diputuskan
- Pengiriman buku atau merchandise oleh platform.
- Pembayaran, escrow, saldo, komisi, dan refund.
- Chat real-time.
- Aplikasi native.
- Jaminan akurasi stok perpustakaan secara langsung.
- Fitur penulis/penerbit.

## 5. Kebutuhan fungsional

| ID | Kebutuhan | Kriteria ringkas |
|---|---|---|
| FR-01 | Cari buku | Pengunjung dapat mencari dan membuka detail; keadaan kosong dan kegagalan katalog jelas. |
| FR-02 | Lihat cara membaca | Detail buku mengelompokkan akses perpustakaan dan book sharing serta mencantumkan sumber/waktu data bila diketahui. |
| FR-03 | Temukan lokasi | Pengguna dapat menyaring kategori; izin lokasi bersifat pilihan dan pencarian manual tersedia. |
| FR-04 | Ajukan pinjam | Pengguna masuk dapat mengirim permintaan; pemilik dapat menerima/menolak; alamat rumah tidak dipublikasikan. |
| FR-05 | Kelola komunitas | Pengelola yang berwenang dapat mengubah profil dan mengirim data verifikasi. |
| FR-06 | Kelola acara | Acara memiliki waktu, lokasi/tautan, komunitas penyelenggara, dan status publikasi. |
| FR-07 | Tampilkan merchandise | Pengelola komunitas mengelola daftar dan status; pengunjung dapat melihat detail. Mekanisme transaksi mengikuti keputusan tertulis. |
| FR-08 | Simpan minat | Pengguna dapat menyimpan bookmark dan mengubah minat; tersedia kontrol hapus. |
| FR-09 | Rekomendasi | Rekomendasi memiliki alasan yang dapat dipahami; pengguna dapat mengabaikannya. |
| FR-10 | Pelaporan | Konten dan akun dapat dilaporkan; laporan masuk ke proses peninjauan manusia. |

## 6. Kebutuhan nonfungsional

- Antarmuka responsif, navigasi keyboard, label formulir, kontras memadai, serta pesan kesalahan yang dapat ditindaklanjuti.
- API memvalidasi input di server dan menerapkan otorisasi pada setiap operasi.
- Data pribadi dan lokasi privat tidak ditampilkan sebagai lokasi publik.
- Integrasi eksternal memiliki penanganan timeout, batas penggunaan, dan keadaan gagal.
- Perubahan skema tercatat melalui migrasi yang dapat ditinjau.
- Target performa, ketersediaan, retensi, dan dukungan browser perlu ditetapkan tim sebelum rilis.

## 7. Ukuran keberhasilan (usulan, perlu baseline)

Pantau funnel pencarian → detail → akses yang ditemukan, permintaan pinjam yang ditanggapi, kunjungan profil komunitas/acara, interaksi merchandise, serta tingkat laporan dan penyelesaiannya. Angka target belum ditetapkan; jangan menganggap usulan metrik sebagai komitmen.

## 8. Risiko produk

Katalog eksternal mungkin tidak lengkap untuk buku Indonesia; data lokasi bisa usang; peminjaman dan jual-beli melibatkan kepercayaan, keselamatan, serta kewajiban kebijakan; rekomendasi dapat bias oleh data tipis. Tampilkan batas data, gunakan titik temu publik, sediakan pelaporan, dan mulai merchandise sebagai katalog jika transaksi belum disepakati.
