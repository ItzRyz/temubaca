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
| `POST` | `/api/reports` | Wajib login | Membuat laporan untuk buku, listing, komunitas, acara, merchandise, atau akun yang ada; 5 kiriman per menit per akun |
| `GET` | `/api/admin/reports?page=&limit=&status=&targetType=` | Admin | Daftar laporan dengan pagination; detail pelapor hanya ditampilkan pada konsol admin |
| `PATCH` | `/api/admin/reports/[reportId]` | Admin | Mengubah status tinjauan dan catatan hasil internal |
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

Belum ada endpoint perpustakaan/akses buku, permintaan pinjam, borrowing, CRUD komunitas/acara, penulisan merchandise/order, atau verifikasi. Endpoint baca publik komunitas/acara/merchandise dan rekomendasi baseline sudah aktif sebagaimana dirinci di atas. Siklus pinjam menunggu `DEC-02`; integrasi katalog eksternal menunggu `DEC-06`; transaksi merchandise menunggu `DEC-03`.

Halaman `/libraries` saat ini hanya menjelaskan bahwa inventaris buku perpustakaan belum dapat disajikan. Tidak ada endpoint ketersediaan perpustakaan sampai sumber data, pemilik pembaruan, status, dan kesegaran disepakati pada `DEC-13`.
