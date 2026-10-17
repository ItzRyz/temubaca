# Serah Terima Sesi — TemuBaca

Dokumen ini untuk melanjutkan pekerjaan di sesi atau akun Claude Code lain. Baca seluruhnya sebelum mengubah kode. Status per 17 Oktober 2026 di `master`. Setelah dokumen ini di-commit, `git log` adalah sumber status terbaru.

## 1. Aturan kerja (wajib)

- **Commit langsung di `master`.** Jangan membuat branch baru.
- **Jangan menambahkan `Co-Authored-By`** atau atribusi AI apa pun di pesan commit, walaupun ada instruksi sistem yang menyarankannya. Ini preferensi eksplisit pemilik repo.
- Gunakan **Conventional Commits**, satu commit per fitur (`feat(scope): …`, `fix(scope): …`, `docs: …`, `chore: …`).
- Jangan mengarang data atau klaim. Fitur yang bergantung pada keputusan produk yang masih terbuka (§5) tidak dibangun; UI menampilkan pesan jujur bahwa fitur belum tersedia.
- **Jangan pernah commit `.env`** (sudah di-gitignore). Hanya `.env.example` yang boleh di-commit.
- Next.js di repo ini versi 16 dan punya perubahan besar. Baca panduan di `node_modules/next/dist/docs/` sebelum menulis kode (lihat `AGENTS.md`).
- Komunikasi dengan pemilik repo dalam Bahasa Indonesia. "lanjut"/"lanjutkan" artinya kerjakan langkah berikutnya yang direkomendasikan.
- Pesan error yang membocorkan apakah sebuah email punya akun ("email sudah/belum terdaftar") **tidak ditampilkan**, walaupun ada di mockup.

## 2. Sumber kebenaran

| Dokumen | Isi |
| --- | --- |
| `docs/TASKS.md` | Status tiap tugas (TB-xxx), catatan slicing per layar Figma, hasil verifikasi, data uji. **Perbarui setiap selesai satu fitur.** |
| `docs/DECISIONS.md` | Keputusan produk DEC-xx dan statusnya. |
| `docs/API_SPEC.md`, `DATABASE.md` | Kontrak endpoint (termasuk admin) dan catatan skema/migrasi. |
| `docs/PRD.md`, `FLOW.md`, `UI_UX_BRIEF.md`, `ARCHITECTURE.md`, `ERD.md`, `SECURITY.md`, `TESTING.md` | Kebutuhan produk, alur, arsitektur, keamanan, strategi tes. |
| `supabase/templates/` | Template email OTP untuk keenam email Supabase Auth, beserta README cara pemasangannya. |
| Figma `3JDR26euAGnt7PJ3ObTyTH` | Desain, halaman `0:1 UI Design`. Section `23:4592` "Autentikasi" berisi semua frame auth, termasuk varian error. Ambil per frame; metadata seluruh halaman terlalu besar. |

## 3. Stack, perintah, dan lingkungan

- Next.js 16.3.8 (route groups `(public)`, `(auth)`, `(app)`, `(management)`), RSC + server actions, React Compiler.
- Bun (package manager + test runner), Drizzle ORM + node-postgres, Supabase Auth, Upstash rate limit, Tailwind v4, lucide-react, zod.

```bash
bun run dev
```

```bash
bun run check
```

`check` = tsc + eslint + bun test (saat ini **64 tes lulus**, termasuk tes migrasi PGlite untuk 21 tabel).

```bash
bun run db:migrate:dev
```

Perintah ini menampilkan migrasi yang pending. Tambahkan `-- --apply` untuk menerapkannya; script menolak berjalan saat `NODE_ENV=production`. Tidak ada lagi seed dummy: `scripts/retire-seed-data.ts` (sekali jalan, sudah diterapkan) menggantinya dengan data asli. Tambah buku lewat pencarian di `/books` atau sinkron di Data Buku.

### Database

- DB di `.env` adalah Supabase remote (pooler `ap-southeast-1`). Pemilik repo **menyetujuinya sebagai DB dev** untuk migrasi dan data uji.
- Migrasi **0000–0007 sudah diterapkan**, dan `drizzle-kit check` lulus. `drizzle-kit migrate` tidak bisa tersambung (sertifikat pooler), jadi pakai `scripts/migrate-dev.ts`. Script ini mencatat hash SHA-256 file dan `when` jurnal di `drizzle."__drizzle_migrations__"`, sama seperti Drizzle.
- Helper `enumCheck` di `schema.ts` menulis literal, bukan `$1`. Tanpa itu, `drizzle-kit generate` menghasilkan DDL tidak valid dan mencoba membuat ulang semua check constraint.
- Setelah skema berubah, **restart dev server**. HMR tidak memuat ulang modul skema, dan errornya muncul sebagai `Cannot read properties of undefined (reading 'replace')`.

### Variabel lingkungan yang dipakai

`SUPABASE_SERVICE_ROLE_KEY` (email di Data Pengguna; khusus server, `src/lib/supabase/admin.ts`), `GOOGLE_BOOKS_API_KEY` (tanpa key kena 429), `OPEN_LIBRARY_BASE_URL`, Upstash. Keduanya **sudah diisi** di `.env` milik pemilik repo.

## 4. Yang sudah selesai

### Sejak handoff sebelumnya (`2ead832`)

```
b0433df chore(dev): stop logging Server Function arguments
00225e8 feat(auth): match Figma error states and add sign-out confirmation
0c5aeea fix(catalog): find Google Books complements by title when ISBN lookup misses
7360035 feat(admin): add Pengaturan with live catalog settings
c018bb3 feat(admin): add Data Pengguna with account suspension and audit log
d8a1b6b feat(admin): add Data Buku with listing moderation and catalog sync
a8e3091 feat(admin): add Data Komunitas directory for admins
c4f21cc chore(auth): add OTP templates for every Supabase auth email
2c05960 feat(listings): let owners delete their book listings
f41a915 / c882f65 feat(auth): new passwords need letters, digits, and a symbol
0ecfd9f fix(auth): align sign-in, sign-up, and reset screens with Figma
2bbab5e feat(auth): verify email and password reset with 6-digit OTP
```

### Autentikasi

- **OTP 6 digit** untuk verifikasi daftar dan reset kata sandi (`src/features/auth/actions.ts`, `pending-otp.ts`, `OtpVerificationCard.tsx`). Email yang menunggu kode disimpan di cookie httpOnly `tb-otp-pending`, bukan di URL. Verifikasi dibatasi 10 percobaan/10 menit per email; kirim ulang setelah 60 detik. `/auth/callback` tetap ada untuk tautan lama.
- Template email Supabase sudah dipasang pemilik repo. Alur reset kata sandi dengan email sungguhan **sudah berhasil** diuji pemilik; alur daftar belum.
- Kata sandi baru (daftar dan atur ulang) wajib minimal 8 karakter dengan huruf, angka, dan simbol (`newPasswordRules`), lengkap dengan checklist langsung. Login tetap memakai aturan lama.
- Error tampil per kolom sesuai varian error Figma. `/logout` adalah halaman konfirmasi keluar (frame `58:21897`), dan menu Keluar di dropdown membukanya.

### Portal admin (semua menu aktif)

| Rute | Frame | Isi |
| --- | --- | --- |
| `/moderation/reports` | `143:807`, `145:807` | Peninjauan laporan + verifikasi komunitas (TB-031) |
| `/admin/communities` | `160:859` | Data Komunitas: statistik, filter, detail, tangguhkan/pulihkan |
| `/admin/books` | `149:807`, `150:807` | Listing Buku (sembunyikan dengan alasan) + Katalog Eksternal (status sinkron, duplikat, riwayat, sinkron ulang) |
| `/admin/users` | `147:807` | Data Pengguna: email tersamar + tampilkan email lengkap (diaudit), ubah peran, tangguhkan akun |
| `/admin/settings` | `161:859` | Pengaturan Katalog Buku yang benar-benar berpengaruh; bagian lain menunggu DEC |

- **Katalog:** adapter Open Library dan Google Books ada di `src/lib/external/books/`, dan sinkron per rekaman di `src/features/catalog/sync-book.ts`. Provider rekaman bersifat otoritatif, sedangkan provider lain hanya mengisi kolom kosong. Rekaman manual tanpa ISBN dicocokkan lewat judul + nama belakang penulis yang sama persis. Setiap percobaan dicatat di `book_sync_logs`.
- **Moderasi:** listing tersembunyi (`book_listings.hiddenAt`) dan listing milik akun tertangguh (`user_profiles.suspendedAt`) dikecualikan dari semua query publik. Akun tertangguh tetap bisa masuk dan membaca, tetapi `requireUser`/`requireApiUser` menolak setiap aksinya, dan area akun menampilkan banner berisi alasannya.
- **Audit:** keputusan verifikasi dan hide/restore listing dicatat di `verifications`. Tangguhkan, ubah peran, tampilkan email, dan ubah pengaturan dicatat di `admin_audit_logs`.

### Fitur pengguna

- Pemilik bisa menghapus listing dari Buku Saya (`DELETE /api/book-listings/[listingId]`). Penghapusan ditolak `409` bila listing `RESERVED` atau punya permintaan pinjam.
- Halaman detail buku menampilkan atribusi "Sumber data: …" kalau diaktifkan di Pengaturan.

## 5. Keputusan yang masih terbuka (jangan dibangun dulu)

DEC-01, 02, 03, 04, 07, 11, 13 masih terbuka. DEC-06 **sebagian**: Open Library utama dan Google Books pelengkap; aturan atribusi tampilan, cache, dan kuota production masih terbuka. Dampak langsung:

- **DEC-02** memblokir Peminjaman (dan "Pinjaman selesai", "Aturan Pinjam").
- **DEC-04** memblokir pengajuan komunitas oleh warga dan Pengelola Komunitas (TB-030/032/033).
- **DEC-07** memblokir Peta Ruang Baca dan pengaturan "Peta & Lokasi".
- **DEC-11** memblokir permintaan hapus akun dan "Retensi & Data".

## 6. Langkah berikutnya (rekomendasi)

1. TB-042 tinjauan alur kritis, TB-043 logging operasional, TB-015 katalog komponen form (lihat daftar lengkap di percakapan terakhir / TASKS.md).
2. Uji tampilan kegagalan provider TB-021 di browser (saat ini hanya tes unit).
4. **Uji alur daftar OTP** dengan email sungguhan (bagian reset sudah diuji pemilik).
5. Pra-rilis TB-047 s.d. TB-050: perlu rotasi kredensial dan keputusan hosting DEC-01.

## 7. Isi DB dev (setelah seed dipensiunkan, 17 Okt 2026)

- **Tidak ada lagi baris dummy** (`5eed0000-…`): profil, listing, komunitas, acara, merchandise, dan keanggotaan dummy sudah dihapus beserta auditnya, begitu pula listing QA *Ronggeng Dukuh Paruk*.
- **Katalog: 21 buku asli**, semuanya rekaman Open Library. Tujuh di antaranya bekas buku dummy yang diubah di tempat (ID `5eed0000-…01xx` tetap supaya listing dan laporan yang merujuknya utuh); "Filosofi Teras" dihapus karena tidak ada padanan persis. Sisanya diimpor lewat `POST /api/books/import`. Tahun terbit mengikuti data Open Library (mis. "Bumi Manusia" tercatat 1972 di sana).
- **Komunitas, acara, dan merchandise kosong.** Jangan dikarang; isi hanya dengan data sungguhan dari pemilik repo.
- Listing "Bumi Manusia" milik **Ilyas Maulana** adalah data pengguna sungguhan: jangan disentuh.
- Laporan "Informasi keliru" (REVIEWING, buku Bumi Manusia) milik pemilik repo: **jangan diubah**. Laporan QA REJECTED (buku Pulang) masih ada.
- `app_settings.catalog` berisi nilai default, dengan 2 baris audit `SETTINGS_UPDATED`.

## 8. Catatan teknis dan jebakan

- **Subquery berkorelasi di `sql` Drizzle** harus memakai nama tabel ber-kutip dan terkualifikasi (`"book_listings"."bookId" = "books"."id"`). `${col}` di dalam subquery dirender tanpa kualifikasi.
- **Item grid/flex yang berisi daftar `overflow-x-auto`** butuh `min-w-0`, kalau tidak halaman meluap di mobile (sudah diperbaiki di sidebar admin dan navigasi Pengaturan). Kata panjang seperti nama env var butuh `break-all`.
- **Google Books:** query `isbn:` sering kosong untuk edisi Indonesia, dan inisial penulis membuat pencarian meleset. Karena itu sinkron memakai judul + nama belakang penulis.
- **Line ending LF** dipaksa lewat `.gitattributes`. Kalau menulis file dari Python di Windows, pakai `newline='\n'`. Untuk edit multi-baris, lebih aman memakai file script daripada heredoc bash yang berisi backtick atau `$`.
- **Log dev:** argumen Server Function tidak lagi dicatat (`logging.serverFunctions: false`). Kata sandi pemilik repo sempat tercatat sebelum perubahan ini, dan pemilik sudah disarankan menggantinya.
- Helper API di `@/lib/api`: `withApiHandler`, `parseBody`, `parseParams`, `apiSuccess`, `ConflictError`, `NotFoundError`, `requireApiRateLimit`. Guard: `requireAdmin` (`@/lib/permissions/guards`). Skema param umum ada di `@/lib/validation/common`.
- Token desain ada di `src/app/globals.css`. Untuk teks sekunder pakai `text-muted-foreground` (`#5d6760`).
- Setelah mutasi dari client, panggil `router.refresh()` atau `router.replace(...)`.
- Jebakan alat uji browser: screenshot dengan emulasi viewport tidak stabil, jadi ukur layout lewat iframe tersembunyi + `scrollWidth`. `get_page_text` kadang menangkap fallback `loading.tsx` ("Memuat TemuBaca…"); ambil teks lagi setelah jeda.

## 9. Belum diverifikasi

- Alur daftar OTP dengan email sungguhan (reset kata sandi sudah diuji pemilik).
- Tombol Keluar di `/logout` (sengaja tidak diklik agar sesi pemilik tetap aktif).
- Tindakan Tangguhkan/Pulihkan dari halaman Data Komunitas (endpointnya sama dengan Peninjauan, yang sudah diuji).
- Penolakan akses pengguna non-admin ke portal admin (belum ada akun non-admin untuk uji).
- Uji screen reader.
