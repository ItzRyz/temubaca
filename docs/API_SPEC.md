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
| `PATCH` | `/api/borrowings/[borrowingId]` | Pemilik listing atau peminjam | `{ action }`: `confirm_return` (keduanya; listing kembali `AVAILABLE` setelah dua konfirmasi), `remind` (pemilik, hanya saat terlambat, sekali per 24 jam), `report_problem` (`reason`, `details` 10–500 karakter; pinjaman menjadi `DISPUTED`) |
| `PATCH` | `/api/admin/borrowings/[borrowingId]` | Admin | `{ outcome: RETURNED\|LOST, note }`; memutus sengketa (`409` bila sudah diputus). `RETURNED` membuat listing `AVAILABLE`, `LOST` membuat listing `UNAVAILABLE`; tercatat di riwayat pinjaman dan `admin_audit_logs` |
| `GET` | `/api/recommendations` | Wajib login | Rekomendasi buku baseline per pengguna; respons hanya memuat field buku publik, alasan, dan status fallback |

Rute kompatibilitas lama `/api/me/bookmarks/[bookId]` dan `/api/me/book-listings...` masih diarahkan ke handler yang sama.

Semua operasi tulis memakai skema Zod server-side dan rate limit berbasis ID pengguna. Listing baru default ke `AVAILABLE`; buku harus sudah ada di katalog lokal. Detail validasi berada di `src/lib/validation/schemas/`. `GET /api/book-listings` hanya mengembalikan field buku yang diperlukan dan tidak menyertakan permintaan pinjam atau profil peminta.

Endpoint yang membaca JSON menerima maksimal 1 MiB; body lebih besar mengembalikan `413 PAYLOAD_TOO_LARGE`. Batas diterapkan saat stream dibaca, tidak hanya melalui header `Content-Length`.

Field katalog publik: `id`, `provider`, `providerId`, `isbn`, `title`, `authors`, `description`, `publisher`, `publishedAt`, `language`, `categories`, dan `coverUrl`. API tidak mengembalikan `metadata` mentah dari provider maupun timestamp internal tabel.

Laporan menerima target `BOOK`, `BOOK_LISTING`, `COMMUNITY`, `EVENT`, `MERCHANDISE_LISTING`, dan `USER`, lalu memeriksa keberadaan target sebelum insert. Target permintaan pinjam, peminjaman, atau pesanan tidak diterima. Form UI tersedia pada detail buku/listing dan kartu komunitas/acara/merchandise; laporan profil belum terpasang pada UI. Status tinjauan tidak otomatis menyembunyikan atau mengubah konten.

Halaman server publik `/communities` dan endpoint `GET /api/communities` hanya menampilkan komunitas `VERIFIED`; halaman menyediakan pencarian nama dan pagination. Halaman `/events` dan endpoint `GET /api/events` hanya menampilkan acara mendatang berstatus `PUBLISHED` milik komunitas `VERIFIED`; halaman dan endpoint menyediakan pagination, waktu acara yang tampil di halaman menggunakan WIB dan API memakai ISO. Kedua halaman dan endpoint memakai query proyeksi terbatas. Belum tersedia alur CRUD komunitas/acara.

Katalog `/merchandise` dan `GET /api/merchandise` hanya menampilkan listing `PUBLISHED` milik komunitas `VERIFIED`, dengan proyeksi field publik dan pagination. Tampilan bersifat informasional; tidak ada checkout, pembuatan order, pembayaran, atau pengiriman pada kontrak aktif. Kebijakan transaksi tetap menunggu `DEC-03` dan detail listing menunggu `DEC-12`.

Endpoint rekomendasi memakai baseline kecocokan kategori/minat lokal pada TB-040. Ia tidak memanggil provider eksternal atau mengklaim personalisasi ML; pilihan DEC-08 tetap terbuka.

## Belum menjadi kontrak aktif

Belum ada endpoint perpustakaan/akses buku, CRUD komunitas/acara, penulisan merchandise/order, atau verifikasi. Endpoint baca publik komunitas/acara/merchandise dan rekomendasi baseline sudah aktif sebagaimana dirinci di atas. Siklus pinjam mengikuti `DEC-02` (lihat `docs/DECISIONS.md`); perpanjangan pinjaman belum diputuskan. Integrasi katalog eksternal menunggu `DEC-06`; transaksi merchandise menunggu `DEC-03`.

Halaman `/libraries` saat ini hanya menjelaskan bahwa inventaris buku perpustakaan belum dapat disajikan. Tidak ada endpoint ketersediaan perpustakaan sampai sumber data, pemilik pembaruan, status, dan kesegaran disepakati pada `DEC-13`.
