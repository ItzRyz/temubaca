# Kontrak API TemuBaca

**Status:** snapshot endpoint yang sudah ada pada 2026-10-10. Endpoint yang belum disebut masih rencana, bukan kontrak yang dapat dipanggil.

## Bentuk respons

Respons sukses JSON memakai `{ "success": true, "data": ..., "meta"?: ... }`. Error memakai `{ "success": false, "error": { "code", "message", "details"? } }`. Penghapusan bookmark yang berhasil mengembalikan `204 No Content`.

## Endpoint aktif

| Method | Path | Akses | Hasil |
|---|---|---|---|
| `GET` | `/api/books/search?q=&page=&limit=` | Publik | Daftar buku lokal dan metadata pagination; hanya field katalog publik |
| `GET` | `/api/books/[bookId]` | Publik | Field katalog publik untuk satu buku; `404` jika tidak ditemukan |
| `GET` | `/api/communities?q=&page=&limit=` | Publik | Komunitas `VERIFIED` dengan proyeksi publik dan metadata pagination |
| `GET` | `/api/events?page=&limit=` | Publik | Acara mendatang `PUBLISHED` dari komunitas `VERIFIED` dengan metadata pagination; waktu ISO |
| `GET` | `/api/merchandise?page=&limit=` | Publik | Listing merchandise `PUBLISHED` dari komunitas `VERIFIED`; tanpa pesanan atau pembayaran |
| `PUT` | `/api/bookmarks/[bookId]` | Wajib login | Menyimpan bookmark secara idempotent |
| `DELETE` | `/api/bookmarks/[bookId]` | Wajib login | Menghapus bookmark milik pengguna |
| `GET` | `/api/book-listings` | Wajib login | Listing milik pengguna |
| `POST` | `/api/book-listings` | Wajib login | Membuat listing untuk buku yang sudah ada |
| `PATCH` | `/api/book-listings/[listingId]` | Pemilik listing | Mengubah kondisi, ketersediaan, lokasi publik, atau aturan |
| `DELETE` | `/api/book-listings/[listingId]` | Pemilik listing | Menghapus listing permanen; `409` bila `RESERVED` atau punya riwayat permintaan pinjam |
| `GET` | `/api/books/external?q=` | Publik | Mencari Open Library/Google Books sesuai urutan di Pengaturan (min. 2 karakter); hasil di-cache 10 menit, ditandai `localBookId` bila sudah ada di katalog; 30 per menit per IP |
| `POST` | `/api/books/manual` | Wajib login | `{ title, author, category, publishedAt?, publisher?, isbn? }`; membuat buku manual (`201`) atau mengembalikan buku yang sudah ada dengan ISBN atau judul + penulis pertama yang sama (`200`); 5 per menit per akun |
| `POST` | `/api/books/import` | Wajib login | `{ provider, providerId }`; mengambil ulang data dari provider lalu menambahkannya ke katalog (`201`), atau mengembalikan buku yang sudah ada dengan provider id/ISBN sama (`200`); 10 per menit per akun |
| `POST` | `/api/reports` | Wajib login | Membuat laporan untuk buku, listing, komunitas, acara, merchandise, atau akun yang ada; 5 kiriman per menit per akun |
| `GET` | `/api/admin/reports?page=&limit=&status=&targetType=` | Admin | Daftar laporan dengan pagination; detail pelapor hanya ditampilkan pada konsol admin |
| `PATCH` | `/api/admin/reports/[reportId]` | Admin | Mengubah status tinjauan dan catatan hasil internal |
| `PATCH` | `/api/admin/book-listings/[listingId]/visibility` | Admin | `{ hidden, reason }`; menyembunyikan listing dari halaman publik (alasan wajib, tampil ke pemilik) atau memulihkannya; tercatat di `verifications` |
| `PATCH` | `/api/admin/users/[userId]/status` | Admin | `{ suspended, reason }`; menangguhkan (alasan wajib) atau memulihkan akun; ditolak `409` untuk akun sendiri atau akun admin; tercatat di `admin_audit_logs` |
| `PATCH` | `/api/admin/users/[userId]/role` | Admin | `{ role: MEMBER\|ADMIN }`; tidak dapat mengubah peran sendiri (`409`); tercatat dengan peran lama dan baru |
| `POST` | `/api/admin/users/[userId]/email` | Admin | Mengembalikan email lengkap dari Supabase Auth (butuh `SUPABASE_SERVICE_ROLE_KEY`); setiap permintaan dicatat di `admin_audit_logs`; 10 per menit |
| `PUT` | `/api/admin/settings/catalog` | Admin | Menyimpan pengaturan Katalog Buku (`primaryProvider`, `fallbackEnabled`, `staleAfterDays` 7/14/30/60/90, `showAttribution`); kolom yang berubah dicatat di `admin_audit_logs` |
| `POST` | `/api/admin/books/[bookId]/sync` | Admin | Sinkron ulang satu rekaman dari Open Library/Google Books; maks. 6 per menit per admin; setiap percobaan tercatat di `book_sync_logs` |
| `POST` | `/api/borrow-requests` | Wajib login | `{ listingId, meetingPoint?, loanDays, preferredTime?, note?, agreed: true }`; `201`. Ditolak untuk salinan sendiri (`403`), salinan tersembunyi/pemilik ditangguhkan (`404`), salinan tidak `AVAILABLE`, lama pinjam di atas aturan pemilik, titik temu di luar daftar pemilik, atau permintaan aktif ganda (`409`) |
| `PATCH` | `/api/borrow-requests/[requestId]` | Pemilik listing atau peminjam | `{ action }`: `approve` dan `reject` (`reason` dari daftar tetap, `note` wajib untuk "Lainnya", `markUnavailable?`) hanya untuk pemilik saat `PENDING`; `cancel` oleh peminjam saat `PENDING` atau oleh siapa pun saat `APPROVED`; `confirm_handover` oleh masing-masing pihak saat `APPROVED`. Menerima satu permintaan membuat listing `RESERVED` dan menolak permintaan lain yang menunggu |
| `PATCH` | `/api/borrowings/[borrowingId]` | Pemilik listing atau peminjam | `{ action }`: `confirm_return` (keduanya; listing kembali `AVAILABLE` setelah dua konfirmasi), `remind` (pemilik, hanya saat terlambat, sekali per 24 jam), `report_problem` (`reason`, `details` 10–500 karakter; pinjaman menjadi `DISPUTED`), `request_extension` (peminjam, `days` 1–14 dan `note` opsional; sekali per pinjaman, hanya sebelum tenggat), `approve_extension` (pemilik; tenggat bertambah `days` dari tenggat lama), `reject_extension` (pemilik, `note` opsional; tenggat tetap) |
| `PATCH` | `/api/admin/borrowings/[borrowingId]` | Admin | `{ outcome: RETURNED\|LOST, note }`; memutus sengketa (`409` bila sudah diputus). `RETURNED` membuat listing `AVAILABLE`, `LOST` membuat listing `UNAVAILABLE`; tercatat di riwayat pinjaman dan `admin_audit_logs` |
| `POST` | `/api/communities` | Wajib login | `multipart/form-data`: profil (`name`, `description`, `regionCode` kode kab/kota Kemendagri, `publicLocation`, `interests` 1–5 label genre situs sebagai JSON array, `contactEmail`, `instagramHandle?`, `whatsappNumber?`), `evidenceUrl`, `note?`, dan `file?` (PDF/JPG/PNG ≤5 MB). Membuat komunitas `PENDING` (`201`). `409` bila akun sudah punya 3 pengajuan menunggu; 5 per jam |
| `PATCH` | `/api/communities/[communityId]` | Pemilik | Mengubah profil dan kontak publik (field sama dengan pengajuan, `interests` sebagai array JSON). Langsung tampil bila komunitas `VERIFIED`; ditolak untuk komunitas `SUSPENDED` |
| `POST` | `/api/communities/[communityId]/submissions` | Pemilik | `multipart/form-data` (`evidenceUrl`, `note?`, `file?`). Mengirim pembaruan verifikasi (komunitas `VERIFIED`, status tidak berubah) atau mengajukan ulang (komunitas `REJECTED` kembali `PENDING`). `409` bila masih ada pengajuan menunggu |
| `GET` | `/api/communities/[communityId]/submissions/[submissionId]/file` | Pemilik atau admin | Redirect `303` ke URL bertanda tangan 60 detik untuk berkas bukti |
| `POST` | `/api/communities/[communityId]/invites` | Pemilik komunitas `VERIFIED` | Membuat tautan undangan pengurus sekali pakai (7 hari). Token hanya muncul di respons ini |
| `DELETE` | `/api/communities/[communityId]/invites/[inviteId]` | Pemilik | Mencabut undangan yang belum dipakai |
| `POST` | `/api/community-invites/accept` | Wajib login | `{ token }`; menjadikan akun sebagai pengurus. `409` bila undangan sudah dipakai, dicabut, atau kedaluwarsa, atau bila akun adalah pemilik |
| `DELETE` | `/api/communities/[communityId]/managers/[userId]` | Pemilik | Mencabut pengurus |
| `POST` | `/api/communities/[communityId]/events` | Pemilik atau pengurus komunitas `VERIFIED` | Membuat acara. Draf boleh belum punya jadwal atau lokasi; `PUBLISHED` wajib punya tanggal, jam (WIB), dan lokasi fisik atau tautan daring |
| `PUT`, `POST`, `DELETE` | `/api/communities/[communityId]/events/[eventId]` | Pemilik atau pengurus | `PUT` mengubah acara; `POST { action: archive \| duplicate }` mengarsipkan acara atau menyalinnya menjadi draf; `DELETE` hanya untuk draf (`409` untuk acara yang sudah terbit) |
| `POST` | `/api/communities/[communityId]/merchandise` | Pemilik atau pengurus | Menambah merchandise: harga tetap dalam IDR atau tanpa harga tetap, ketersediaan, kontak komunitas atau kontak khusus, `variants` (maks. 10 teks, tanpa stok per varian), `fulfillmentNote` (cara pengiriman/pengambilan, maks. 200), `photoPaths` (maks. 3 path dari unggah foto; path komunitas lain dibuang), tampil/sembunyi. Tidak ada transaksi di platform (DEC-03, DEC-12) |
| `POST` | `/api/communities/[communityId]/merchandise/photos` | Pemilik atau pengurus | Multipart `file` (JPG/PNG/WebP, maks. 2 MB) ke bucket publik `merchandise-photos` di `<communityId>/<uuid>.<ext>`; mengembalikan `{ path, url }`. Foto baru tampil di item setelah item disimpan dengan path itu |
| `PUT`, `DELETE` | `/api/communities/[communityId]/merchandise/[itemId]` | Pemilik atau pengurus | Mengubah atau menghapus merchandise (diarsipkan bila pernah dipesan). Foto yang dilepas saat ubah, dan semua foto saat hapus, ikut dihapus dari Storage |
| `PATCH` | `/api/admin/community-submissions/[submissionId]` | Admin | `{ decision: CONFIRM\|DISMISS, note? }` (alasan wajib untuk `DISMISS`) untuk pembaruan verifikasi komunitas `VERIFIED`. Pengajuan komunitas baru diputus lewat peninjauan komunitas |
| `POST` | `/api/me/account-deletion` | Wajib login | `{ confirm: "HAPUS" }`; menjadwalkan penghapusan 14 hari lagi (`{ scheduledFor }`). Akun menjadi baca-saja. `409` bila masih ada pinjaman diterima/berjalan/sengketa atau komunitas terverifikasi milik akun; 5 per jam |
| `DELETE` | `/api/me/account-deletion` | Wajib login (termasuk akun dalam masa tenggang) | Membatalkan penghapusan yang dijadwalkan; `409` bila tidak ada |
| `GET` | `/api/me/export` | Wajib login | Unduhan JSON berisi profil, minat, bookmark, listing, pinjaman, komunitas, dan laporan milik akun; 3 per jam |
| `POST` | `/api/communities/[communityId]/owner` | Pemilik | `{ userId }`; menyerahkan kepemilikan ke pengurus aktif. Pemilik lama menjadi pengurus |
| `POST` | `/api/admin/retention` | Admin | Menjalankan tugas retensi DEC-11 sekarang dan mengembalikan ringkasannya; tercatat sebagai `RETENTION_RUN`; 3 per jam |
| `POST` | `/api/internal/retention` | `Authorization: Bearer $INTERNAL_API_SECRET` | Tugas retensi untuk penjadwal; `404` bila secret belum diset |
| `GET` | `/api/internal/retention` | `Authorization: Bearer $CRON_SECRET` | Tugas retensi untuk Vercel Cron (`vercel.json`); `404` bila `CRON_SECRET` belum diset. Setelah retensi, menyinkron ulang maks. 12 rekaman katalog provider yang lebih tua dari ambang "usang" admin (maks. 30 detik; DEC-06) dan menambahkan ringkasan `catalog` (`checked`, `updated`, `unchanged`, `failed`, atau `null` bila gagal) |
| `GET` | `/api/internal/ml/snapshot` | `Authorization: Bearer $ML_SNAPSHOT_SECRET` | Snapshot katalog publik untuk melatih ML Service (DEC-08, ML-02); `404` bila secret belum diset, 10 per menit, `Cache-Control: no-store`. Query `cursor?` (UUID buku terakhir) dan `limit` 1–1000 (default 500). Respons `{ version: 1, generatedAt, books, communities, genres, nextCursor }`: buku berisi `id`, `title`, `authors`, `description`, `categories`, `language`, `publisher`, `publishedAt`, `isbn`, `provider`, `updatedAt`, `genres` (label genre situs yang cocok dengan `categories`), serta `bookmarkCount` dan `listingCount` (jumlah agregat; listing yang disembunyikan admin tidak dihitung); komunitas hanya `VERIFIED` dengan `id`, `name`, `description`, `interests`, `regionCode`, `updatedAt`, dikirim di halaman pertama saja; `genres` berisi `slug` dan `label`. Tanpa metadata provider, sampul, pemilik, kontak, atau data pengguna |
| `POST` | `/api/book-listings/[listingId]/appeals` | Pemilik listing | `multipart/form-data`: `reason` (daftar tetap), `details` 10–500 karakter, `file?` (JPG/PNG ≤5 MB, disimpan privat). Hanya untuk listing yang disembunyikan admin; `409` bila masih ada banding yang menunggu; 5 per jam |
| `GET` | `/api/listing-appeals/[appealId]/file` | Pemilik listing atau admin | Redirect `303` ke URL bertanda tangan 60 detik untuk foto bukti banding |
| `PATCH` | `/api/admin/listing-appeals/[appealId]` | Admin | `{ decision: APPROVE\|REJECT, note }`. `APPROVE` menampilkan listing lagi dan mencatatnya di `verifications`; alasan tampil ke pemilik. `409` bila sudah diputus |
| `GET` | `/api/places` | Publik | Tempat di Peta Literasi (DEC-07): query `types?` (koma, `library`/`community`/`event`/`meeting_point`), `region?` (`NN` atau `NN.NN`), `q?` (maks. 100). Hanya tempat yang tidak disembunyikan; titik komunitas hanya bila komunitas `VERIFIED`; titik acara hanya bila acara `PUBLISHED`, tatap muka, belum selesai (`endsAt` atau `startsAt` ≥ sekarang), dan komunitasnya `VERIFIED`. Respons `{ items }` dengan `id`, `type`, `name`, `addressPublic`, `latitude`, `longitude`, `regionCode`, `checkedAt`, `communityId`, `communityName` (komunitas pemilik titik atau penyelenggara acara), `eventId`, `eventStartsAt`, maks. 500. Tanpa pembuat atau alasan sembunyi. Rate limit baca per IP |
| `POST` | `/api/admin/places` | Admin | Tambah perpustakaan atau titik temu publik (`type`, `name`, `addressPublic`, `regionCode`, `latitude`, `longitude`, `source?`); tercatat `PLACE_CREATED` di jejak audit |
| `PUT` | `/api/admin/places/[placeId]` | Admin | Ubah tempat kurasi (field sama); 404 untuk titik komunitas; tercatat `PLACE_UPDATED` |
| `PATCH` | `/api/admin/places/[placeId]` | Admin | `{ action: "hide", reason }` atau `{ action: "restore" }` untuk tempat apa pun, termasuk titik komunitas; tercatat `PLACE_HIDDEN`/`PLACE_RESTORED` |
| `PUT` | `/api/communities/[communityId]/place` | Pemilik | Pasang atau pindahkan satu titik temu publik (`addressPublic`, `latitude`, `longitude`); nama dan kab/kota mengikuti profil komunitas |
| `DELETE` | `/api/communities/[communityId]/place` | Pemilik | Hapus titik temu dari peta |
| `POST` | `/api/places/[placeId]/route` | Publik | Rute jalan dari titik pembaca ke tempat yang sedang tampil di peta (TB-064). Body `{ origin: { latitude, longitude }, mode: "drive" \| "walk" }`, titik di dalam kotak Indonesia, field lain ditolak; titik ada di body, bukan URL, agar tidak masuk log akses. `404` bila tempat tidak tampil di peta. Selain itu `200` dengan `outcome`: `ROUTE` (`route` berisi `mode`, `distanceM`, `durationS`, `coordinates` [lng, lat], `viaStreets`, `warnings`, `graphVersion`) atau `OUT_OF_COVERAGE`/`SNAP_TOO_FAR`/`NO_PATH`/`UNAVAILABLE` dengan `message`; selalu ada `externalUrl` Google Maps. Berbeda dari Lampiran A `BACKEND_PETA_RUTE.md` (GET dan status 422/404/503): rute yang tidak dapat dibuat adalah hasil biasa, bukan kesalahan klien. Memanggil `POST /api/routing/route` ML Service dengan batas waktu 5 detik. Rate limit 30/menit per IP |
| `PUT` | `/api/communities/[communityId]/events/[eventId]/place` | Pemilik/pengurus (komunitas terverifikasi) | Pasang atau pindahkan titik lokasi acara tatap muka (`addressPublic`, `regionCode`, `latitude`, `longitude`); nama mengikuti judul acara. 409 untuk acara daring. Mengubah acara menjadi daring menghapus titiknya |
| `DELETE` | `/api/communities/[communityId]/events/[eventId]/place` | Pemilik/pengurus (komunitas terverifikasi) | Hapus titik lokasi acara dari peta |
| `GET` | `/api/recommendations` | Wajib login | Rekomendasi buku per pengguna; respons hanya memuat field buku publik, alasan, status `fallback`, `engine` (`ml` bila ML Service dipakai, `baseline` bila belum dikonfigurasi, gagal, atau tidak menemukan kecocokan minat), `unmatchedInterests` (minat yang belum dikenali model, ditulis seperti yang disimpan pengguna; kosong untuk baseline), `state` (`needs_interests` belum ada minat, `no_match` ada minat tetapi hanya pilihan katalog, `ok`), dan `source` per item (`interest` atau `catalog`) |

Rute kompatibilitas lama `/api/me/bookmarks/[bookId]` dan `/api/me/book-listings...` masih diarahkan ke handler yang sama.

Semua operasi tulis memakai skema Zod server-side dan rate limit berbasis ID pengguna. Listing baru default ke `AVAILABLE`; buku harus sudah ada di katalog lokal. Detail validasi berada di `src/lib/validation/schemas/`. `GET /api/book-listings` hanya mengembalikan field buku yang diperlukan dan tidak menyertakan permintaan pinjam atau profil peminta.

Endpoint yang membaca JSON menerima maksimal 1 MiB; body lebih besar mengembalikan `413 PAYLOAD_TOO_LARGE`. Batas diterapkan saat stream dibaca, tidak hanya melalui header `Content-Length`.

Field katalog publik: `id`, `provider`, `providerId`, `isbn`, `title`, `authors`, `description`, `publisher`, `publishedAt`, `language`, `categories`, dan `coverUrl`. API tidak mengembalikan `metadata` mentah dari provider maupun timestamp internal tabel.

Laporan menerima target `BOOK`, `BOOK_LISTING`, `COMMUNITY`, `EVENT`, `MERCHANDISE_LISTING`, dan `USER`, lalu memeriksa keberadaan target sebelum insert. Target permintaan pinjam, peminjaman, atau pesanan tidak diterima. Form UI tersedia pada detail buku/listing dan kartu komunitas/acara/merchandise; laporan profil belum terpasang pada UI. Status tinjauan tidak otomatis menyembunyikan atau mengubah konten.

Halaman server publik `/communities` dan endpoint `GET /api/communities` hanya menampilkan komunitas `VERIFIED`; halaman menyediakan pencarian nama dan pagination. Halaman `/events` dan endpoint `GET /api/events` hanya menampilkan acara mendatang berstatus `PUBLISHED` milik komunitas `VERIFIED`; halaman dan endpoint menyediakan pagination, waktu acara yang tampil di halaman menggunakan WIB dan API memakai ISO. Kedua halaman dan endpoint memakai query proyeksi terbatas. Belum tersedia alur CRUD komunitas/acara.

Katalog `/merchandise` dan `GET /api/merchandise` hanya menampilkan listing `PUBLISHED` milik komunitas `VERIFIED`, dengan proyeksi field publik dan pagination. Tampilan bersifat informasional; tidak ada checkout, pembuatan order, pembayaran, atau pengiriman pada kontrak aktif. Sesuai `DEC-03` merchandise hanya katalog. Detail (`DEC-12`) menampilkan foto, varian, dan catatan pengiriman/pengambilan; kartu katalog memakai foto pertama sebagai sampul.

Endpoint rekomendasi memakai baseline kecocokan kategori/minat lokal pada TB-040. Ia tidak memanggil provider eksternal atau mengklaim personalisasi ML; pilihan DEC-08 tetap terbuka.

## Belum menjadi kontrak aktif

Belum ada endpoint perpustakaan/akses buku, penulisan merchandise/order, atau verifikasi. Endpoint baca publik komunitas/acara/merchandise dan rekomendasi baseline sudah aktif sebagaimana dirinci di atas. Siklus pinjam mengikuti `DEC-02` (lihat `docs/DECISIONS.md`); perpanjangan pinjaman belum diputuskan. Integrasi katalog eksternal menunggu `DEC-06`; transaksi merchandise menunggu `DEC-03`.

Halaman `/libraries` saat ini hanya menjelaskan bahwa inventaris buku perpustakaan belum dapat disajikan. Tidak ada endpoint ketersediaan perpustakaan sampai sumber data, pemilik pembaruan, status, dan kesegaran disepakati pada `DEC-13`.
