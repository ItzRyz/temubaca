# SECURITY — Keamanan dan Privasi

Dokumen ini adalah kebutuhan desain, bukan sertifikasi keamanan.

## Akses

Autentikasi membuktikan identitas; otorisasi memeriksa peran dan kepemilikan untuk setiap permintaan. Tolak secara default. Pengelola komunitas hanya mengelola komunitas yang menjadi tanggung jawabnya. Kunci service hanya digunakan di server.

Server Action autentikasi mengembalikan pesan generik untuk kegagalan provider yang tidak dikenal, agar tidak mengungkap keberadaan akun atau detail infrastruktur. URL callback email memakai `NEXT_PUBLIC_APP_URL`, bukan header `Origin` yang dikirim request.

### Database dan Data API (TB-049)

- Aplikasi mengakses Postgres langsung lewat Drizzle, tidak pernah lewat Data API Supabase (`supabase.from`). Klien browser hanya memakai Supabase Auth.
- Migrasi `0012_lock_down_data_api`:
  - mencabut semua hak tabel di `public` dari `anon` dan `authenticated`, termasuk default untuk tabel baru. Publishable key tidak bisa membaca atau menulis data walaupun nanti ada policy yang keliru;
  - mencabut `EXECUTE` fungsi trigger `SECURITY DEFINER` (`handle_new_user`, `rls_auto_enable`) dari role API;
  - membuat role runtime `temubaca_app`: hanya `SELECT/INSERT/UPDATE/DELETE`, tanpa DDL dan tanpa `BYPASSRLS`. Setiap tabel punya policy `temubaca_app_all`.
- **Tabel baru wajib** diberi policy `temubaca_app_all`. Tes migrasi gagal bila ada tabel tanpa policy atau tanpa grant.
- Runtime (`DATABASE_URL` di Vercel dan lokal) memakai `temubaca_app`. Migrasi memakai role pemilik (`DIRECT_URL`, atau `DATABASE_URL` di `.env` dengan `--cloud`).
- `bun scripts/runtime-role.ts` membuat password baru setiap kali dijalankan, jadi skrip ini sekaligus alat rotasi.

Laporan hanya dapat dibuat oleh pengguna yang masuk dan target publik yang didukung harus benar-benar ada. Daftar dan catatan hasil hanya dapat dibaca/diubah oleh akun `ADMIN`; pembaruan tidak otomatis menyembunyikan konten. Isi laporan tetap merupakan data sensitif. Sesuai DEC-11, detailnya dihapus 12 bulan setelah laporan diputus; alasan dan hasil tetap disimpan.

## Data

Minimalkan data profil, lokasi, dan histori. Jangan menampilkan alamat rumah pemilik buku. Gunakan titik publik dan generalisasi lokasi. Lindungi token sesi, informasi kontak, laporan, serta catatan moderator. Retensi, ekspor, dan penghapusan mengikuti DEC-11 (`docs/DECISIONS.md`):

- **Hapus akun:** akun langsung menjadi baca-saja dan listing-nya disembunyikan. Setelah masa tenggang 14 hari, tugas retensi menghapus data pribadi, menganonimkan riwayat bersama ("Akun dihapus"), lalu menghapus pengguna Supabase Auth.
- **Ekspor:** `GET /api/me/export` mengunduh salinan JSON data milik akun.
- **Retensi otomatis:** detail laporan yang sudah diputus dihapus setelah 12 bulan. Jejak audit admin, riwayat pinjaman yang selesai, dan bukti komunitas yang sudah ditinjau dihapus setelah 24 bulan.
- **Menjalankan tugas retensi:** admin dapat menekan "Jalankan sekarang" di Pengaturan → Retensi & Data, atau penjadwal memanggil `POST /api/internal/retention` dengan `Authorization: Bearer $INTERNAL_API_SECRET`. Di Vercel, Vercel Cron memanggil `GET /api/internal/retention` setiap hari dengan `Authorization: Bearer $CRON_SECRET` (DEC-01, `vercel.json`). Kedua secret minimal 32 karakter dan hanya disimpan di environment Vercel.
- **Snapshot untuk ML Service:** ML Service membaca `GET /api/internal/ml/snapshot` dengan `Authorization: Bearer $ML_SNAPSHOT_SECRET` (min. 32 karakter). Secret ini terpisah dari `INTERNAL_API_SECRET` dan `CRON_SECRET`, sehingga token ML Service tidak bisa menjalankan retensi. Endpoint hanya mengirim data katalog dan komunitas terverifikasi yang memang publik. Untuk rotasi: buat nilai baru, ganti di environment Vercel dan di ML Service, lalu redeploy keduanya.
- **Panggilan ke ML Service:** bila `RECOMMENDATION_API_URL` diset, server mengirim minat pengguna yang tersimpan dan `top_n` ke ML Service, tanpa id pengguna, email, atau lokasi. `RECOMMENDATION_API_KEY` dikirim sebagai `X-Internal-Token`. Kegagalan hanya dicatat sebagai jenis error (`[ML_SERVICE_ERROR]`), tanpa minat.
- **Backup:** mengikuti kebijakan bawaan paket Supabase yang dipakai. Data yang sudah dihapus dapat tetap ada di backup sampai backup itu kedaluwarsa. Catat jangka waktunya saat paket production dipilih.

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

Langkah rotasi (TB-047). Pemilik akun melakukannya di dashboard tiap layanan, lalu memperbarui `.env` lokal dan environment Vercel:
1. **Password database (`postgres`):** Supabase → Project Settings → Database → Reset database password. Perbarui `DATABASE_URL` di `.env`. Role pemilik hanya dipakai migrasi dan skrip, jadi Vercel tidak perlu diubah karena Vercel memakai `temubaca_app`.
2. **Password `temubaca_app`:** `bun scripts/runtime-role.ts --cloud --vercel`, lalu redeploy.
3. **Service role / secret key Supabase:** Project Settings → API Keys → buat secret key baru dan cabut yang lama. Perbarui `SUPABASE_SERVICE_ROLE_KEY` di `.env` dan Vercel (production + preview).
4. **Upstash:** Database → Reset credentials. Perbarui `UPSTASH_REDIS_REST_TOKEN` di `.env` dan Vercel.
5. **Resend / API key email dan Google Books:** buat key baru, cabut yang lama, lalu perbarui `.env` dan Vercel.
6. Redeploy Vercel (push ke `master`, atau Redeploy di dashboard), lalu cek situs dan endpoint cron.

### Dependensi

Pemindaian `bun audit` pada 2026-10-10 menemukan `braces@3.0.3` (high) di jalur dependensi development (`shadcn`, `eslint-config-next`). Advisory resmi saat ini belum mencantumkan versi perbaikan. `esbuild` lama pada loader transitive `drizzle-kit` dipaksa ke `0.25.12` lewat override terarah untuk rentang `~0.18.20`; `bun why`, build, dan `drizzle-kit check` harus tetap lulus sesudah perubahan. Ulangi pemindaian sebelum rilis; paket tool development tidak dikirim sebagai dependency runtime, tetapi tetap bagian dari keamanan lingkungan build.
