# Data quality report (seed sintetis)

Dibuat oleh `bun run db:seed -- --verify --report` pada 2026-10-28T05:51:14.766Z. Seed: profil normal, seed 20261027, versi 1, jangkar 2026-10-27.

Interpretasi distribusi dan anomali: [seed-strategy.md](seed-strategy.md#temuan-kualitas-data).

## Pemeriksaan integritas dan aturan bisnis

Setiap query membaca seluruh baris (seed dan bukan seed) dan menghitung pelanggaran.

| Pemeriksaan | Aturan | Pelanggaran |
|---|---|---:|
| `one-approved-per-listing` | Paling banyak satu permintaan APPROVED per salinan | 0 |
| `one-open-per-requester` | Satu permintaan terbuka per peminjam per salinan | 0 |
| `completed-has-borrowing` | Permintaan COMPLETED punya pinjaman, dan sebaliknya | 0 |
| `handover-both-sides` | COMPLETED butuh dua konfirmasi serah terima; APPROVED belum punya keduanya | 0 |
| `listing-availability` | RESERVED tepat ketika ada permintaan diterima atau pinjaman berjalan | 0 |
| `borrowing-times` | Urutan waktu pinjaman: diminta ≤ diserahkan ≤ tenggat, kembali setelah serah terima | 0 |
| `dispute-fields` | Sengketa punya alasan; yang diputuskan berstatus RETURNED/LOST | 0 |
| `extension-fields` | Perpanjangan diajukan sebelum tenggat dan dijawab setelah diajukan | 0 |
| `loan-events-order` | Peristiwa pinjaman tidak mendahului permintaan dan diawali REQUESTED | 0 |
| `loan-events-terminal` | Status akhir punya peristiwanya (REJECTED, CANCELLED, RETURNED, DISPUTED) | 0 |
| `event-times` | Acara selesai setelah mulai | 0 |
| `community-owner` | Pemilik komunitas punya keanggotaan OWNER aktif, dan OWNER hanya pemiliknya | 0 |
| `community-pin-region` | Pin komunitas memakai kab/kota komunitasnya | 0 |
| `polymorphic-targets` | Target laporan, verifikasi, dan audit ada | 0 |
| `appeal-state` | Banding PENDING untuk listing tersembunyi; banding diterima memulihkan listing | 0 |
| `invite-use` | Undangan terpakai sebelum kedaluwarsa oleh pengurus yang tercatat | 0 |
| `merch-price` | Harga merchandise bermata uang IDR dan positif | 0 |
| `order-items` | Kuantitas order item ≥ 1 | 0 |
| `created-before-updated` | createdAt tidak setelah updatedAt | 0 |
| `activity-after-signup` | Bookmark, listing, dan keanggotaan setelah akun dan objeknya dibuat | 0 |
| `report-review` | Laporan diputus punya peninjau dan waktu; PENDING belum | 0 |
| `suspension-fields` | Akun ditangguhkan punya alasan dan admin | 0 |
| `book-access-state` | Akses buku mengikuti pinjamannya: ACTIVE selama berjalan, EXPIRED setelah kembali, REVOKED dengan waktu dicabut | 0 |
| `library-from-place` | Perpustakaan seed berasal dari tempat LIBRARY di Peta Literasi | 0 |
| `seed-not-in-future` | Baris seed tidak dibuat di masa depan | 0 |

## Distribusi

### Baris per tabel (seed / total)

| label | seed | n |
|---|---|---|
| user_profiles | 1500 | 1502 |
| books | 2700 | 2700 |
| communities | 100 | 100 |
| community_submissions | 128 | 128 |
| community_invites | 78 | 78 |
| community_memberships | 1117 | 1117 |
| events | 434 | 434 |
| places | 311 | 507 |
| merchandise_listings | 137 | 137 |
| book_listings | 1200 | 1200 |
| borrow_requests | 2104 | 2104 |
| borrowings | 922 | 922 |
| borrow_events | 9436 | 9436 |
| listing_appeals | 12 | 12 |
| reports | 200 | 200 |
| verifications | 168 | 168 |
| user_interests | 3351 | 3351 |
| bookmarks | 6557 | 6557 |
| admin_audit_logs | 80 | 276 |
| orders | 0 | 0 |
| order_items | 0 | 0 |
| recommendations | 0 | 0 |
| book_accesses | 1076 | 1076 |
| libraries | 15 | 15 |
| book_sync_logs | 0 | 0 |
| app_settings | 0 | 0 |

### Status permintaan pinjam

| label | n |
|---|---|
| COMPLETED | 922 |
| REJECTED | 764 |
| CANCELLED | 182 |
| PENDING | 159 |
| APPROVED | 77 |

### Keadaan pinjaman (OVERDUE dihitung dari dueAt)

| label | n |
|---|---|
| RETURNED | 686 |
| ACTIVE | 175 |
| OVERDUE (terhitung) | 36 |
| LOST | 13 |
| DISPUTED | 12 |

### Perpanjangan

| label | n |
|---|---|
| (tidak ada) | 805 |
| APPROVED | 82 |
| REJECTED | 27 |
| PENDING | 8 |

### Ketersediaan listing

| label | n |
|---|---|
| AVAILABLE | 768 |
| RESERVED | 300 |
| UNAVAILABLE | 100 |
| AVAILABLE (tersembunyi) | 32 |

### Status komunitas

| label | n |
|---|---|
| VERIFIED | 54 |
| SUSPENDED | 17 |
| PENDING | 15 |
| REJECTED | 14 |

### Keanggotaan (peran/status)

| label | n |
|---|---|
| MEMBER / ACTIVE | 724 |
| MEMBER / LEFT | 114 |
| OWNER / ACTIVE | 100 |
| MEMBER / PENDING | 56 |
| MEMBER / REJECTED | 51 |
| MANAGER / ACTIVE | 36 |
| MEMBER / REMOVED | 30 |
| MANAGER / REMOVED | 6 |

### Status acara

| label | n |
|---|---|
| PUBLISHED / PHYSICAL | 247 |
| ARCHIVED / PHYSICAL | 72 |
| PUBLISHED / ONLINE | 54 |
| DRAFT / PHYSICAL | 32 |
| ARCHIVED / ONLINE | 19 |
| DRAFT / ONLINE | 10 |

### Status merchandise

| label | n |
|---|---|
| PUBLISHED | 86 |
| DRAFT | 28 |
| ARCHIVED | 13 |
| UNAVAILABLE | 10 |

### Laporan (jenis target / status)

| label | n |
|---|---|
| BOOK / PENDING | 1 |
| BOOK / REJECTED | 5 |
| BOOK / RESOLVED | 10 |
| BOOK_LISTING / PENDING | 13 |
| BOOK_LISTING / REJECTED | 2 |
| BOOK_LISTING / RESOLVED | 46 |
| BOOK_LISTING / REVIEWING | 2 |
| COMMUNITY / PENDING | 5 |
| COMMUNITY / REJECTED | 3 |
| COMMUNITY / RESOLVED | 8 |
| COMMUNITY / REVIEWING | 2 |
| EVENT / PENDING | 11 |
| EVENT / REJECTED | 5 |
| EVENT / RESOLVED | 12 |
| EVENT / REVIEWING | 3 |
| MERCHANDISE_LISTING / PENDING | 3 |
| MERCHANDISE_LISTING / REJECTED | 8 |
| MERCHANDISE_LISTING / RESOLVED | 4 |
| MERCHANDISE_LISTING / REVIEWING | 3 |
| USER / PENDING | 5 |
| USER / REJECTED | 5 |
| USER / RESOLVED | 42 |
| USER / REVIEWING | 2 |

### Verifikasi (target / status)

| label | n |
|---|---|
| BOOK_LISTING / APPROVED | 4 |
| BOOK_LISTING / REVOKED | 36 |
| COMMUNITY / APPROVED | 75 |
| COMMUNITY / REJECTED | 33 |
| COMMUNITY / REVOKED | 20 |

### Aksi audit admin

| label | n |
|---|---|
| PLACE_CREATED | 196 |
| USER_SUSPENDED | 41 |
| BORROWING_DISPUTE_RESOLVED | 28 |
| USER_REINSTATED | 8 |
| USER_ROLE_CHANGED | 3 |

### Pendaftar per bulan

| label | n |
|---|---|
| 2026-01 | 2 |
| 2026-02 | 28 |
| 2026-03 | 58 |
| 2026-04 | 102 |
| 2026-05 | 137 |
| 2026-06 | 163 |
| 2026-07 | 208 |
| 2026-08 | 233 |
| 2026-09 | 305 |
| 2026-10 | 266 |

### Permintaan pinjam per bulan

| label | n |
|---|---|
| 2026-03 | 2 |
| 2026-04 | 5 |
| 2026-05 | 24 |
| 2026-06 | 63 |
| 2026-07 | 153 |
| 2026-08 | 321 |
| 2026-09 | 533 |
| 2026-10 | 1003 |

### Bookmark per pengguna (persentil)

| label | n |
|---|---|
| 0.1 | 1 |
| 0.25 | 1 |
| 0.5 | 2 |
| 0.75 | 5 |
| 0.9 | 10 |
| 0.99 | 31 |
| 1.0 | 120 |

### Anggota aktif per komunitas terverifikasi (persentil)

| label | n |
|---|---|
| 0.1 | 4 |
| 0.25 | 5 |
| 0.5 | 8 |
| 0.75 | 16 |
| 0.9 | 25 |
| 1.0 | 54 |

### Listing per pemilik (persentil)

| label | n |
|---|---|
| 0.25 | 1 |
| 0.5 | 1 |
| 0.75 | 2 |
| 0.9 | 3 |
| 0.99 | 8 |
| 1.0 | 13 |

### Permintaan per listing (persentil)

| label | n |
|---|---|
| 0.25 | 0 |
| 0.5 | 1 |
| 0.75 | 3 |
| 0.9 | 4 |
| 0.99 | 8 |
| 1.0 | 14 |

### Acara per komunitas aktif (persentil)

| label | n |
|---|---|
| 0.25 | 2 |
| 0.5 | 4 |
| 0.75 | 8 |
| 0.9 | 13 |
| 1.0 | 30 |

### Harga merchandise per kategori (Rp)

| label | n | min | median | max |
|---|---|---|---|---|
| Aksesori Koleksi | 22 | 10000 | 25000 | 40000 |
| Lainnya | 38 | 20000 | 50000 | 100000 |
| Pakaian | 21 | 85000 | 135000 | 205000 |
| Rilisan Cetak | 23 | 25000 | 70000 | 145000 |
| Tote Bag | 22 | 50000 | 85000 | 120000 |

### Genre buku sintetis

| label | n |
|---|---|
| Fiksi Sastra | 511 |
| Sastra Indonesia | 468 |
| Romansa | 329 |
| Anak & Remaja | 317 |
| Nonfiksi | 269 |
| Sejarah | 194 |
| Fiksi Sejarah | 172 |
| Komik & Novel Grafis | 164 |
| Pendidikan | 156 |
| Agama & Spiritualitas | 146 |
| Filsafat | 116 |
| Biografi | 114 |
| Persahabatan | 108 |
| Kesehatan Mental | 108 |
| Keluarga | 96 |
| Puisi | 94 |
| Isu Sosial | 90 |

### Kolom opsional terisi (% baris seed)

| label | n |
|---|---|
| books.description | 83.1 |
| books.publisher | 85.2 |
| user_profiles.regionCode | 83.6 |
| borrow_requests.note | 43.7 |
| book_listings.publicLocation | 89.8 |
| merchandise_listings.priceAmount | 92.0 |
| reports.details | 66.5 |

### Ukuran database

| label | n |
|---|---|
| pg_database_size | 31 MB |
