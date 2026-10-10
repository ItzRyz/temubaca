# DATABASE — Pedoman Implementasi

Gunakan PostgreSQL relasional. Skema pada `ERD.md` adalah rancangan, bukan hasil introspeksi database. Terapkan semua perubahan melalui migrasi yang ditinjau.

## Pedoman

- Kaitkan identitas aplikasi dengan ID auth provider; jangan simpan kata sandi aplikasi jika autentikasi dikelola provider.
- Tambahkan foreign key, batas unik, NOT NULL, dan indeks untuk pola akses nyata.
- Gunakan UTC untuk waktu tersimpan dan tentukan zona waktu saat ditampilkan.
- Metadata katalog eksternal simpan sumber dan waktu sinkronisasi. Hanya simpan data yang diizinkan ketentuan provider.
- Terapkan RLS bila platform mendukungnya, namun tetap lakukan otorisasi di server untuk operasi sensitif.
- Listing merchandise selalu milik komunitas. Pesanan hanya dibuat jika scope transaksi disahkan.
- Pisahkan lokasi publik dari alamat/titik privat. Jangan mengembalikan lokasi privat di query publik.
- Tentukan retensi dan penghapusan akun/laporan sebelum produksi.

## Koneksi dan migrasi

- Aplikasi menggunakan driver Drizzle `node-postgres` dengan `DATABASE_URL`.
- Koneksi runtime mewajibkan verifikasi TLS saat `NODE_ENV=production`; jangan menonaktifkan verifikasi sertifikat untuk mengatasi masalah koneksi.
- `DATABASE_SSL_CA` dapat memuat CA PEM khusus dan ditambahkan ke CA bawaan Node untuk koneksi runtime maupun migrasi. Verifikasi sertifikat dan hostname tetap aktif.
- Pada production, jangan sertakan `sslmode`, `sslcert`, `sslkey`, atau `sslrootcert` di query URL koneksi runtime. Opsi tersebut dapat mengganti objek TLS yang disetel aplikasi. Gunakan `DATABASE_SSL_CA` untuk CA khusus.
- Drizzle Kit memilih `DIRECT_URL` untuk generate/migrate bila tersedia; koneksi langsung atau mode session lebih sesuai untuk tugas migrasi daripada transaction pooling.
- Drizzle Kit mem-parsing URL migrasi menjadi parameter koneksi lalu menerapkan TLS strict untuk host non-lokal, dan semua host saat `NODE_ENV=production`; opsi SSL yang tertanam di URL tidak boleh menurunkan tingkat verifikasi.
- Tentukan mode pooler, ukuran pool, TLS, dan batas koneksi setelah platform hosting dipilih. Jangan mengasumsikan URL migrasi dan runtime harus sama.
- Jangan jalankan migrasi terhadap production dari build atau startup aplikasi; jalankan sebagai langkah rilis eksplisit terhadap target yang diverifikasi.

## Akses pinjam dan ketersediaan perpustakaan

Di skema Drizzle saat ini, `book_accesses` mencatat akses yang diberikan untuk sebuah `borrow_request` (misalnya status, masa berlaku, dan pencabutan). Tabel tersebut bukan catatan ketersediaan buku pada perpustakaan. Jangan mengganti makna, mengganti nama, atau menambahkan relasi perpustakaan ke tabel itu sebelum dampak terhadap alur pinjam dan data lama ditinjau.

Ketersediaan buku perpustakaan adalah konsep terpisah yang belum dimodelkan. Keputusan tentang sumber data, siapa yang memperbarui data, status, kesegaran, dan penanganan duplikasi dicatat sebagai DEC-13. Sampai keputusan itu tersedia, jangan membuat migrasi atau mengklaim informasi stok/ketersediaan di UI.

## Tinjauan migrasi

Sebelum deploy, periksa dampak pada data, kebijakan akses, rollback, indeks, dan data lama. Uji migrasi pada lingkungan uji; jangan menjalankan perubahan destruktif pada data produksi tanpa prosedur pemulihan yang disetujui.
