# Pengujian TemuBaca

**Status:** panduan dan catatan pemeriksaan repo, bukan klaim uji penerimaan.

## Pemeriksaan yang tersedia

```bash
bun run check
bun run build
bun run test:e2e
bunx drizzle-kit check
git diff --check
```

`bun run check` menjalankan typecheck, lint, dan unit/integration test dengan Bun. Build tetap terpisah dan bukan pengganti tes perilaku.

`bun run test:e2e` menjalankan smoke E2E Playwright (`e2e/*.e2e.ts`, Chromium desktop dan Pixel 7) terhadap dev server di `localhost:3000`; server dijalankan otomatis bila belum ada. Setel `E2E_BASE_URL` untuk staging. Per 18 Okt 2026 cakupannya alur tamu:
- halaman utama, katalog, pencarian, dan detail buku tanpa overflow horizontal;
- ajakan masuk sebelum meminjam;
- redirect halaman privat ke `/login?next=…`;
- tautan Ajukan Komunitas;
- undangan tidak valid dan halaman 404.

Alur dengan login ada di `e2e/member.e2e.ts` (desktop saja, berurutan). Tes ini memakai dua akun uji khusus di Supabase dev, "E2E Pemilik" dan "E2E Peminjam". Buat atau perbarui akun itu dengan:

```bash
bun scripts/e2e-accounts.ts
```

Skrip itu membuat akun yang emailnya sudah terkonfirmasi, menyetel kata sandi acak baru di tiap run, dan menulis kredensial ke `.env.e2e` (di-gitignore, tidak pernah dicetak). Tanpa `.env.e2e`, tes anggota dilewati.

Global setup login sekali per akun dan menyimpan sesi di `e2e/.auth/` (di-gitignore). Global setup dan teardown menghapus semua data yang dibuat dua akun itu: listing, permintaan, event dan pinjaman, bookmark, minat, dan rekomendasi. Profilnya tetap ada. Cakupan per 18 Okt 2026:
- halaman privat terbuka untuk anggota tanpa overflow;
- anggota mendapat halaman 404 di `/admin`, `/admin/users`, `/admin/loans`, dan `/moderation/reports`, serta 403 dari API admin;
- simpan buku, buku tampil di Bookmark, lalu lepas lagi;
- pilih dan lepas minat baca;
- alur pinjam dua akun: pemilik membuat listing, peminjam mengajukan dari halaman buku, pemilik menerima, lalu kedua pihak melihat tombol Konfirmasi Serah Terima.

Total 19 tes lulus. `notFound()` di layout portal dipanggil setelah streaming dimulai, sehingga status HTTP tetap 200. Karena itu tes memeriksa isi halaman 404, bukan statusnya.

Pada 2026-10-10, semua migrasi SQL dijalankan berurutan terhadap PostgreSQL in-memory PGlite dan berhasil membuat 18 tabel publik. Ini memeriksa sintaks dan urutan migrasi, bukan menggantikan pengujian terhadap PostgreSQL/Supabase staging. Perilaku RLS, koneksi pooler, dan perbedaan provider masih perlu diuji di staging.

## Catatan lokal

Pada 2026-10-10, typecheck, lint, production build, `drizzle-kit check`, dan `git diff --check` dijalankan. Test parser request mencakup tipe konten, JSON rusak, serta batas ukuran stream. Validasi auth mencakup normalisasi email, batas kata sandi sign-in/reset, batas email reset, dan field yang ditolak; validasi environment mencakup origin HTTP(S), HTTPS production, URL tanpa kredensial/path, HTTPS Upstash, serta skema URL PostgreSQL; test konfigurasi database memeriksa CA tambahan, verifikasi sertifikat, dan deteksi opsi TLS dalam URL. Validasi laporan mencakup payload, ID, filter, dan status tinjauan; query katalog publik mencakup pagination, normalisasi pencarian, dan penolakan field tak dikenal. Test migrasi menjalankan SQL pada database kosong in-memory; test ini tidak menilai hak akses multi-user, layanan eksternal, atau browser desktop/mobile. `drizzle-kit check` hanya memeriksa konsistensi snapshot/journal.

Smoke test server hasil production build pada 2026-10-10 mengembalikan `200` untuk `/`, `/about`, dan `/login`, serta `404` untuk rute acak. Tanpa cookie, `/dashboard` menghasilkan redirect streaming Next menuju `/login`; karena redirect streaming dilakukan di sisi klien, smoke HTTP mentah ini bukan pengganti uji navigasi browser. Sesi login sungguhan dan rute yang bergantung pada PostgreSQL, Supabase Auth, atau Upstash belum diuji dalam smoke ini.

Pada build lokal yang lebih baru, route publik berbasis komunitas/acara ditandai dinamis agar tidak melakukan query database saat prerender. Database lokal saat itu menolak TLS dengan `SELF_SIGNED_CERT_IN_CHAIN`; validasi sertifikat tidak dilonggarkan. Runtime query terhadap database lokal dan browser end-to-end tetap belum terverifikasi sampai tersedia sertifikat tepercaya atau environment staging yang benar.

## Rencana cakupan sebelum rilis

- Unit: validasi schema, policy/ownership, normalisasi data eksternal setelah provider dipilih.
- Integrasi: Route Handlers dengan database uji, session tanpa login, pemilik vs pengguna lain, konflik listing/bookmark, dan rate limit.
- E2E: alur tamu dan alur anggota dasar sudah ada (lihat di atas). Berikutnya: serah terima sampai pengembalian, tolak/batal/sengketa, buat listing lewat dialog Tambah Buku, komunitas, dan hapus akun. Di staging, pakai DB terpisah.
- Manual: keyboard, layar kecil, loading/error/empty state, dan pemeriksaan lokasi publik agar tidak menampilkan alamat rumah.
- Migrasi: terapkan semua migrasi pada database uji kosong dan bandingkan hasilnya dengan `src/lib/db/schema.ts` sebelum staging/produksi.
