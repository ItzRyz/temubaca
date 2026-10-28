# Strategi seed data sintetis

Kode: `scripts/seed/` (`config.ts`, `random.ts`, `ids.ts`, `vocab.ts`, `generate.ts`, `validate.ts`, `apply.ts`, `index.ts`). Audit skema: [schema-audit.md](schema-audit.md). Cara menjalankan: [seed-operations.md](seed-operations.md).

## Prinsip

1. **Mengikuti jalur tulis aplikasi.** Setiap baris dibentuk seperti hasil route handler: pinjaman berjalan dari permintaan, diterima, dua konfirmasi serah terima, pinjaman, sampai dua konfirmasi pengembalian, dengan peristiwa dan `availability` yang sama dengan `src/lib/db/queries/borrowing.ts`. Komunitas berjalan dari pengajuan ke review, lalu konten. Konstanta aplikasi dipakai langsung: `loanDayChoices`, `rejectionReasons`, `problemReasons`, `composeListingDetails`, `genres`, `merchandiseCategories`, `reportReasonsFor`, `regionByCode`.
2. **Tidak mengarang fakta yang bisa dikira asli.** Buku sintetis tidak punya ISBN atau sampul dan ditandai `metadata.synthetic`. Kontak hanya email `@temubaca.test` (TLD `.test` dicadangkan, tidak bisa dikirimi email); Instagram dan WhatsApp kosong, karena handle atau nomor apa pun bisa milik orang sungguhan. Tautan bukti dan acara daring memakai `*.temubaca.test`. Koordinat pin selalu koordinat tempat kurasi OSM yang sudah ada; tidak ada koordinat acak.
3. **Tabel yang tidak dipakai aplikasi tidak diisi**: `orders`/`order_items`, `recommendations`, `book_sync_logs`, `app_settings` (alasannya di schema audit). Target volume brief untuk tabel ini sengaja tidak dipenuhi. Pengecualian, atas permintaan pemilik repo 28 Okt 2026: `libraries` dan `book_accesses` diisi walau belum dibaca halaman mana pun. Isinya diturunkan dari data yang sudah ada, tanpa fakta baru: perpustakaan dari tempat LIBRARY kurasi (tanpa jam buka atau situs web karangan), dan akses dari pinjaman yang pernah diterima.
4. **Deterministik.** RNG `mulberry32` berbenih, dengan `fork(label)` per tabel. `Math.random` tidak dipakai (ada tesnya). Benih + tanggal jangkar + data referensi yang sama menghasilkan baris yang sama.

## Grafik ketergantungan dan urutan insert

```
user_profiles ─┬─> communities ─┬─> community_submissions
               │                ├─> community_invites
               │                ├─> community_memberships
               │                ├─> events ──> places (EVENT)
               │                ├─> places (COMMUNITY)
               │                └─> merchandise_listings
books ─────────┴─> book_listings ──> borrow_requests ─┬─> borrowings
                        │                             └─> borrow_events
                        └─> listing_appeals
reports, verifications, admin_audit_logs  (targetId tanpa FK, divalidasi)
user_interests, bookmarks
places kurasi (LIBRARY/MEETING_POINT, data asli) ──> titik temu listing, venue acara, pin
```

Urutan insert ada di `SEED_TABLES` (`ids.ts`). Cleanup menghapus dengan urutan terbalik.

## Model waktu

- **Jangkar** = tengah malam UTC hari eksekusi (atau `--anchor`). Aktivitas mulai `months` bulan sebelumnya (`normal`: 9). Jangkar disimpan di metadata seed, jadi run ulang memakai jangkar yang sama.
- **Pendaftaran tumbuh**: kepadatan naik menuju jangkar (√u). Admin mendaftar di minggu pertama; segmen *recent* dalam 3 minggu terakhir; *dormant* berhenti aktif ≥ 60 hari sebelum jangkar.
- Setiap aktivitas terjadi setelah akun dan objeknya dibuat, dan sebelum pengguna berhenti aktif.
- Acara bisa di masa depan; `createdAt` tidak pernah melewati jangkar. Jadwal acara pukul 09.00–19.00 WIB.
- OVERDUE tidak disimpan. Pinjaman ACTIVE dengan `dueAt` yang sudah lewat tampil sebagai terlambat, sama seperti di aplikasi.

## Distribusi

| Aspek | Model |
|---|---|
| Segmen pengguna | power 3%, high 12%, normal 42%, low 25%, dormant 12%, recent 6%; pengali aktivitas 6 / 2,5 / 1 / 0,35 / 0,6 / 0,7 dengan noise lognormal |
| Popularitas buku | Zipf (s = 0,85) atas urutan acak: sedikit buku diminati banyak pembaca |
| Genre | Berbobot: fiksi sastra dan sastra Indonesia dominan, puisi dan isu sosial jarang |
| Bookmark/anggota/acara | Lognormal (berekor panjang); anggota berbobot wilayah ×4 dan minat yang sama ×2,5 |
| Status komunitas | VERIFIED 58%, PENDING 17%, REJECTED 15%, SUSPENDED 10%; sebagian ditolak dulu lalu diterima, dan sebagian diverifikasi ulang |
| Pinjaman per salinan | Putaran permintaan berurutan (1–3 peminjam bersaing), pemilik menolak 20%, menerima 80% (yang lain ditolak otomatis), batal sebelum serah terima 8%, perpanjangan 15% (diterima 70%), terlambat 22%, sengketa 4,5% (diputuskan RETURNED 65% / LOST 35%) |
| Laporan | Berbobot jenis target; peluang sudah diputus naik dengan umur laporan. Setiap penangguhan akun dan listing tersembunyi didahului laporan yang RESOLVED. |
| Harga merchandise | Rentang per kategori (Rp 8 ribu – 220 ribu), dibulatkan ke Rp 5.000; 8% tanpa harga dengan catatan |

Profil (`config.ts`): `small` (120 pengguna, untuk tes), `normal` (1.500), `large` (6.000), `stress` (30.000, butuh `--confirm-stress`).

## Idempotensi dan kepemilikan

- **Id deterministik** `5eed0001-<kode tabel>-4000-8000-<nomor>`. Prefiks inilah bukti bahwa sebuah baris milik seed; kolom penanda tidak ditambahkan ke skema.
- Insert memakai `on conflict (id) do nothing`, sehingga baris yang sudah ada (seed atau bukan) **tidak pernah ditimpa**.
- **Metadata seed** disimpan di `preferences.seed` profil seed pertama, berisi versi, profil, benih, jangkar, sidik jari referensi, dan sidik jari dataset. Run ulang dengan profil, generator, atau data referensi yang berbeda ditolak, agar dua dataset tidak tercampur. Celah ini ditemukan saat pengujian: generator yang diubah tanpa menaikkan `SEED_VERSION`.
- **Tabel tambahan** (`SEED_EXTENSION_TABLES`: `libraries`, `book_accesses`, 28 Okt 2026) diletakkan di akhir `SEED_TABLES` sehingga kode id tabel lama tetap, dibangun tanpa RNG dari baris yang sudah ada, dan punya sidik jari sendiri (`extensions`). Seed lama tanpa `extensions` mendapat tabel ini pada `--apply` berikutnya, hanya bila `dataset` tabel lama masih sama persis; metadata lalu diperbarui. `SEED_VERSION` tidak dinaikkan karena nilainya ikut tertulis di baris buku seed.
- Satu transaksi per tabel. Kegagalan sementara diulang (`maxRetries`). Run yang terputus dilanjutkan dengan menjalankan perintah yang sama (diuji: tabel yang hilang diisi ulang, tabel lain dilewati).

## Temuan kualitas data

Profil `normal`, jangkar 27 Okt 2026, diukur di DB lokal. Angka lengkap ada di [data-quality-report.md](data-quality-report.md).

| Temuan | Disengaja? | Penjelasan |
|---|---|---|
| Permintaan pinjam menumpuk di bulan terakhir (Okt ±48%, Mar–Mei < 2%) | Ya | Pendaftar tumbuh setiap bulan dan listing bertambah kumulatif, jadi aktivitas pinjam naik tajam. Oktober baru sampai tanggal 27. Kurva bisa dilandaikan lewat `months` atau model pertumbuhan di `generate.ts`. |
| REJECTED 36% dari permintaan | Ya | Sebagian besar adalah penolakan otomatis aplikasi saat permintaan lain untuk salinan yang sama diterima. Penolakan pemilik diturunkan dari 28% ke 20% setelah run pertama (sebelumnya 43%). |
| SUSPENDED 17 dari 100 komunitas (bobot 10%) | Tidak, variasi acak | Hasil undian benih ini. Tidak dikoreksi, karena memaksakan proporsi persis membuat data tampak buatan. Ganti `seed` di `config.ts` bila perlu. |
| Semua listing memakai buku sintetis | Keterbatasan lokal | DB lokal tidak punya buku asli (0 baris; `.env` cloud tidak ada, jadi `db:local` tidak menyalin katalog). Jalankan `books:import -- --apply` sebelum seed agar sebagian bookmark dan listing memakai buku asli. |
| Listing per pemilik: median 1, maksimum 13 | Ya | Pengguna power dan high memegang sebagian besar salinan. |
| Bookmark per pengguna: median 2, p99 31, maksimum 120 | Ya | Lognormal per segmen; pengguna dormant dan recent sedikit. |
| Tanpa data `orders`, `recommendations`, `book_sync_logs` | Ya | Tidak dibaca aplikasi, atau akan berupa peristiwa palsu (schema audit §3). |
| Tidak ada timestamp identik massal, status seragam, atau ukuran komunitas sama | — | Diperiksa lewat distribusi bulanan, persentil, dan status di laporan. |
