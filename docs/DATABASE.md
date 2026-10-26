# DATABASE — Pedoman Implementasi

Gunakan PostgreSQL relasional. Skema pada `ERD.md` adalah rancangan, bukan hasil introspeksi database. Terapkan semua perubahan melalui migrasi yang ditinjau.

## Pedoman

- Kaitkan identitas aplikasi dengan ID auth provider; jangan simpan kata sandi aplikasi jika autentikasi dikelola provider.
- Tambahkan foreign key, batas unik, NOT NULL, dan indeks untuk pola akses nyata.
- Gunakan UTC untuk waktu tersimpan dan tentukan zona waktu saat ditampilkan.
- Metadata katalog eksternal simpan sumber dan waktu sinkronisasi. Hanya simpan data yang diizinkan ketentuan provider.
- Terapkan RLS bila platform mendukungnya, namun tetap lakukan otorisasi di server untuk operasi sensitif.
- Listing merchandise selalu milik komunitas. Pesanan hanya dibuat jika scope transaksi disahkan.
- Pisahkan lokasi publik dari alamat/titik privat. Jangan mengembalikan lokasi privat di query publik.
- Tentukan retensi dan penghapusan akun/laporan sebelum produksi.

## Koneksi dan migrasi

- Aplikasi menggunakan driver Drizzle `node-postgres` dengan `DATABASE_URL`.
- Koneksi runtime mewajibkan verifikasi TLS saat `NODE_ENV=production`; jangan menonaktifkan verifikasi sertifikat untuk mengatasi masalah koneksi.
- `DATABASE_SSL_CA` dapat memuat CA PEM khusus dan ditambahkan ke CA bawaan Node untuk koneksi runtime maupun migrasi. Verifikasi sertifikat dan hostname tetap aktif.
- Pada production, jangan sertakan `sslmode`, `sslcert`, `sslkey`, atau `sslrootcert` di query URL koneksi runtime. Opsi tersebut dapat mengganti objek TLS yang disetel aplikasi. Gunakan `DATABASE_SSL_CA` untuk CA khusus.
- Drizzle Kit memilih `DIRECT_URL` untuk generate/migrate bila tersedia; koneksi langsung atau mode session lebih sesuai untuk tugas migrasi daripada transaction pooling.
- Drizzle Kit mem-parsing URL migrasi menjadi parameter koneksi lalu menerapkan TLS strict untuk host non-lokal, dan semua host saat `NODE_ENV=production`; opsi SSL yang tertanam di URL tidak boleh menurunkan tingkat verifikasi.
- Tentukan mode pooler, ukuran pool, TLS, dan batas koneksi setelah platform hosting dipilih. Jangan mengasumsikan URL migrasi dan runtime harus sama.
- Jangan jalankan migrasi terhadap production dari build atau startup aplikasi; jalankan sebagai langkah rilis eksplisit terhadap target yang diverifikasi.
- Untuk DB dev, `bun run db:migrate:dev` menampilkan migrasi pending dan `bun run db:migrate:dev -- --apply` menerapkannya dengan TLS yang sama seperti runtime dev, mencatat hash SHA-256 dan `when` jurnal di `drizzle.__drizzle_migrations__`. Script menolak berjalan saat `NODE_ENV=production`.
- `book_listings.hiddenAt/hiddenReason/hiddenById` menandai listing yang disembunyikan admin; semua query publik mengecualikannya. `books.syncedAt` dan tabel `book_sync_logs` mencatat sinkron katalog (migrasi 0005).
- Migrasi 0008 (DEC-02): kolom permintaan pinjam (titik temu, lama pinjam, alasan tolak, konfirmasi serah terima dua pihak), kolom pinjaman (konfirmasi pengembalian, pengingat, sengketa), tabel riwayat `borrow_events`, serta indeks unik satu permintaan aktif per peminjam per salinan dan satu permintaan diterima per salinan. Status `OVERDUE` dihitung dari `dueAt`, tidak disimpan.
- Migrasi 0009 (DEC-04/05): tabel `community_submissions` (bukti verifikasi; berkas di bucket Storage privat `community-evidence`) dan `community_invites` (undangan pengurus sekali pakai; hanya hash token yang disimpan), kontak publik komunitas, jenis lokasi dan nama tempat acara, serta kategori, keterangan stok, dan kontak khusus merchandise.
- Migrasi 0010 (DEC-11): `user_profiles.deletionRequestedAt/deletionScheduledFor/deletedAt/authDeletedAt` untuk masa tenggang dan anonimisasi akun, serta `reports.detailsPurgedAt`. Tugas retensi ada di `src/features/account-deletion/retention.ts`.
- Migrasi 0011: tabel `listing_appeals` (banding pemilik atas listing yang disembunyikan; satu banding `PENDING` per listing lewat indeks unik parsial; foto opsional di bucket privat).
- Migrasi 0017 (DEC-07): tabel `places` untuk Peta Literasi. `type` `LIBRARY`/`MEETING_POINT` dikurasi admin; `COMMUNITY` terikat ke `communityId` dan `EVENT` ke `eventId` (masing-masing unik, `places_owner_check`). Koordinat dibatasi ke kotak wilayah Indonesia (`places_coordinates_check`). Aturan tampil di peta ada di satu tempat, `isOnMap()` di `src/lib/db/queries/places.ts`: tidak disembunyikan; titik komunitas bila komunitas `VERIFIED`; titik acara bila acara `PUBLISHED`, `PHYSICAL`, `coalesce(endsAt, startsAt)` belum lewat, dan komunitas penyelenggara `VERIFIED`. Nama titik komunitas mengikuti profil, nama titik acara mengikuti judul acara.
- Migrasi 0018 (TB-027, 26 Okt 2026): `book_listings.meetingPlaceIds` (`uuid[]`, default kosong) menyimpan tempat Peta Literasi di antara titik temu listing; nama titiknya tetap di `publicLocation`. Server hanya menerima perpustakaan atau titik temu publik kurasi yang tidak disembunyikan, dan membuang id yang namanya tidak lagi ada di daftar titik temu. `borrow_requests.meetingPlaceId` (FK `places`, `ON DELETE SET NULL`) mencatat tempat di balik titik temu yang dipilih peminjam.
- `user_profiles.suspendedAt/suspendedReason/suspendedById` menandai akun yang ditangguhkan admin (migrasi 0006). Penangguhan berlaku di aplikasi: `requireUser`/`requireApiUser` menolak setiap aksi, dan listing akun tersebut dikecualikan dari query publik; login Supabase tidak diblokir. `admin_audit_logs` mencatat penangguhan, pemulihan, perubahan peran, dan setiap kali email lengkap ditampilkan.
- `app_settings` (migrasi 0007) menyimpan pengaturan platform per bagian sebagai JSON (`catalog`). Nilai dibaca lewat `getCatalogSettings` dengan fallback per kolom ke default; perubahan dicatat sebagai `SETTINGS_UPDATED` di `admin_audit_logs` dengan `targetType = OTHER` dan id nol tetap.

## Akses pinjam dan ketersediaan perpustakaan

Di skema Drizzle saat ini, `book_accesses` mencatat akses yang diberikan untuk sebuah `borrow_request` (misalnya status, masa berlaku, dan pencabutan). Tabel tersebut bukan catatan ketersediaan buku pada perpustakaan. Jangan mengganti makna, mengganti nama, atau menambahkan relasi perpustakaan ke tabel itu sebelum dampak terhadap alur pinjam dan data lama ditinjau.

Ketersediaan buku perpustakaan adalah konsep terpisah yang belum dimodelkan. Keputusan tentang sumber data, siapa yang memperbarui data, status, kesegaran, dan penanganan duplikasi dicatat sebagai DEC-13. Sampai keputusan itu tersedia, jangan membuat migrasi atau mengklaim informasi stok/ketersediaan di UI.

## Tinjauan migrasi

Sebelum deploy, periksa dampak pada data, kebijakan akses, rollback, indeks, dan data lama. Uji migrasi pada lingkungan uji; jangan menjalankan perubahan destruktif pada data produksi tanpa prosedur pemulihan yang disetujui.
