# ERD — Rancangan Data Awal

Skema berikut diturunkan dari dokumen sumber dan diselaraskan untuk mendukung merchandise komunitas. Ini bukan migrasi final. Penamaan kolom, tipe geospasial, retensi, dan kardinalitas perlu diperiksa sebelum implementasi.

## Entitas

- **UserProfile** — id identik dengan identitas auth, nama tampilan, preferensi opsional, created_at.
- **Book** — id internal, provider, provider_id, ISBN opsional, judul, penulis, metadata dan cover.
- **Bookmark** — user_id, book_id, created_at; unik per pasangan.
- **UserInterest** — user_id, kategori/subject; unik per pasangan.
- **Library** — nama, lokasi publik, sumber, jam/tautan opsional.
- **BookAccess** — book_id, library_id, status/keterangan, checked_at, source. Jangan anggap stok real-time tanpa sumber.
- **BookListing** — owner_id, book_id, kondisi, availability, lokasi umum, aturan pinjam.
- **BorrowRequest** — listing_id, requester_id, status, timestamps, catatan terbatas.
- **Borrowing** — request_id unik, tanggal serah/tempo/kembali, status dan bukti seperlunya.
- **Community** — owner_id/manager relationship, nama, deskripsi, lokasi umum, status verifikasi.
- **CommunityMembership** (opsional bila banyak pengelola) — user_id, community_id, role, status.
- **Event** — community_id, judul, waktu, lokasi/tautan, publication_status.
- **MerchandiseListing** — community_id, judul, deskripsi, price_amount/currency atau price_note, availability, image reference, status, timestamps.
- **Order** dan **OrderItem** — hanya jika DEC-03 mengaktifkan pesanan in-app; pembayaran dan refund butuh rancangan tersendiri.
- **Report** — reporter_id, target_type/id, reason, status, reviewer_id, outcome timestamps.
- **Recommendation** — user_id, target_type/id, score opsional, reason, model_version, created_at; penyimpanan hasil bukan keharusan MVP.
- **Verification** — target type/id, status, reviewer, waktu dan catatan internal.

## Hubungan inti

```text
UserProfile 1—N BookListing N—1 Book
UserProfile 1—N Bookmark N—1 Book
Book 1—N BookAccess N—1 Library
BookListing 1—N BorrowRequest 1—0..1 Borrowing
Community 1—N Event
Community 1—N MerchandiseListing
Community 1—N CommunityMembership N—1 UserProfile (bila dipakai)
UserProfile 1—N Report; Report mengacu ke target konten
```

## Invarian yang disarankan

- Provider + provider_id unik untuk rekaman buku eksternal; ISBN boleh kosong dan tidak selalu unik antar edisi.
- Bookmark dan minat tidak berganda per pengguna.
- Hanya satu borrowing aktif yang terkait dengan request diterima; aturan listing aktif perlu ditegaskan.
- Merchandise selalu terikat ke komunitas dan hanya pengelola berwenang dapat mengubahnya.
- Gunakan soft delete/arsip hanya setelah kebijakan retensi disetujui; simpan riwayat status seperlunya untuk sengketa.
- Simpan koordinat privat secara terpisah dari lokasi publik. Terapkan otorisasi dan minimisasi data.

## Belum diputuskan

Peran pengelola, kuantitas stok, varian/opsi barang, pajak/biaya, pesanan dan alamat, kebijakan gambar, data lokasi, retensi report, serta model histori status. Lihat `DECISIONS.md`.

## Rekonsiliasi dengan skema Drizzle saat ini

Audit repo pada 2026-10-10: `book_accesses` yang berjalan memiliki relasi ke `borrow_requests` dan menyimpan pemberian/pencabutan akses terkait proses pinjam. Ia tidak terhubung ke `books` atau `libraries`. Sementara itu, `libraries` saat ini hanya menyimpan metadata institusi dan belum memiliki relasi buku.

Dengan demikian, rancangan `BookAccess` pada bagian entitas di atas menggambarkan **observasi ketersediaan buku perpustakaan**, bukan tabel `book_accesses` yang sudah ada. Kedua konsep harus dipisahkan. Arah model yang perlu dievaluasi adalah entitas observasi ketersediaan tersendiri yang menghubungkan buku dan perpustakaan; nama, status, sumber, waktu pemeriksaan/penyegaran, kepemilikan pembaruan, dan aturan duplikasi masih menunggu DEC-13. Jangan terapkan migrasi atau agregasi UI TB-023 sampai keputusan tersebut tersedia.
