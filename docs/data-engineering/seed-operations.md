# Operasi seed data sintetis

Default-nya **stack Supabase lokal**. Host selain `localhost`/`127.0.0.1` ditolak kecuali dengan `--cloud --production`, karena satu-satunya project cloud adalah production. `NODE_ENV=production` selalu ditolak, dan profil `stress` tidak diizinkan di production. Seeder tidak membuat akun Supabase Auth, tidak mengirim email, dan tidak memanggil layanan luar.

## Production (keputusan pemilik repo, 27 Okt 2026)

Pemilik repo memutuskan memasukkan data seed penuh ke production setelah diberi tahu risikonya:

- Acara sintetis mendatang tampil di peta, di tempat publik yang nyata.
- Komunitas, buku, dan akun fiktif tampil seperti data asli.
- Snapshot ML ikut memuat data seed.
- Cleanup ditolak bila pengguna asli sudah berinteraksi dengan baris seed.

Urutan wajib:

1. Backup manual (`docs/OPERATIONS.md` → Backup), disimpan di luar repo.
2. `bun run db:seed -- --cloud --production` (dry run, read-only).
3. `bun run db:seed -- --cloud --production --apply`.
4. `bun run db:seed -- --cloud --production --verify`, lalu cek halaman production.

`--cloud` memakai `.env` dan TLS ketat dengan `DATABASE_SSL_CA`. Untuk menghapus: `bun run db:seed -- --cloud --production --cleanup [--apply]`.

`DATABASE_SSL_CA` tidak disimpan di `.env`. Ekspor dari berkas CA Supabase (dashboard → Database → Settings → SSL Configuration): `export DATABASE_SSL_CA="$(cat ~/Downloads/prod-ca-2021.crt)"`. Tanpa CA, koneksi gagal `SELF_SIGNED_CERT_IN_CHAIN`, dan verifikasi TLS tidak dimatikan.

**Diterapkan 27 Okt 2026:**

| Langkah | Hasil |
|---|---|
| Backup | `~/temubaca-backup/2026-10-27/` (roles, schema, data: 5 akun, 330 buku, 196 tempat, 1 listing, 20 migrasi), di luar repo, izin 700/600; enkripsi gpg dilakukan pemilik |
| Dry run | 29.426 baris (referensi: 196 tempat, 330 buku asli), pemeriksaan in-memory lulus |
| `--apply` | 29.426 baris baru dalam 5,4 s, 0 ulangan, 0 error, 23/23 pemeriksaan SQL lulus |
| Data asli | Tidak berubah (jumlah baris bukan seed sama dengan backup); 5 akun Auth, tanpa akun baru |
| Halaman | `/`, `/books`, `/communities`, `/events`, `/merchandise`, `/map`, detail komunitas: 200; `/map` 32 pin komunitas + 52 pin acara; `/api/places` 200 |
| Ukuran DB | 21 MB (kuota Free 500 MB) |

**Tabel tambahan, 28 Okt 2026 (kemudian dicabut hari yang sama, lihat bawah):** `libraries` (15) dan `book_accesses` ditambahkan ke seed yang sudah ada tanpa cleanup (lihat seed-strategy, Idempotensi). Di DB lokal: dry run menunjukkan sidik jari baris lama sama, `--apply` menulis 1.091 baris baru dan 0 diubah, 25/25 pemeriksaan SQL lulus, run ulang 0 baris baru. **Production, 28 Okt 2026:** dry run pertama ditolak karena pengguna asli menambah 2 buku setelah seed dibuat, sehingga sidik jari referensi berubah. Seeder kini membangun ulang dari referensi saat seed dibuat: data asli yang ditambahkan setelahnya diabaikan, asalkan ada batas waktu yang menghasilkan sidik jari tersimpan persis (`referenceAsSeeded`). Hasil: dataset lama terbukti identik, `--apply` menulis 1.027 baris baru (15 `libraries`, 1.012 `book_accesses`) dalam 21,7 s, 0 diubah, 25/25 pemeriksaan lulus, dan run ulang 0 baris baru. Data asli tidak tersentuh (6 akun, 332 buku, 6 listing); ukuran DB 22 MB. Migrasi 0020 diterapkan sebelumnya pada hari yang sama.

**Dicabut, 28 Okt 2026:** `libraries` dan `book_accesses` menjadi fitur nyata TB-023. Migrasi 0021 menghapus baris seed kedua tabel, dan seeder tidak lagi mengisinya; dataset 19 tabel lainnya tetap sama. Perpustakaan nyata dibuat dengan `bun run libraries:import -- --apply [--cloud --production]`.

Dampak lanjutan: snapshot ML (`bun run ml:snapshot`) berikutnya memuat buku dan komunitas seed, sehingga rekomendasi untuk pengguna asli bisa menyarankan data sintetis.

## Persiapan

```bash
bunx supabase start      # stack lokal
bun run db:local         # .env.development.local + migrasi (salin katalog cloud bila .env ada)
bun run books:import -- --apply   # opsional: buku asli Open Library/Google Books sebagai referensi
```

Tempat kurasi (`bun run places:import -- --apply`) dipakai sebagai titik temu, venue, dan pin. Tanpa tempat kurasi, acara menjadi daring dan listing tanpa titik temu peta.

Di laptop pemilik repo, jalankan dengan batas sumber daya:

```bash
lim() { systemd-run --user --scope -q -p MemoryMax=3G -p CPUQuota=200% nice -n 10 "$@"; }
```

## Perintah

| Tujuan | Perintah |
|---|---|
| Dry run (default normal, read-only) | `bun run db:seed` |
| Dry run profil lain | `bun run db:seed -- --profile small` |
| Seed small | `bun run db:seed -- --profile small --apply` |
| Seed normal | `bun run db:seed -- --apply` |
| Seed large | `bun run db:seed -- --profile large --apply` |
| Seed stress | `bun run db:seed -- --profile stress --apply --confirm-stress` |
| Validasi + laporan | `bun run db:seed -- --verify --report docs/data-engineering/data-quality-report.md` |
| Rencana cleanup | `bun run db:seed -- --cleanup` |
| Cleanup | `bun run db:seed -- --cleanup --apply` |
| Jangkar tetap | tambah `--anchor 2026-10-27` (hanya untuk DB yang belum di-seed) |

Dry run menampilkan target (host dan db, tanpa kredensial), jangkar, jumlah baris per tabel, baris seed yang sudah ada, jumlah batch, perkiraan ukuran, hasil pemeriksaan in-memory, dan contoh baris. Koneksi dry run dibuka dengan `default_transaction_read_only=on`.

`--apply` menjalankan semua pemeriksaan SQL setelah menulis dan keluar dengan kode 1 bila ada pelanggaran.

## Mengganti profil atau generator

Satu DB hanya menampung satu seed. Untuk berganti profil, setelah mengubah `generate.ts`, atau setelah data referensi (tempat kurasi/buku asli) berubah: `--cleanup --apply`, lalu seed lagi. Saat mengubah generator, naikkan `SEED_VERSION` (`config.ts`). Tanpa itu, sidik jari dataset juga akan menolak run ulang.

## Cleanup

- Hanya baris dengan id `5eed0001-…` yang dihapus, bukan baris yang "terlihat seperti" data uji.
- Sebelum menghapus, seeder memeriksa semua foreign key di katalog Postgres dan `targetId` laporan/verifikasi/rekomendasi/audit. Bila ada baris bukan seed yang menunjuk baris seed (misalnya akun E2E membookmark buku seed), cleanup **ditolak** dan menampilkan tabel dan kolomnya. Baris itu harus diputuskan manual.
- Penghapusan berjalan dalam satu transaksi, dengan urutan anak lebih dulu.

## Hasil terukur (27 Okt 2026, DB lokal, profil normal)

| Langkah | Hasil |
|---|---|
| Dry run | 30.535 baris direncanakan, pemeriksaan in-memory lulus, ±8,3 MB JSON, generator 0,6 s |
| `--apply` pertama | 30.535 baris baru dalam 2,0 s (72 batch, 0 ulangan, 0 error), 23/23 pemeriksaan SQL lulus |
| `--apply` kedua | 0 baru, 30.535 dilewati, 0 diubah |
| `--cleanup` | 30.535 baris, tidak ada data lain yang bergantung |
| `--cleanup --apply` lalu seed ulang | Dihapus semua dalam satu transaksi; seed ulang identik |

Dry run `large` (DB belum di-seed, sebelum penyesuaian tingkat penolakan): 127.786 baris, lulus, generator 1,7 s. Selama DB berisi seed `normal`, dry run profil lain ditolak dengan pesan cleanup. `stress` belum pernah dijalankan.

## Keterbatasan

- Akun seed tidak bisa login (tanpa Auth). Untuk mencoba halaman anggota/admin, login dengan akun E2E. Untuk halaman admin lokal, ubah role akun E2E menjadi ADMIN di DB lokal, lalu kembalikan.
- `/api/places` (dan route lain yang memakai rate limit) gagal 500 di lokal karena Upstash tidak bisa dijalankan di Redis lokal (`allow-key-locking`). Ini masalah lama, bukan dari seed. Halaman `/map` merender pin dari server.
- Merchandise tanpa foto, dan komunitas tanpa logo, karena tidak ada berkas gambar yang diunggah.
