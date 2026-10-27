# Operasi seed data sintetis

Hanya untuk **stack Supabase lokal**. Seeder menolak `--cloud`, `NODE_ENV=production`, dan host selain `localhost`/`127.0.0.1`, karena satu-satunya project cloud adalah production. Seeder tidak membuat akun Supabase Auth, tidak mengirim email, dan tidak memanggil layanan luar.

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
