# Serah Terima Sesi — TemuBaca

Dokumen ini untuk melanjutkan pekerjaan di sesi atau akun Claude Code lain. Baca seluruhnya sebelum mengubah kode. Status per 18 Oktober 2026 di `master`. Setelah dokumen ini di-commit, `git log` adalah sumber status terbaru.

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
| `docs/OPERATIONS.md` | Operasional production: log, pemeriksaan rutin, backup dan restore, rollback, respons insiden (TB-043). |
| `docs/data-engineering/` | Seed data sintetis untuk DB lokal (`bun run db:seed`): schema audit, strategi, operasi, laporan kualitas data. |
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

`check` = tsc + eslint + bun test (saat ini **141 tes lulus**, termasuk tes integrasi PGlite untuk migrasi 24 tabel, siklus pinjam, pengelolaan komunitas, dan hapus akun/retensi). `bun run build` juga lulus tanpa peringatan.

```bash
bun run test:e2e
```

E2E Playwright, 19 tes: alur tamu (desktop + mobile) dan alur anggota dengan dua akun uji (desktop). Memakai dev server yang sedang jalan, atau menjalankannya sendiri. Akun uji dibuat dengan `bun scripts/e2e-accounts.ts`, yang menulis kredensial ke `.env.e2e` (di-gitignore). Data uji dihapus otomatis sebelum dan sesudah run.

```bash
bunx supabase start
bun run db:local
```

Dev dan E2E memakai **Supabase lokal di Docker** (port 556xx, karena 543xx dipakai project Supabase lain di mesin ini). `db:local`:
- menulis `.env.development.local` dari `supabase status`;
- menerapkan migrasi Drizzle lalu trigger auth di `supabase/migrations`;
- menyalin tabel `books` dari cloud (tanpa akun atau data pribadi).

Next dev dan semua skrip membaca `.env.development.local` sebelum `.env` (`scripts/load-env.ts`), jadi pekerjaan lokal tidak menyentuh cloud. Email OTP lokal masuk ke Mailpit di http://127.0.0.1:55624, dan Studio ada di http://127.0.0.1:55623. Hentikan stack dengan `bunx supabase stop`.

```bash
bun run db:migrate:dev
```

Perintah ini menampilkan migrasi yang pending di DB lokal. Tambahkan `-- --apply` untuk menerapkannya, atau `-- --apply --cloud` untuk project cloud (production). Tambahkan `-- --apply` untuk menerapkannya; script menolak berjalan saat `NODE_ENV=production`. Tidak ada lagi seed dummy: `scripts/retire-seed-data.ts` (sekali jalan, sudah diterapkan) menggantinya dengan data asli. Untuk data uji bervolume di DB lokal, pakai seeder sintetis `bun run db:seed` (dry run dulu; lihat `docs/data-engineering/seed-operations.md`). Seeder menolak project cloud. Tambah buku lewat pencarian di `/books` atau sinkron di Data Buku.

### Database

- DB di `.env` adalah Supabase cloud (pooler `ap-southeast-1`). Sejak 18 Okt 2026 project ini menjadi **production** dan dipakai https://temubaca.vercel.app. Dev, data uji, dan E2E pindah ke Supabase lokal (lihat di atas). Akun E2E di cloud sudah dihapus.
- Migrasi **0000–0011 sudah diterapkan** (0008 pinjam, 0009 komunitas, 0010 hapus akun/retensi, 0011 banding listing), dan `drizzle-kit check` lulus. `drizzle-kit migrate` tidak bisa tersambung (sertifikat pooler), jadi pakai `scripts/migrate-dev.ts`. Script ini mencatat hash SHA-256 file dan `when` jurnal di `drizzle."__drizzle_migrations__"`, sama seperti Drizzle.
- Helper `enumCheck` di `schema.ts` menulis literal, bukan `$1`. Tanpa itu, `drizzle-kit generate` menghasilkan DDL tidak valid dan mencoba membuat ulang semua check constraint.
- Setelah skema berubah, **restart dev server**. HMR tidak memuat ulang modul skema, dan errornya muncul sebagai `Cannot read properties of undefined (reading 'replace')`. Kalau error itu masih ada setelah restart, hentikan server, hapus `.next/dev` (cache Turbopack), lalu jalankan lagi.

### Variabel lingkungan yang dipakai

`SUPABASE_SERVICE_ROLE_KEY` (email di Data Pengguna, hapus pengguna Auth saat retensi, dan bucket bukti komunitas; khusus server, `src/lib/supabase/admin.ts` dan `storage.ts`), `GOOGLE_BOOKS_API_KEY` (tanpa key kena 429), `OPEN_LIBRARY_BASE_URL`, Upstash. Keduanya **sudah diisi** di `.env` milik pemilik repo. `INTERNAL_API_SECRET` (min. 32 karakter) **belum diisi**; tanpa itu `POST /api/internal/retention` untuk penjadwal mengembalikan 404.

## 4. Yang sudah selesai

### Setelah pembaruan dokumen 18 Okt (`12f1ca5`)

```
a8b9a32 chore(tooling): keep one copy of the Supabase skills in git
d9bf3e6 test(e2e): Playwright smoke tests for guest flows
e8bb99c fix(auth): send guests back to the page they asked for after login
e25491e feat(borrowing): loan history on each card and a loan summary on the dashboard
80d02dd feat(moderation): Ajukan Banding for hidden listings
```

- **Ajukan Banding** (Figma `301:2608`): banding pemilik untuk listing yang disembunyikan, diputus admin di Data Buku. Migrasi 0011.
- **Riwayat pinjaman** di tiap kartu dan **ringkasan pinjaman** di Dashboard.
- **TB-042:** audit guard API dan uji tanpa sesi. Redirect login kini membawa `?next=`; proxy menyimpan path di header `x-temubaca-path`, dan `redirectToLogin()` ada di `src/lib/auth/login-redirect.ts`.
- **Playwright:** `playwright.config.ts` dan `e2e/guest.e2e.ts`. Chromium headless terpasang di cache Playwright mesin ini.
- **Skills:** hanya `.claude/skills` yang di-commit; `.agents/` di-gitignore.

### Sejak handoff 17 Okt (`c1cf5e6`)

```
6a979e8 chore(tooling): Supabase MCP server and Supabase agent skills
8ddee6d fix(ui): keep the required marker next to counted labels
33a9ca4 feat(ui): Hapus Akun dialog, deletion banner, and retention settings
b926d04 feat(accounts): DEC-11 account deletion, data export, and retention
2680034 feat(ui): Ajukan Komunitas, Kelola Komunitas, and community evidence for admins
5c5568d feat(communities): DEC-04 community applications, managers, and content API
637503e feat(ui): Ajukan Pinjam, the Peminjaman tab of Buku Saya, and loan disputes for admins
8ffd23b feat(borrowing): DEC-02 loan lifecycle, API, and history
3b14d6a feat(ui): clear bookmarks and interests dialog, and the revised footer
2f97908 feat(ui): report dialog states and the Minat tab of Bookmark
d384768 feat(listings): Tambah Buku dialog and the Koleksi view of Buku Saya
0a70f93 feat(ui): slice revised Detail Buku, Komunitas & Acara, and Profil Komunitas
53448bd feat(ui): move report, catalog filter, and listing forms to shared components
d07fca3 feat(ui): shared form components and a dev component catalog (TB-015)
```

- **Form bersama (TB-015):** `src/components/ui/form.tsx` dipakai semua form. Katalog komponen di `/dev/components` (404 di production).
- **Slicing:** revisi Detail Buku, Komunitas & Acara, Profil Komunitas, Tambah Buku, Buku Saya - Koleksi, state dialog laporan, tab Minat, dialog Hapus Bookmark & Minat, dan footer. Rinciannya ada di `TASKS.md`, bagian catatan slicing.
- **Pinjam (DEC-02):**
  - Aturan transisi ada di `src/features/borrowing/lifecycle.ts`, query bertransaksi dengan row lock di `src/lib/db/queries/borrowing.ts`, dan API di `/api/borrow-requests`, `/api/borrowings`, dan `/api/admin/borrowings`.
  - UI: tombol Ajukan Pinjam di Detail Buku, tab Peminjaman di Buku Saya (kedua arah), dialog Tolak dan Laporkan Masalah, serta halaman admin Sengketa Pinjam (`/admin/loans`).
- **Komunitas (DEC-04/05):**
  - Aturan ada di `src/features/community-management/rules.ts`, query di `community-management.ts` dan `community-content.ts`.
  - Rute: Ajukan Komunitas (`/communities/new`), Komunitas Saya (`/communities/mine`), Kelola (`/communities/[id]/manage`: profil + verifikasi, acara, merchandise, pengurus), dan undangan pengurus (`/communities/invite/[token]`).
  - Bukti verifikasi berupa tautan, dengan catatan atau berkas opsional. Berkas disimpan di bucket privat `community-evidence`; bucket ini dibuat otomatis saat unggahan pertama.
  - Admin melihat bukti di Peninjauan dan Data Komunitas.
- **Hapus akun dan retensi (DEC-11):**
  - Aturan ada di `src/features/account-deletion/rules.ts`, tugasnya di `retention.ts`.
  - Masa tenggang 14 hari, dengan banner dan tombol Batalkan. Penghalang: pinjaman aktif dan komunitas terverifikasi milik akun; kepemilikan bisa diserahkan lewat "Jadikan pemilik" di Pengurus.
  - Ekspor JSON tersedia di `/api/me/export`.
  - Retensi: detail laporan dihapus setelah 12 bulan; audit, riwayat pinjam selesai, dan bukti komunitas setelah 24 bulan. Tombol "Jalankan sekarang" ada di Pengaturan → Retensi & Data.
- **Tooling:** server MCP Supabase di `.mcp.json` (otentikasi lewat `claude /mcp` belum dilakukan) dan skill resmi Supabase di `.agents/skills`. `.claude/skills` berisi salinan skill yang sama, karena git di Windows tidak menyimpan symlink.

### Handoff sebelumnya (`2ead832`)

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
| `/admin/settings` | `161:859` | Pengaturan Katalog Buku yang benar-benar berpengaruh; Peta & Lokasi (DEC-07), Moderasi & Publikasi (DEC-04/05), Aturan Pinjam (DEC-02), dan Retensi & Data (DEC-11) menampilkan kebijakan tetap dan status/antreannya, tanpa nilai yang dapat diubah |

- **Katalog:** adapter Open Library dan Google Books ada di `src/lib/external/books/`, dan sinkron per rekaman di `src/features/catalog/sync-book.ts`. Provider rekaman bersifat otoritatif, sedangkan provider lain hanya mengisi kolom kosong. Rekaman manual tanpa ISBN dicocokkan lewat judul + nama belakang penulis yang sama persis. Setiap percobaan dicatat di `book_sync_logs`.
- **Moderasi:** listing tersembunyi (`book_listings.hiddenAt`) dan listing milik akun tertangguh (`user_profiles.suspendedAt`) dikecualikan dari semua query publik. Akun tertangguh tetap bisa masuk dan membaca, tetapi `requireUser`/`requireApiUser` menolak setiap aksinya, dan area akun menampilkan banner berisi alasannya.
- **Audit:** keputusan verifikasi dan hide/restore listing dicatat di `verifications`. Tangguhkan, ubah peran, tampilkan email, dan ubah pengaturan dicatat di `admin_audit_logs`.

### Fitur pengguna

- Pemilik bisa menghapus listing dari Buku Saya (`DELETE /api/book-listings/[listingId]`). Penghapusan ditolak `409` bila listing `RESERVED` atau punya permintaan pinjam.
- Halaman detail buku menampilkan atribusi "Sumber data: …" kalau diaktifkan di Pengaturan.

## 5. Keputusan yang masih terbuka (jangan dibangun dulu)

DEC-02, DEC-04, DEC-05, dan DEC-11 sudah diputuskan pada 18 Okt 2026; rinciannya ada di `DECISIONS.md`. Yang masih terbuka:

- **Deploy:** https://temubaca.vercel.app (proyek Vercel `temubaca`, scope itzryzs-projects, auto-deploy dari `master`). Terhubung ke project Supabase cloud, yang kini menjadi production. Environment production dan preview diisi dari `.env`, ditambah `DATABASE_SSL_CA`, `DATABASE_POOL_MAX=3`, `INTERNAL_API_SECRET`, dan `CRON_SECRET` (acak, disimpan sensitive di Vercel). Framework proyek harus `nextjs`; tanpa itu semua halaman 404.
- **DEC-01** sudah diputuskan (Vercel + Supabase, project cloud = production, dev di Supabase lokal Docker, staging opsional di slot gratis kedua, Vercel Cron, region Singapura: Vercel `sin1`, Supabase `ap-southeast-1`). Yang masih terbuka: paket production, domain, dan backup.
- **DEC-03/DEC-12** (checkout, stok, pengiriman merchandise): memblokir TB-035. Merchandise tetap katalog dengan transaksi di luar platform.
- **DEC-06** (sebagian): aturan atribusi, cache, dan kuota provider katalog di production.
- **DEC-07** (peta/lokasi) sudah diputuskan 23 dan 25 Okt 2026 (`DECISIONS.md`); yang masih terbuka hanya target latensi rute dan penggantian provider tile bila trafik naik.
- **DEC-08, DEC-09, DEC-10**: layanan ML rekomendasi, target pengguna/wilayah/bahasa, serta tanggal rilis dan metrik.
- **DEC-13** (ketersediaan perpustakaan): TB-023 selesai 28 Okt 2026 dengan kurasi admin dan pengelola perpustakaan. OneSearch menunggu izin tertulis Perpusnas (`ONESEARCH_ENABLED`).
- **Sisa DEC-11:** kanal dukungan, SLA laporan, durasi backup production.

## 6. Langkah berikutnya (rekomendasi)

1. **Tanpa keputusan baru:** perluas E2E anggota (serah terima sampai kembali, tolak/batal/sengketa, Tambah Buku, komunitas, hapus akun) dan uji screen reader. Checklist SOP peninjauan butuh isi SOP dari pemilik repo.
2. **Uji nyata dengan dua akun:** pinjam (ajukan → terima → serah terima → kembali, plus tolak/batal/sengketa), komunitas (ajukan → setujui → acara/merchandise → undang pengurus → serahkan kepemilikan), unggah berkas bukti ke Storage, hapus akun (ajukan lalu batalkan), dan alur daftar OTP dengan email sungguhan.
3. **Pra-rilis TB-047 s.d. TB-050** (DEC-01 sudah diputuskan): rotasi kredensial, (Site URL Auth Supabase sudah `https://temubaca.vercel.app` dan Redirect URLs berisi `https://temubaca.vercel.app/**` sejak 18 Okt 2026), lalu policy RLS dan role runtime. Project staging (slot gratis kedua, `ap-southeast-1`) opsional.
4. Halaman kebijakan dari footer Figma (Pedoman Komunitas, Privasi, Syarat, Titik Temu Aman, Etika Bertukar, Verifikasi Anggota). Isinya harus dari pemilik repo.

## 7. Isi DB dev (setelah seed dipensiunkan, 17 Okt 2026)

- **Production berisi data seed sintetis sejak 27 Okt 2026** (29.426 baris, id `5eed0001-…`, atas keputusan pemilik repo): 1.500 profil tanpa akun Auth, 2.700 buku `MANUAL` sintetis, 100 komunitas, 434 acara, pinjaman, laporan, dan lainnya. Data asli tetap terpisah. Hapus dengan `bun run db:seed -- --cloud --production --cleanup --apply` (ditolak bila data asli menunjuk baris seed). Lihat `docs/data-engineering/seed-operations.md`.

- **Tidak ada lagi baris dummy** (`5eed0000-…`): profil, listing, komunitas, acara, merchandise, dan keanggotaan dummy sudah dihapus beserta auditnya, begitu pula listing QA *Ronggeng Dukuh Paruk*.
- **Peta Literasi production: 196 titik dari OpenStreetMap** (26 Okt 2026): 15 perpustakaan umum dan 181 titik temu publik (163 RPTRA, 5 taman kota Jakarta, Taman Literasi Martha Tiahahu, dan 12 alun-alun/taman kota/hutan kota di Tangerang), Jakarta dan Tangerang. Checksum isi tabel sama dengan file setelah penambahan Tangerang. Dataset `scripts/data/places-osm.json` (kolom `source` menyimpan elemen OSM); `bun run places:import -- --apply [--cloud]` melewati baris yang `source`-nya sudah ada dan mencatat `PLACE_CREATED` di jejak audit tanpa aktor. Production diisi lewat Supabase MCP dengan SQL yang setara; checksum isi tabel sama dengan file. Admin memperbaiki atau menyembunyikan titik di `/admin/places`.
- **Komunitas production: kosong** (26 Okt 2026). Komunitas uji "Klub Suka Suka" (dibuat 18 Okt 2026, `VERIFIED`, tanpa tag minat, kab/kota, acara, atau merchandise) dihapus atas permintaan pemilik repo, bersama undangan, keanggotaan, pengajuan verifikasi, dan catatan `verifications`-nya; tidak ada berkas bukti di storage.
- **Katalog production: 330 buku** (192 Open Library, 138 Google Books). Pada 18 Okt 2026, 316 di antaranya diimpor massal dengan `bun run books:import -- --apply --cloud` (`scripts/import-books.ts`). Skrip itu memakai adapter provider yang sama dengan aplikasi, melewati rekaman tanpa penulis atau sampul serta buku ajar/buletin, dan mencegah duplikat lewat provider id, ISBN, serta judul + penulis pertama. Setiap buku impor punya log sinkron `IMPORT` bertuliskan "Impor massal katalog". Untuk `--cloud`, set `DATABASE_SSL_CA` di shell (CA Supabase), karena `.env` tidak memuatnya. 14 buku lama diimpor lewat `POST /api/books/import`. Pada 18 Okt 2026, atas permintaan pemilik repo, semua baris berprefix `5eed0000` dihapus dari production: 7 buku bekas dummy (termasuk Bumi Manusia, Laut Bercerita, dan Pulang), 18 log sinkron, listing Bumi Manusia milik Ilyas Maulana, serta laporan REVIEWING dan REJECTED yang menargetkan buku itu. DB lokal di mesin pemilik repo berisi 320 buku dari uji coba skrip impor; `db:local` pada stack baru menyalin katalog cloud.
- **Komunitas, acara, dan merchandise kosong.** Jangan dikarang; isi hanya dengan data sungguhan dari pemilik repo.
- `app_settings.catalog` berisi nilai default, dengan 2 baris audit `SETTINGS_UPDATED`.
- **Akun per 18 Okt:** pemilik repo (admin), Ilyas Maulana, Sayli, dan Naura (akun uji yang dibuat pemilik di browser pane). Belum ada pinjaman, komunitas, pengajuan, atau unggahan Storage; bucket `community-evidence` belum terbuat.
- Data uji sementara untuk uji klik dialog (3 listing di buku "Amba", 3 permintaan pinjam, komunitas "[QA] Komunitas Uji") **sudah dihapus**. DB kembali ke 1 listing, 0 permintaan, 0 komunitas.

## 8. Catatan teknis dan jebakan

- **Subquery berkorelasi di `sql` Drizzle** harus memakai nama tabel ber-kutip dan terkualifikasi (`"book_listings"."bookId" = "books"."id"`). `${col}` di dalam subquery dirender tanpa kualifikasi.
- **Item grid/flex yang berisi daftar `overflow-x-auto`** butuh `min-w-0`, kalau tidak halaman meluap di mobile (sudah diperbaiki di sidebar admin dan navigasi Pengaturan). Kata panjang seperti nama env var butuh `break-all`.
- **Google Books:** query `isbn:` sering kosong untuk edisi Indonesia, dan inisial penulis membuat pencarian meleset. Karena itu sinkron memakai judul + nama belakang penulis.
- **Line ending LF** dipaksa lewat `.gitattributes`. Kalau menulis file dari Python di Windows, pakai `newline='\n'`. Untuk edit multi-baris, lebih aman memakai file script daripada heredoc bash yang berisi backtick atau `$`.
- **Log dev:** argumen Server Function tidak lagi dicatat (`logging.serverFunctions: false`). Kata sandi pemilik repo sempat tercatat sebelum perubahan ini, dan pemilik sudah disarankan menggantinya.
- Helper API di `@/lib/api`: `withApiHandler`, `parseBody`, `parseParams`, `apiSuccess`, `ConflictError`, `NotFoundError`, `requireApiRateLimit`. Guard: `requireAdmin` (`@/lib/permissions/guards`). Skema param umum ada di `@/lib/validation/common`.
- Token desain ada di `src/app/globals.css`. Untuk teks sekunder pakai `text-muted-foreground` (`#5d6760`).
- Setelah mutasi dari client, panggil `router.refresh()` atau `router.replace(...)`.
- **Browser pane yang tersembunyi atau tertutup jendela lain tidak me-render halaman**, sehingga hydration tidak pernah selesai dan tombol client tidak bereaksi. Tampilkan pane dulu sebelum menguji klik. Untuk verifikasi tanpa render, ambil HTML lewat `fetch` dan uji API langsung.
- Uji klik memakai fetch tiruan (`window.fetch` diganti sementara) supaya tidak ada data yang tertulis. Bila butuh data, buat fixture dengan penanda `[QA]`, catat ID-nya, lalu hapus dan verifikasi jumlah baris kembali seperti semula.
- Self-join tabel profil di Drizzle memakai `alias()` dari `drizzle-orm/pg-core` (lihat `borrowing.ts`), bukan `sql` mentah.
- Jebakan alat uji browser: screenshot dengan emulasi viewport tidak stabil, jadi ukur layout lewat iframe tersembunyi + `scrollWidth`. `get_page_text` kadang menangkap fallback `loading.tsx` ("Memuat TemuBaca…"); ambil teks lagi setelah jeda.

## 9. Belum diverifikasi

- Transisi pinjam, komunitas, dan hapus akun dengan dua akun nyata. Semua dialog sudah diuji klik dengan fetch tiruan, dan semua alur sudah diuji di PGlite.
- Unggah berkas bukti dan foto banding ke Supabase Storage, serta pembukaan lewat URL bertanda tangan.
- Tugas retensi terhadap DB dev (belum pernah dijalankan; menulis audit `RETENTION_RUN`).
- Alur daftar OTP dengan email sungguhan (reset kata sandi sudah diuji pemilik).
- Tombol Keluar di `/logout` (sengaja tidak diklik agar sesi pemilik tetap aktif).
- Tindakan Tangguhkan/Pulihkan dari halaman Data Komunitas (endpointnya sama dengan Peninjauan, yang sudah diuji).
- Penolakan akses pengguna non-admin ke portal admin (belum ada akun non-admin untuk uji).
- Uji screen reader.
