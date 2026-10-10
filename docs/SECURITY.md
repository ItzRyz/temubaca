# SECURITY — Keamanan dan Privasi

Dokumen ini adalah kebutuhan desain, bukan sertifikasi keamanan.

## Akses

Autentikasi membuktikan identitas; otorisasi memeriksa peran dan kepemilikan untuk setiap permintaan. Tolak secara default. Pengelola komunitas hanya mengelola komunitas yang menjadi tanggung jawabnya. Kunci service hanya digunakan di server.

Server Action autentikasi mengembalikan pesan generik untuk kegagalan provider yang tidak dikenal, agar tidak mengungkap keberadaan akun atau detail infrastruktur. URL callback email memakai `NEXT_PUBLIC_APP_URL`, bukan header `Origin` yang dikirim request.

Laporan hanya dapat dibuat oleh pengguna yang masuk dan target publik yang didukung harus benar-benar ada. Daftar dan catatan hasil hanya dapat dibaca/diubah oleh akun `ADMIN`; pembaruan tidak otomatis menyembunyikan konten. Isi laporan tetap merupakan data sensitif dan perlu mengikuti keputusan retensi DEC-11.

## Data

Minimalkan data profil, lokasi, dan histori. Jangan menampilkan alamat rumah pemilik buku. Gunakan titik publik dan generalisasi lokasi. Lindungi token sesi, informasi kontak, laporan, serta catatan moderator. Tentukan retensi, ekspor, dan penghapusan bersama kebijakan produk.

## Input dan integrasi

Validasi tipe, panjang, format, unggahan dan URL; encode output; batas ukuran body dan rate limit; tangani timeout provider; hindari SSRF dari URL gambar/tautan. Simpan rahasia di konfigurasi deployment dan rotasi jika terpapar. Pesan error publik tidak memuat stack trace atau data internal.

## Kepercayaan, jual-beli, dan moderasi

Verifikasi komunitas harus menjelaskan cakupannya dan bukan jaminan keamanan/ kualitas semua aktivitas. Sediakan pelaporan konten dan proses peninjauan manusia. Sebelum checkout merchandise aktif, tetapkan ketentuan penjual, pembayaran, refund, pajak/biaya, privasi alamat, sengketa, bukti transaksi, dan pihak yang menangani. Untuk katalog dengan transaksi di luar platform, jelaskan bahwa TemuBaca tidak memproses pembayaran.

## Sebelum rilis

Tinjau hak akses, konfigurasi, dependensi, upload, backup, logging, pemulihan akun, kebijakan privasi, dan alur pelaporan. Catat temuan dan penanggung jawabnya pada checklist `TASKS.md`.
Validasi environment membatasi URL aplikasi dan Supabase ke origin HTTP(S) tanpa kredensial, path, query, atau fragment. Origin jarak jauh wajib HTTPS saat `NODE_ENV=production`; HTTP hanya diterima untuk loopback agar build lokal tetap dapat menggunakan layanan lokal. Verifikasi juga domain callback/redirect yang diizinkan pada konfigurasi Supabase.
URL Upstash REST wajib HTTPS dan tidak boleh berisi kredensial yang tertanam di URL; token dikirim melalui konfigurasi client.
Koneksi PostgreSQL production dan migrasi untuk host non-lokal memverifikasi CA serta hostname; migrasi production juga memverifikasi host lokal. `DATABASE_SSL_CA` hanya menambah CA tepercaya; jangan gunakan `sslmode=no-verify` atau menonaktifkan `rejectUnauthorized`.

### Tindak lanjut kredensial

Isi lokal `.env.example` sebelumnya memuat nilai yang menyerupai kredensial layanan. File tersebut kini berisi placeholder saja. Perlakukan password database, token Upstash, dan API key email yang pernah berada di sana sebagai terekspos sampai pemilik layanan memastikan dan merotasinya. Jangan salin nilai lama ke konfigurasi deployment atau commit.

### Dependensi

Pemindaian `bun audit` pada 2026-10-10 menemukan `braces@3.0.3` (high) di jalur dependensi development (`shadcn`, `eslint-config-next`). Advisory resmi saat ini belum mencantumkan versi perbaikan. `esbuild` lama pada loader transitive `drizzle-kit` dipaksa ke `0.25.12` lewat override terarah untuk rentang `~0.18.20`; `bun why`, build, dan `drizzle-kit check` harus tetap lulus sesudah perubahan. Ulangi pemindaian sebelum rilis; paket tool development tidak dikirim sebagai dependency runtime, tetapi tetap bagian dari keamanan lingkungan build.
