# DECISIONS — Catatan Keputusan dan Pertanyaan Terbuka

Status awal: semua butir di bawah belum mendapat keputusan eksplisit dalam sumber yang dapat dibaca. Pemilik dan tanggal keputusan perlu diisi tim.

| ID | Pertanyaan | Dampak | Status |
|---|---|---|---|
| DEC-01 | Platform mana yang menjadi sumber autentikasi, hosting, dan database final? | Arsitektur, biaya, akses | Terbuka |
| DEC-02 | Apa aturan lengkap siklus pinjam, tenggat, pembatalan, pengembalian, kerusakan, dan sengketa? | Data, UI, keselamatan | Terbuka |
| DEC-03 | Merchandise MVP berupa katalog dengan transaksi di luar platform atau checkout/pesanan di TemuBaca? | Scope, pembayaran, hukum, operasional, data alamat | Terbuka; checkout diblokir |
| DEC-04 | Siapa yang boleh membuat/mengelola komunitas dan bagaimana verifikasinya? | Role, moderasi, kualitas data | Terbuka |
| DEC-05 | Apakah acara/komunitas/merchandise dimoderasi sebelum publikasi? | Alur admin dan waktu tayang | Terbuka |
| DEC-06 | Provider katalog buku final dan aturan penggunaan/atribusi apa? | Kelengkapan, cache, legalitas | Open Library kandidat; perlu evaluasi |
| DEC-07 | Provider peta, geocoding, dan kebijakan lokasi apa? | Biaya, privasi, akurasi | Leaflet/OSM kandidat |
| DEC-08 | Apakah rekomendasi MVP perlu layanan ML terpisah, atau cukup baseline di aplikasi? | Kompleksitas dan deployment | Python/FastAPI kandidat |
| DEC-09 | Target pengguna/usia, wilayah peluncuran, serta kebutuhan bahasa? | UX dan kebijakan | Sasaran 18–25 tercatat; belum dikunci |
| DEC-10 | Tanggal, target kompetisi/demo, dan metrik keberhasilan? | Prioritas dan release | Belum tersedia |
| DEC-11 | Retensi, penghapusan akun, backup, dukungan dan penanganan laporan? | Produksi dan kepatuhan | Terbuka |
| DEC-12 | Harga merchandise, stok, varian, pengiriman dan hubungan penjual-pembeli? | Model listing/checkout | Terbuka |
| DEC-13 | Bagaimana memodelkan ketersediaan buku di perpustakaan secara terpisah dari akses yang diberikan setelah permintaan pinjam? Tetapkan sumber data, pemilik pembaruan, status, kesegaran, dan penanganan duplikasi. | Skema, integrasi, akurasi UI, privasi dan operasional | Terbuka; TB-023 diblokir |

Catat keputusan dengan format: **keputusan; konteks; opsi yang dipertimbangkan; alasan; pemilik; tanggal; dampak pada dokumen/task**. Setelah diputuskan, perbarui dokumen terkait dan tandai task yang diblokir. Jangan menyimpulkan keputusan dari teknologi kandidat atau narasi kompetisi di dokumen lama.
