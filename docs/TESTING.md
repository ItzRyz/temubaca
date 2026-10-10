# Pengujian TemuBaca

**Status:** panduan dan catatan pemeriksaan repo, bukan klaim uji penerimaan.

## Pemeriksaan yang tersedia

```bash
bun run check
bun run build
bunx drizzle-kit check
git diff --check
```

`bun run check` menjalankan typecheck, lint, dan unit/integration test dengan Bun. Build tetap terpisah dan bukan pengganti tes perilaku.

Pada 2026-10-10, semua migrasi SQL dijalankan berurutan terhadap PostgreSQL in-memory PGlite dan berhasil membuat 18 tabel publik. Ini memeriksa sintaks dan urutan migrasi, bukan menggantikan pengujian terhadap PostgreSQL/Supabase staging. Perilaku RLS, koneksi pooler, dan perbedaan provider masih perlu diuji di staging.

## Catatan lokal

Pada 2026-10-10, typecheck, lint, production build, `drizzle-kit check`, dan `git diff --check` dijalankan. Test parser request mencakup tipe konten, JSON rusak, serta batas ukuran stream. Validasi auth mencakup normalisasi email, batas kata sandi sign-in/reset, batas email reset, dan field yang ditolak; validasi environment mencakup origin HTTP(S), HTTPS production, URL tanpa kredensial/path, HTTPS Upstash, serta skema URL PostgreSQL; test konfigurasi database memeriksa CA tambahan, verifikasi sertifikat, dan deteksi opsi TLS dalam URL. Validasi laporan mencakup payload, ID, filter, dan status tinjauan; query katalog publik mencakup pagination, normalisasi pencarian, dan penolakan field tak dikenal. Test migrasi menjalankan SQL pada database kosong in-memory; test ini tidak menilai hak akses multi-user, layanan eksternal, atau browser desktop/mobile. `drizzle-kit check` hanya memeriksa konsistensi snapshot/journal.

Smoke test server hasil production build pada 2026-10-10 mengembalikan `200` untuk `/`, `/about`, dan `/login`, serta `404` untuk rute acak. Tanpa cookie, `/dashboard` menghasilkan redirect streaming Next menuju `/login`; karena redirect streaming dilakukan di sisi klien, smoke HTTP mentah ini bukan pengganti uji navigasi browser. Sesi login sungguhan dan rute yang bergantung pada PostgreSQL, Supabase Auth, atau Upstash belum diuji dalam smoke ini.

Pada build lokal yang lebih baru, route publik berbasis komunitas/acara ditandai dinamis agar tidak melakukan query database saat prerender. Database lokal saat itu menolak TLS dengan `SELF_SIGNED_CERT_IN_CHAIN`; validasi sertifikat tidak dilonggarkan. Runtime query terhadap database lokal dan browser end-to-end tetap belum terverifikasi sampai tersedia sertifikat tepercaya atau environment staging yang benar.

## Rencana cakupan sebelum rilis

- Unit: validasi schema, policy/ownership, normalisasi data eksternal setelah provider dipilih.
- Integrasi: Route Handlers dengan database uji, session tanpa login, pemilik vs pengguna lain, konflik listing/bookmark, dan rate limit.
- E2E: pencarian → detail → bookmark; buat dan kelola listing; alur peminjaman hanya setelah `DEC-02` disetujui.
- Manual: keyboard, layar kecil, loading/error/empty state, dan pemeriksaan lokasi publik agar tidak menampilkan alamat rumah.
- Migrasi: terapkan semua migrasi pada database uji kosong dan bandingkan hasilnya dengan `src/lib/db/schema.ts` sebelum staging/produksi.
