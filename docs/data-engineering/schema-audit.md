# Schema audit untuk seeding

Diaudit 27 Okt 2026 dari kode (`src/lib/db/schema.ts`, migrasi `drizzle/migrations/0000`–`0019`, `src/lib/db/queries/*`, aturan di `src/features/*`) dan dari DB lokal (`supabase_db_temubaca`, Postgres 17). Ini audit untuk keperluan seed; skema lengkap ada di [DATABASE.md](../DATABASE.md).

## 1. Environment (Phase 0)

| Hal | Temuan |
|---|---|
| Target seed | Stack Supabase lokal (Docker), host `127.0.0.1:55622`, db `postgres`. `.env.development.local` ditulis `bun run db:local`; `DATABASE_URL` dan `DIRECT_URL` ada (nilai tidak dicetak). |
| Cloud | Satu-satunya project cloud (`tpwadnezwjgfrjtqdbkt`) adalah **production** sejak DEC-01. `.env` (kredensial cloud) tidak ada di mesin ini saat audit. Seeder menolak `--cloud` dan host selain localhost. |
| Koneksi | Langsung ke Postgres lokal (tanpa pooler), role pemilik `postgres` (migrasi dan script); aplikasi memakai role `temubaca_app`. |
| Data yang sudah ada (sebelum seed) | 2 akun Auth E2E (`e2e-*@temubaca.test`) dengan 2 profil, 196 tempat kurasi OSM (15 perpustakaan, 181 titik temu), 196 audit `PLACE_CREATED`, 0 buku, 0 listing, 0 komunitas. Ukuran DB 13 MB. |
| Seeder lama | `scripts/retire-seed-data.ts` sudah memensiunkan seed dummy (`5eed0000-…`) pada 17–18 Okt 2026. Seed baru memakai prefiks lain (`5eed0001-…`). |
| Kuota | Lokal: dibatasi disk dan memori laptop (seed `normal` ±30 ribu baris, DB naik dari 13 MB menjadi ±40 MB). Cloud Free 500 MB tidak relevan karena seed tidak menulis ke cloud. |

## 2. Auth, RLS, dan hak akses

- `user_profiles.id` **tidak** punya foreign key ke `auth.users` (diperiksa di `pg_constraint`). Profil biasanya dibuat oleh trigger `on_auth_user_created` (`supabase/migrations/20261004000000_…`) atau saat login pertama (`src/lib/auth/callbacks.ts`).
- Seed membuat **profil saja, tanpa akun Auth**. Akibatnya akun seed tidak bisa login. Kolom email di `/admin/users` kosong untuk akun seed (`listAuthEmails` hanya membaca `auth.users`). Job retensi menganggap akun Auth yang tidak ada sudah terhapus (`retention.ts`), jadi aman.
- Untuk demo yang perlu login, pakai akun E2E (`bun scripts/e2e-accounts.ts`). Akun seed tidak dibuat di Auth supaya tidak ada kredensial baru dan email tidak terkirim.
- RLS menyala di 26 dari 26 tabel `public`, masing-masing dengan satu policy `temubaca_app_all` (role `temubaca_app`). Seed menulis sebagai pemilik tabel (`postgres`, server-side, lokal) yang tidak terkena RLS. **RLS tidak dimatikan.**
- Trigger aplikasi di tabel `public`: tidak ada. Satu-satunya trigger relevan ada di `auth.users`, dan seed tidak menyentuh `auth.users`.

## 3. Tabel

Kolom: **W** wajib, **U** unik/indeks parsial, **C** check, **Aturan** aturan aplikasi yang tidak dijamin FK. "Seed" berisi strategi dan volume profil `normal`.

| Tabel | Fungsi | Kunci dan constraint | Aturan aplikasi (sumber) | Seed |
|---|---|---|---|---|
| `user_profiles` | Profil akun | PK id (tanpa FK Auth); `regionCode` C `NN.NN`; self-FK `suspendedById` | Akun ditangguhkan tidak bisa menulis (`requireUser`); penghapusan 14 hari (DEC-11) | 1.500, termasuk 4 admin. Segmen aktivitas: power, high, normal, low, dormant, recent. ±2% ditangguhkan, ±0,6% pernah ditangguhkan lalu dipulihkan, ±1% minta hapus akun. |
| `admin_audit_logs` | Jejak tindakan admin | enum `action`, `targetType`; `targetId` tanpa FK | Ditulis dalam transaksi yang sama dengan tindakannya (`admin-users.ts`, `borrowing.ts`) | Hanya untuk tindakan yang benar-benar dilakukan generator: `USER_ROLE_CHANGED`, `USER_SUSPENDED/REINSTATED`, `BORROWING_DISPUTE_RESOLVED` |
| `app_settings` | Pengaturan admin | PK `key` | Pengaturan katalog asli | **Tidak di-seed** (konfigurasi nyata, bukan data uji) |
| `books` | Katalog | U `(provider, providerId)`; enum provider | `createManualBook` menganggap judul + penulis pertama yang sama sebagai satu buku | 2.700 buku sintetis `MANUAL`, `providerId` `seed-v1-N`, ISBN dan sampul `null`, `metadata.synthetic = true`. Buku asli dari `books:import` dipakai sebagai referensi bila ada. |
| `book_sync_logs` | Riwayat sinkron provider | FK book (cascade) | Hanya ditulis saat sinkron nyata | **Tidak di-seed**: buku sintetis tidak punya rekaman provider, jadi log sinkron akan berupa peristiwa palsu |
| `bookmarks` | Simpanan pembaca | U `(userId, bookId)` | — | ±6.500, lognormal per pengguna; 60% mengikuti minat |
| `user_interests` | Minat pembaca (label genre) | U `(userId, subject)` | Label = `genres` (`src/features/books/genres.ts`) | ±3.300; 0–8 per pengguna |
| `libraries` | Tabel lama | — | Tidak dibaca aplikasi; perpustakaan ada di `places` tipe LIBRARY (DEC-07) | **Tidak di-seed (28 Okt 2026):** sempat di-seed, lalu menjadi data nyata TB-023 lewat `bun run libraries:import` (migrasi 0021 menghapus baris seed-nya) |
| `book_listings` | Salinan yang dipinjamkan | FK owner/book (restrict); enum condition, availability | `publicLocation` berisi titik temu digabung " & " (maks. 3); `borrowingRules` berisi "Lama pinjam: N hari." (`listing-draft.ts`); `meetingPlaceIds` hanya tempat kurasi (TB-027); RESERVED selama ada permintaan diterima atau pinjaman berjalan | 1.200; titik temu dari tempat kurasi di kab/kota pemilik |
| `borrow_requests` | Permintaan pinjam | U parsial: satu PENDING/APPROVED per peminjam per salinan, satu APPROVED per salinan; C `loanDays` 1–60 | `actOnBorrowRequest`: menerima satu permintaan menolak permintaan lain yang masih menunggu (`AUTO_REJECTION_REASON`); serah terima butuh dua konfirmasi, lalu status COMPLETED + `borrowings` | ±2.200 |
| `borrow_events` | Riwayat pinjaman | FK request (restrict); enum type | Satu peristiwa per transisi, urut waktu | ±9.000, dari simulasi |
| `borrowings` | Pinjaman berjalan | U `requestId`; C `extensionDays` 1–14 | OVERDUE **tidak disimpan**, dihitung dari `dueAt` (`loanState`); sekali perpanjangan sebelum tenggat; sengketa diputuskan admin menjadi RETURNED/LOST | ±900 |
| `book_accesses` | Akses buku digital | U `requestId` | Tidak dibaca atau ditulis aplikasi | **Tidak di-seed (28 Okt 2026):** kini pengajuan pembaca ke perpustakaan (TB-023). Baris seed sintetis dihapus migrasi 0021; pengajuan dan koleksi tidak di-seed karena akan menjadi klaim palsu tentang perpustakaan nyata |
| `listing_appeals` | Banding listing tersembunyi | U parsial: satu PENDING per listing | Hanya untuk listing tersembunyi; banding diterima memulihkan listing + verifikasi APPROVED | ±10 |
| `communities` | Komunitas | C `interests` ≤ 5, `regionCode`; enum status | Transisi review: PENDING→VERIFIED/REJECTED, VERIFIED→SUSPENDED, SUSPENDED→VERIFIED (`community-review.ts`); maks. 3 pengajuan PENDING per akun; konten hanya saat VERIFIED | 100; status bervariasi |
| `community_submissions` | Bukti pengajuan dan re-verifikasi | — | Dijawab bersama keputusan review; re-verifikasi hanya untuk VERIFIED | ±130 |
| `community_invites` | Undangan pengurus sekali pakai | U `tokenHash`; `expiresAt` W | Berlaku 7 hari; hanya komunitas VERIFIED; menjadi MANAGER ACTIVE | ±80; token tidak ada, hash dari id |
| `community_memberships` | Anggota/pengurus | U `(userId, communityId)` | Pemilik punya OWNER ACTIVE (`createCommunityApplication`). **Alur bergabung sebagai MEMBER tidak ada di UI** (`createMembership` tidak dipanggil route mana pun), tetapi `activeMemberCount` menghitung semua ACTIVE. | ±1.100 |
| `events` | Acara komunitas | enum status, locationType | Draft boleh belum punya jadwal/lokasi (`eventMissingFields`); jadwal dalam WIB | ±430 |
| `places` | Peta Literasi | C koordinat, `places_owner_check`, `regionCode`; U `communityId`, `eventId` | Pin komunitas memakai nama dan kab/kota komunitas; pin acara tampil bila acara PUBLISHED, tatap muka, belum lewat, dan komunitasnya VERIFIED (`isOnMap`) | ±300 pin COMMUNITY/EVENT memakai **koordinat tempat kurasi asli**, tanpa koordinat acak |
| `merchandise_listings` | Merchandise | C foto ≤ 3, varian ≤ 10 | Kategori dari `merchandiseCategories`; harga Rp | ±140; foto tidak diunggah (`photoPaths` kosong) |
| `orders`, `order_items` | Pesanan | U `(orderId, merchandiseListingId)` | **Tidak ada alur pesanan**: `orders` tidak dibaca kode mana pun, dan `order_items` hanya dicek sebelum merchandise dihapus. `orders` juga tidak punya pembeli atau komunitas. | **Tidak di-seed**: pesanan tanpa pembeli tidak bisa dipakai aplikasi |
| `reports` | Laporan konten | `targetId` tanpa FK | Alasan per jenis target (`report-reasons.ts`) | 200; target selalu objek seed yang ada |
| `recommendations` | Tabel rekomendasi lama | `targetId` tanpa FK | Tidak dibaca: rekomendasi dihitung langsung oleh ML Service | **Tidak di-seed**, agar tidak ada skor yang seolah-olah keluaran model |
| `verifications` | Riwayat keputusan admin | `targetId` tanpa FK | COMMUNITY: tiap keputusan review; BOOK_LISTING: REVOKED saat disembunyikan, APPROVED saat dipulihkan | ±170 |

## 4. Risiko bulk insert yang ditangani

- Indeks unik parsial `borrow_requests`: simulasi per salinan berjalan berurutan, satu "putaran" permintaan pada satu waktu.
- `places_owner_check` dan unik `communityId`/`eventId`: maksimal satu pin per komunitas atau acara.
- FK `restrict` (`borrow_requests` → `book_listings`/`user_profiles`, `order_items`): cleanup menghapus anak lebih dulu dan menolak bila ada baris bukan seed yang menunjuk baris seed.
- `targetId` tanpa FK (laporan, verifikasi, audit): divalidasi eksplisit (`polymorphic-targets`).
- Parameter Postgres (65.535 per statement): batch 500 baris × ±30 kolom.
