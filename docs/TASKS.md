# TASKS — TemuBaca

**Pemilik pengerjaan:** pengembang/tim proyek • **Status awal semua task:** Belum dimulai • **Prioritas:** P0 wajib sebelum rilis MVP; P1 penting untuk MVP; P2 setelah MVP/berdasarkan kapasitas.

Task adalah unit kerja manusia yang dapat diperkirakan dan ditinjau. Perbarui pemilik, status, dan bukti kerja dalam issue tracker tim. Ketergantungan ditulis sebagai ID task. `TBD` berarti keputusan belum tersedia—jangan menganggapnya selesai.

## Aturan penyelesaian

Sebuah task selesai setelah kriteria penerimaan terpenuhi, perubahan ditinjau rekan tim, pengujian yang relevan dijalankan, dokumentasi terkait diperbarui, dan tidak ada rahasia/data pribadi di log atau repositori. Untuk perubahan UI, periksa desktop dan layar kecil; untuk alur transaksi/akses, uji izin dan keadaan gagal.

## Milestone

- **M0 — Scope siap:** keputusan P0 dicatat, repo dan lingkungan pengembangan siap.
- **M1 — Fondasi:** autentikasi, skema awal, kerangka antarmuka dan API.
- **M2 — Temukan dan akses:** pencarian buku, detail, akses, peta.
- **M3 — Komunitas:** profil, acara, merchandise katalog, pelaporan.
- **M4 — Siap rilis:** rekomendasi sesuai kapasitas, pemeriksaan mutu, demo dan rilis.

Tanggal/sprint belum ditentukan. Milestone bukan perkiraan kalender.

## Urutan kerja

`M0 → M1 → M2 → M3 → M4`. Merchandise dapat dimulai sebagai katalog setelah batas transaksi pada `DEC-03` diputuskan. Pembayaran daring diblokir oleh keputusan kebijakan, penyedia, kepatuhan, dan operasional.

## M0 — Keputusan dan persiapan

| ID | Prio | Pekerjaan dan penerimaan | Depends on |
|---|---|---|---|
| TB-001 | P0 | Tinjau `DECISIONS.md`; tetapkan MVP merchandise (katalog vs checkout), pihak pengelola komunitas, cakupan lokasi, dan sumber buku. Keputusan, pemilik, tanggal, dan konsekuensi dicatat. | — |
| TB-002 | P0 | Tetapkan alur pinjam: status, batas waktu, pembatalan, pengembalian, laporan, dan siapa yang menyelesaikan sengketa. Diagram status disetujui tim. | TB-001 |
| TB-003 | P0 | Tetapkan target rilis, demo/kompetisi bila masih relevan, kriteria keberhasilan, browser, dan data uji. Nilai tercatat atau ditandai belum tersedia. | TB-001 |
| TB-004 | P0 | Tinjau sumber asli PRD/ERD/flow/stack dan dokumen ini; catat koreksi yang disepakati pada `DECISIONS.md`. | — |

## M1 — Fondasi produk

| ID | Prio | Pekerjaan dan penerimaan | Depends on |
|---|---|---|---|
| TB-010 | P0 | Siapkan repo, aturan branch/review, format/lint, pengelolaan konfigurasi lokal, dan panduan mulai kerja. Anggota tim dapat menjalankan aplikasi dari instruksi yang sama. | TB-001 |
| TB-011 | P0 | Bangun kerangka aplikasi, navigasi utama, halaman kosong/loading/error, serta layout responsif. Semua rute inti dapat dibuka. | TB-010 |
| TB-012 | P0 | Integrasikan autentikasi yang dipilih. Daftar/masuk/keluar dan sesi kedaluwarsa ditangani; operasi privat tanpa sesi ditolak. | TB-001, TB-010 |
| TB-013 | P0 | Terapkan skema basis data awal dan migrasi untuk profil, buku, akses, komunitas, acara, bookmark, dan minat. Migrasi dapat diterapkan pada lingkungan baru. | TB-001, TB-010 |
| TB-014 | P0 | Terapkan kontrol akses server/database untuk data milik pengguna dan peran pengelola. Pengguna biasa tidak dapat mengubah data orang lain. | TB-012, TB-013 |
| TB-015 | P1 | Buat katalog komponen/formulir dengan validasi, fokus keyboard, label, dan pesan kesalahan konsisten. | TB-011 |

## M2 — Buku, akses, lokasi

| ID | Prio | Pekerjaan dan penerimaan | Depends on |
|---|---|---|---|
| TB-020 | P0 | Uji kandidat API buku pada sampel buku Indonesia dan dokumentasikan cakupan, batas penggunaan, atribusi, serta fallback. Rekomendasi provider dicatat, bukan diasumsikan. | TB-001 |
| TB-021 | P0 | Implementasikan pencarian dan normalisasi hasil buku di server. Hasil, tanpa hasil, timeout, dan provider gagal memiliki tampilan yang jelas. | TB-020, TB-011 |
| TB-022 | P0 | Buat detail buku, genre/metadata yang tersedia, bookmark, dan konten terkait. Data yang tidak tersedia tidak direkayasa. | TB-021, TB-012 |
| TB-023 | P0 | Implementasikan agregasi “Cara Membaca” untuk ketersediaan perpustakaan dan listing berbagi buku. Status/kesegaran informasi terlihat; data kosong dibedakan dari tidak tersedia. Ketersediaan perpustakaan harus memakai model terpisah dari `book_accesses` yang mengikat izin akses ke permintaan pinjam. | TB-013, TB-022, DEC-13 |
| TB-024 | P1 | Buat pemilik mengelola listing buku: kondisi, ketersediaan, lokasi umum, aturan pinjam. Alamat rumah tidak ditampilkan. | TB-014, TB-023 |
| TB-025 | P0 | Implementasikan permintaan pinjam dan transisi status yang telah disepakati, dengan otorisasi pemilik/peminjam dan riwayat perubahan. | TB-002, TB-024 |
| TB-026 | P0 | Implementasikan peta/daftar lokasi dengan filter; izin lokasi opsional, pencarian manual tersedia, titik privat digeneralisasi. | TB-001, TB-013 |
| TB-027 | P1 | Tambahkan titik temu publik pilihan setelah permintaan diterima; tidak ada koordinat rumah di respons publik. | TB-002, TB-025, TB-026 |

## M3 — Komunitas, acara, merchandise

| ID | Prio | Pekerjaan dan penerimaan | Depends on |
|---|---|---|---|
| TB-030 | P0 | Bangun profil komunitas (deskripsi, minat, lokasi umum, kontak/tautan, status verifikasi). Status verifikasi menjelaskan arti dan batasnya. | TB-013, TB-014 |
| TB-031 | P0 | Terapkan pengajuan dan peninjauan profil komunitas oleh pengelola manusia; perubahan status dan alasan tercatat. | TB-030 |
| TB-032 | P1 | Buat CRUD acara milik komunitas, tanggal/waktu, lokasi atau tautan, dan status publikasi. Pengunjung hanya melihat acara yang dipublikasikan. | TB-030, TB-014 |
| TB-033 | P0 | Buat model listing merchandise dengan komunitas pemilik, nama, deskripsi, harga/keterangan, foto opsional, status stok, dan arsip. Hanya pengelola sah yang dapat mengubah listing. | TB-001, TB-013, TB-014 |
| TB-034 | P0 | Buat halaman katalog/detail merchandise dan tautan/cara pembelian yang sesuai keputusan `DEC-03`. Jika checkout belum disetujui, tidak ada pengumpulan pembayaran atau klaim bahwa transaksi terjadi di platform. | TB-033, TB-001 |
| TB-035 | P2 | Jika dan hanya jika transaksi in-app disetujui: desain dan implementasikan pesanan, pembayaran melalui provider, status, refund/sengketa, privasi alamat, dan rekonsiliasi. Kriteria penerimaan ditetapkan ulang setelah keputusan kebijakan. | TB-001, keputusan legal/operasional, TB-033 |
| TB-036 | P0 | Tambahkan pelaporan buku/listing/komunitas/acara/merchandise dan antrean peninjauan manusia. Pelapor menerima konfirmasi, moderator dapat mencatat hasil. | TB-030, TB-033 |

## M4 — Rekomendasi, mutu, rilis

| ID | Prio | Pekerjaan dan penerimaan | Depends on |
|---|---|---|---|
| TB-040 | P1 | Buat baseline rekomendasi buku berbasis metadata/minat yang tersedia. Tampilkan alasan sederhana, data tipis menghasilkan fallback, dan pengguna dapat menghapus minat. | TB-021, TB-022, TB-013 |
| TB-041 | P1 | Buat rekomendasi komunitas memakai minat dan lokasi umum; jelaskan alasan tanpa mengekspos lokasi presisi. | TB-030, TB-026, TB-040 |
| TB-042 | P0 | Tinjau seluruh alur kritis: akses tanpa izin, input invalid, kegagalan provider, data kosong, keyboard, layar kecil, dan kebocoran lokasi. Catat hasil dan perbaikan. | TB-012–TB-041 |
| TB-043 | P0 | Siapkan logging operasional tanpa token/PII sensitif, penanganan error, backup/restore yang sesuai layanan, serta panduan respons insiden. | TB-014, TB-035 bila aktif |
| TB-044 | P0 | Siapkan deployment staging/produksi sesuai layanan yang dipilih, environment terpisah, migrasi terkontrol, domain/HTTPS, dan prosedur rollback. | TB-010, TB-013, TB-042, TB-043 |
| TB-045 | P0 | Jalankan uji penerimaan skenario pengguna, perbaiki temuan rilis, siapkan data demo yang aman dan panduan demo. | TB-042, TB-044 |
| TB-046 | P0 | Lakukan go/no-go dengan checklist rilis di bawah; catat keputusan, penanggung jawab dan waktu rilis. | TB-045 |

## Gate tambahan sebelum production

| ID | Prio | Pekerjaan dan penerimaan | Depends on |
|---|---|---|---|
| TB-047 | P0 | Rotasi atau cabut password database, token Upstash, dan API key email yang pernah tercantum pada sample lokal; pastikan nilai baru hanya ada di secret manager deployment. | — |
| TB-048 | P0 | Putuskan hosting dan mode koneksi Postgres (`DEC-01`), atur `DATABASE_URL` runtime dan `DIRECT_URL` migrasi, TLS, serta batas koneksi yang sesuai platform. | DEC-01 |
| TB-049 | P0 | Tentukan role database runtime least-privilege dan strategi RLS/API; uji bahwa klien tanpa sesi tidak dapat membaca atau mengubah data privat pada staging. | TB-048, TB-014 |
| TB-050 | P0 | Jalankan smoke/integration/E2E pada staging memakai layanan terpisah; buktikan auth, CRUD, rate limit, pemulihan, dan halaman utama sebelum go/no-go. | TB-047–TB-049 |

## Kriteria penerimaan utama

- Pengunjung dapat mencari buku, membaca detail, melihat opsi akses, komunitas/acara, serta katalog merchandise tanpa akun bila kontennya publik.
- Pengguna masuk dapat mengelola bookmark/minat, listing yang menjadi haknya, dan permintaan pinjam sesuai perannya.
- Pengelola komunitas tidak dapat mengubah komunitas lain; merchandise terikat ke komunitas penjual yang jelas.
- Sistem membedakan stok habis, disembunyikan, data tidak tersedia, dan kegagalan integrasi.
- Lokasi pribadi tidak bocor melalui UI, API, pencarian, atau log.
- Semua operasi tulis memvalidasi input dan izin di server; error tidak membocorkan rahasia.
- Tidak ada pembayaran in-app sebelum `DEC-03` dan keputusan terkait benar-benar disetujui.

## Pengujian yang perlu disiapkan tim

Uji unit untuk aturan status/validasi; uji integrasi untuk API, database, provider eksternal, dan otorisasi; uji alur ujung-ke-ujung untuk pencarian → akses, permintaan pinjam, kelola komunitas/acara, dan listing merchandise. Verifikasi manual mencakup keyboard, layar kecil, izin lokasi ditolak, serta data kosong. Jalankan pengujian sebelum rilis; dokumen ini tidak mengklaim bahwa pengujian sudah dijalankan.

## Checklist rilis

- [ ] Scope dan keputusan merchandise ditandatangani pemilik produk.
- [ ] Tidak ada keputusan P0 yang masih ambigu untuk fitur yang dirilis.
- [ ] Migrasi dan kebijakan akses diperiksa oleh anggota tim lain.
- [ ] Rahasia hanya berada di konfigurasi deployment; tidak muncul di repo/log.
- [ ] Uji alur kritis dan hak akses lulus; temuan blocker ditutup.
- [ ] Pencarian eksternal memiliki atribusi/ketentuan penggunaan dan fallback.
- [ ] Formulir laporan, moderasi manusia, dan kontak dukungan tersedia.
- [ ] Titik lokasi dan data demo tidak mengungkap alamat pribadi.
- [ ] Status stok/harga/cara pembelian merchandise jelas dan sesuai keputusan.
- [ ] Backup, pemantauan, rollback, dan penanggung jawab insiden diketahui.
- [ ] Konten demo tidak menyatakan klaim yang belum diverifikasi.
- [ ] Go/no-go, versi, tanggal, dan pemilik rilis dicatat.

## Risiko dan blocker terbuka

Lihat [DECISIONS.md](DECISIONS.md). Task `TB-035` tetap diblokir sampai model transaksi dan kewajiban operasional disepakati. Estimasi waktu, ukuran sprint, dan kapasitas tim belum diberikan.

## Snapshot implementasi repo

Audit kode lokal pada 2026-10-10. Status berikut menunjukkan progres implementasi, bukan penerimaan/QA final; kriteria dokumen utama tetap berlaku.

| Task | Status repo | Bukti atau langkah berikut |
|---|---|---|
| TB-010 | Berjalan | README, `.env.example` placeholder, `bun run check`, lint/typecheck/build tersedia; kredensial lama perlu dirotasi dan review deployment belum selesai. |
| TB-011 | Berjalan | Route groups, katalog, Tentang, daftar komunitas terverifikasi, acara mendatang terbit, status informasi perpustakaan, dashboard akun, navigasi privat, dan tombol keluar tersedia; smoke production lokal sebelumnya untuk `/`, `/about`, `/login` mendapat 200 dan rute acak 404. Review responsif masih belum selesai. |
| TB-012 | Berjalan | Supabase Auth, callback, email verification, dan recovery ada; uji alur sesi/izin lintas pengguna belum dicatat. |
| TB-013 | Berjalan | Skema dan lima migrasi Drizzle ada; `drizzle-kit check` lulus dan migrasi diterapkan ke PGlite kosong (18 tabel). Uji PostgreSQL/Supabase staging masih perlu. |
| TB-014 | Berjalan | Guard server dan ownership untuk listing ada; RLS aktif di tabel tanpa policy eksplisit. Role koneksi runtime dan akses multi-user perlu dipastikan sebelum production. |
| TB-015 | Berjalan | UI/form dan validasi Zod tersedia; audit aksesibilitas dan katalog komponen belum selesai. |
| TB-020 | Berjalan | Review kandidat katalog dan sampel awal ada di `BOOK_CATALOG_PROVIDER_REVIEW.md`; keputusan provider tetap DEC-06. |
| TB-021 | Tertahan | Integrasi eksternal menunggu pemilihan provider pada DEC-06. |
| TB-022 | Berjalan | Katalog lokal, detail, bookmark, dan listing tersedia; cakupan provider final belum ada. |
| TB-023 | Tertahan | Rekonsiliasi 2026-10-10 memastikan `book_accesses` saat ini adalah izin akses pinjam, bukan ketersediaan perpustakaan. Belum ada relasi buku-perpustakaan; DEC-13 perlu menentukan sumber, status, kesegaran, dan pemilik pembaruan sebelum migrasi atau UI agregasi. |
| TB-024 | Berjalan | Pemilik dapat membuat dan mengelola listing; uji privasi lokasi dan uji pengguna belum dicatat. |
| TB-025 | Tertahan | Alur status dan tenggat menunggu DEC-02. |
| TB-026 | Tertahan | Provider peta dan kebijakan lokasi menunggu DEC-07. |
| TB-030–TB-033, TB-035, TB-037–TB-039, TB-041–TB-046 | Belum dimulai | Lanjutkan sesuai dependensi dan keputusan pada tabel utama. Checkout TB-035 tetap menunggu DEC-03. |
| TB-034 | Berjalan sebagian | Katalog publik dan GET API baca-saja hanya menampilkan listing terbit dari komunitas terverifikasi; alur kelola listing, detail dan keputusan transaksi masih perlu diselesaikan. |
| TB-036 | Berjalan sebagian | API menerima laporan buku/listing/komunitas/acara/merchandise/akun, dashboard admin, antrean, dan perubahan status/catatan tersedia. Form UI tersedia pada buku/listing, kartu komunitas/acara/merchandise, dan akun pemilik salinan (API menolak laporan terhadap akun sendiri); uji moderator/staging belum berjalan. |
| TB-040 | Berjalan | Halaman rekomendasi buku baseline dan pengelolaan minat pengguna tersedia; pencocokan kategori persis dengan fallback katalog terbaru. Belum ada evaluasi relevansi atau QA pengguna. |
| TB-047 | Belum dimulai | Placeholder ditulis; pemilik akun masih perlu mencabut/merotasi kredensial lama jika aktif. |
| TB-048 | Tertahan | Hosting belum dipilih pada DEC-01; driver runtime kini `node-postgres`, `DIRECT_URL` diprioritaskan untuk migrasi, tetapi URL/TLS/pool size belum diuji terhadap staging. |
| TB-049 | Tertahan | Belum ada policy RLS eksplisit atau role database runtime yang ditinjau; harus diselesaikan sebelum production. |
| TB-050 | Belum dimulai | Unit dan migrasi PGlite lulus; staging integration/E2E dan pemeriksaan browser belum berjalan. |

## Catatan implementasi lanjutan — 2026-10-10

- Pengaturan profil kini mencakup pembaruan nama tampilan melalui aksi server terautentikasi, validasi Zod, pembatasan 5 perubahan/menit per akun, dan pesan hasil yang aman. Penghapusan akun serta pengaturan retensi tetap menunggu DEC-11; edit preferensi bebas belum dibuka karena skema preferensi JSON belum memiliki kontrak produk.
- Rekomendasi buku awal memakai kategori lokal dan minat yang dapat ditambah/dihapus pengguna; buku yang sudah dibookmark dikecualikan. Ini implementasi baseline TB-040 saja, bukan keputusan penyedia ML (DEC-08) atau klaim kualitas rekomendasi.
- Pelaporan terhadap buku/listing/komunitas/acara/merchandise/akun dan route tinjauan admin tersedia; API memvalidasi target dan menggunakan role `ADMIN`. Form UI terpasang pada buku/listing serta kartu komunitas/acara/merchandise. Halaman buku publik memakai proyeksi kolom aman, bukan record provider mentah. Alur moderasi tidak mengubah visibilitas konten.
- Halaman Tentang kini menggunakan ringkasan PRD dan menyatakan batas ketersediaan data tanpa mengklaim fitur komunitas/perpustakaan yang belum aktif.
- Dashboard pembaca merangkum hitungan bookmark, listing milik pengguna, dan minat melalui query agregat, tanpa memuat daftar data pribadi yang tidak diperlukan.
- Query API listing pengguna kini memilih hanya metadata buku yang dibutuhkan, tidak memuat relasi permintaan pinjam atau profil pemintanya. Alur permintaan pinjam tetap nonaktif sampai DEC-02 diputuskan.
- Halaman `/admin` menampilkan hitungan laporan menunggu dan sedang ditinjau; proteksi akses diwarisi dari layout management berbasis role `ADMIN`.
- API `/api/recommendations` menyajikan hasil baseline TB-040 dengan whitelist field publik; endpoint memerlukan sesi dan rate limit.
- Halaman `/communities` dan `/events` serta endpoint GET terkait kini menampilkan data publik dengan batas eksplisit: komunitas harus `VERIFIED`, acara harus `PUBLISHED` dan mendatang, serta hanya kolom yang diperlukan dipilih. Form pelaporan kini juga tersedia pada kedua daftar untuk pengguna masuk. CRUD dan halaman perpustakaan tetap menunggu keputusan otorisasi serta DEC-13.
- Katalog merchandise baca-saja dan `GET /api/merchandise` menampilkan listing `PUBLISHED` dari komunitas `VERIFIED` dengan field publik terbatas, status ketersediaan, pagination, dan pelaporan. Tidak ada checkout atau order aktif; keputusan transaksi dan rincian listing tetap terbuka pada DEC-03/DEC-12.
- Rute `/libraries` sekarang menjelaskan dengan jujur bahwa ketersediaan buku perpustakaan belum disajikan; tidak ada stok/data rekaan. Agregasi dan API tetap tertahan pada DEC-13.
- Status ini bukan bukti QA responsif/aksesibilitas atau kesiapan production. Uji staging, keputusan deployment, policy RLS eksplisit, dan rotasi kredensial tetap menjadi gate TB-047–TB-050.


## Slicing desain Figma — 2026-10-10

- Sumber: file Figma `TemuBaca` (node Beranda `21:36`, Header `117:767`). Token warna Figma (`background #faf7f0`, `primary #1b4d37`, `muted-foreground #5d6760`, `input #d1d9ce`, `border #e3e3db`) diterapkan di `globals.css`; font Lora/Inter sudah sesuai.
- Header publik (logo, navigasi aktif, Masuk/Daftar atau avatar ke dashboard) dan footer baru dipakai di route group `(public)`.
- Beranda memakai data nyata: agenda terbit, buku terbaru, dan merchandise komunitas terverifikasi, dengan empty state. Statistik, rating, jumlah peserta, jarak, pemilih lokasi, filter genre, dan tombol "Pinjam" dari mockup sengaja tidak dirender karena datanya belum ada atau menunggu DEC-02/DEC-07. Foto acara/merchandise memakai placeholder sampai skema gambar disepakati.
- Autentikasi (node `58:22097`, `58:22330`, `58:22591`, `58:22974`, `58:22774`, varian error): layout bersama `features/auth/components/auth-layout.tsx` dipakai login, daftar, lupa kata sandi, atur ulang, dan verifikasi email. Tab Masuk/Daftar kini berupa link ke `/login` dan `/register`. Daftar mewajibkan centang komitmen sebelum submit (hanya di klien). Statistik "12.400+ buku / 48 titik temu", nomor WhatsApp, dan lokasi titik temu dari mockup tidak diimplementasikan: angkanya tidak terverifikasi, sedangkan nomor WhatsApp dan lokasi tidak ada di skema; lokasi menunggu DEC-07 dan pengumpulan nomor telepon butuh keputusan privasi. Figma memakai kode OTP, tetapi implementasi tetap memakai tautan email Supabase.
- Jelajahi Buku (node `43:21245`): `/books` kini menampilkan katalog walau tanpa kata kunci, dengan filter kategori dan bahasa dari data nyata (`listBookFacets`), kartu hasil horizontal berisi jumlah salinan `AVAILABLE` yang dibagikan warga (`browseBooks`), pagination bernomor, dan CTA untuk membagikan buku. `searchBooks` dan `/api/books/search` tidak diubah. Filter tahun terbit, akses baca di tempat, verifikasi komunitas, jarak/lokasi, label status, urutan relevansi, dan tombol "Usulkan buku baru" belum dibuat karena datanya belum ada atau menunggu DEC-06/DEC-07/DEC-13.
- Detail Buku (node `21:1590`): breadcrumb, panel sampul dengan Simpan/Bagikan/laporan, identitas bibliografi, sinopsis, "Cara Membaca di Sekitarmu" (perpustakaan ditandai belum tersedia sesuai DEC-13; salinan warga memakai listing nyata dengan tanggal pembaruan dan laporan), serta band "Punya Salinan di Rumah?" yang memakai form listing yang sudah ada. `generateMetadata` ditambahkan. Tombol pinjam, rating/ulasan, jumlah halaman/format, kutipan, jarak, dan klub terkait tidak dibuat karena menunggu DEC-02/DEC-07 atau datanya belum ada.
- Komunitas & Acara (node `21:3488`): `/communities` menjadi hub dengan hero pencarian, kartu komunitas terverifikasi (inisial, lokasi umum, deskripsi, jumlah anggota `ACTIVE`, dan acara mendatang dari agregat nyata), acara literasi (komponen `HomeEvents` dipakai ulang), serta band ruang aman. `listCommunities`, termasuk `GET /api/communities`, kini menyertakan `activeMemberCount` dan `upcomingEventCount`. Tombol Ikuti/Profil, tag minat, jadwal rutin, foto acara, peserta, dan jarak belum dibuat (menunggu alur keanggotaan publik, halaman profil komunitas, dan DEC-07).
- Profil Komunitas (node `21:3047`): rute baru `/communities/[communityId]` hanya untuk komunitas `VERIFIED`, memakai proyeksi aman `findPublicCommunityProfile` (tanpa data pemilik/anggota). Isinya header dengan inisial, lokasi umum, tanggal terdaftar, statistik nyata (anggota aktif, acara mendatang, merchandise), tab anchor Tentang/Acara/Merchandise, daftar acara dan merchandise komunitas (opsi `communityId` baru pada query publik), Bagikan, dan pelaporan. Kartu di `/communities` kini menautkan ke profil. Foto sampul, Hubungi/Ikuti Komunitas, pengurus, etika, jadwal rutin, koleksi kotak pustaka, dan dokumentasi belum dibuat (butuh skema, alur keanggotaan, dan keputusan privasi pengurus).
- Detail Acara (node `21:2566`): rute baru `/events/[eventId]` untuk acara `PUBLISHED` dari komunitas `VERIFIED` (acara lampau tetap bisa dibuka dengan label "Sudah berlangsung"). Isinya status, judul, komunitas penyelenggara (link ke profil), kartu tanggal/jam WIB, deskripsi, lokasi publik, tautan `eventUrl` hanya jika http(s) dengan `rel="noopener noreferrer nofollow"`, Bagikan, laporan, dan komitmen ruang aman. Kartu acara di Beranda, `/events`, dan profil komunitas kini menautkan ke detail. Kapasitas, peta/rute, perlengkapan, susunan acara, fasilitator, rak titik temu, dan "Ikuti Komunitas" belum dibuat (butuh skema, DEC-07, alur keanggotaan).
- Detail Merchandise (node `21:1194`): rute baru `/merchandise/[listingId]` untuk listing `PUBLISHED` dari komunitas `VERIFIED` (`findPublicMerchandise`). Isinya komunitas penjual, status ketersediaan, harga Rupiah, deskripsi, langkah mendapatkan barang tanpa transaksi di platform, pemberitahuan bahwa TemuBaca belum memproses pembayaran, etika, dan merchandise lain dari komunitas yang sama. Format harga dipindah ke `features/merchandise/format.ts`, sehingga katalog `/merchandise` tidak lagi menampilkan angka mentah ("85000.00 IDR"). Kartu merchandise di Beranda, katalog, dan profil komunitas kini menautkan ke detail. Foto, galeri, spesifikasi fisik, dampak sosial, sisa stok, dan tombol WhatsApp/Instagram belum dibuat karena kolomnya tidak ada; kontak komunitas butuh keputusan produk/privasi (DEC-03/DEC-12).
- Dialog Laporkan (node `25:6948`): `ReportForm` kini berupa dialog modal `<dialog>` (fokus terkunci, Esc, backdrop) dengan badge jenis entitas, judul berisi nama entitas (`targetName`), empat alasan radio, detail opsional dengan penghitung 0/500 dan peringatan data pribadi, catatan peninjauan oleh manusia, serta status validasi/mengirim/sukses/gagal. Alasan terpilih dikirim sebagai `reason`; kontrak API tidak berubah. Kartu konteks dengan sampul/ID entitas dari mockup tidak dibuat. Belum diverifikasi di browser karena butuh sesi login nyata (profil dummy tidak punya akun Auth).
- Layar Figma lain (peta ruang baca, bookmark & minat, peminjaman, pengelola komunitas, admin, profil saya) belum di-slice.

## Data dummy — 2026-10-10

- `bun run db:seed` (script `scripts/seed-dummy.ts`) mengisi 4 profil, 8 buku, 6 listing, 4 komunitas (1 `PENDING`), 9 keanggotaan, 5 acara (1 `DRAFT`), dan 4 merchandise. Semua baris memakai UUID tetap berawalan `5eed0000-`; `bun run db:seed --reset` hanya menghapus baris tersebut. Profil dummy tidak punya akun Supabase Auth. Script menolak berjalan dengan `NODE_ENV=production`.
- Sudah dijalankan ke Supabase dev di `.env` atas persetujuan pemilik proyek.
- Temuan dan perbaikan drift: Supabase dev hanya mencatat migrasi `0000` di `drizzle.__drizzle_migrations__`, padahal efek `0001`–`0003` sudah ada (kemungkinan lewat `drizzle-kit push`). `0004` (default `now()` untuk `updatedAt` di 13 tabel) belum diterapkan, sehingga insert yang tidak mengisi `updatedAt` gagal. Atas persetujuan pemilik proyek, `0004` diterapkan dan `0001`–`0004` dicatat di jurnal (hash SHA-256 dicocokkan dengan baris `0000` yang ada) dalam satu transaksi. Setelahnya semua kolom `updatedAt` punya default dan RLS aktif di semua tabel. Lingkungan lain (staging/production) perlu dicek dengan cara yang sama sebelum `drizzle-kit migrate`.
- Bug yang ditemukan lewat data dummy dan sudah diperbaiki: subquery agregat (`availableCopies`, `activeMemberCount`, `upcomingEventCount`) membandingkan kolom tanpa nama tabel, sehingga selalu menghasilkan 0.

## Verifikasi teknis — 2026-10-10

- Line ending: `.gitattributes` memaksa LF; working copy dinormalisasi (isi index tidak berubah).
- Migrasi Supabase dev: jurnal berisi 5 baris (`0000`–`0004`), tidak ada migrasi tertunda; `drizzle-kit check` lulus.
- Layout (data dummy, lebar 1280px dan 375px): `/`, `/books`, detail buku, `/communities`, profil komunitas, detail acara, detail merchandise, `/login`, `/register`, `/forgot-password` tidak memiliki overflow horizontal. Perbaikan: judul profil komunitas sebelumnya menimpa banner hijau 14px di desktop.
- Audit aksesibilitas otomatis di 16 rute publik/auth: tiap halaman punya tepat satu `h1`, tidak ada `img` tanpa `alt`, tidak ada ID ganda, semua link/tombol dan input punya nama. Temuan pada checkbox Radix di login/register adalah positif palsu (nama dari `<label for>`, input tersembunyi `aria-hidden`).
- Uji dengan sesi login nyata (akun admin pemilik proyek, Supabase dev): dashboard; bookmark buku → muncul di `/bookmarks`; buat listing → sukses dan tampil di detail buku tanpa tombol "Laporkan akun pemilik" untuk diri sendiri; tandai listing tidak tersedia → hilang dari halaman publik; dialog laporan (validasi tanpa alasan, penghitung karakter, kirim sukses, Esc menutup); laporan muncul di `/moderation/reports`; tambah minat → rekomendasi berubah menjadi "Sesuai minat"; `/settings` dan `/admin` terbuka. Perbaikan: label status pada kartu tinjauan laporan tidak berubah setelah disimpan sampai halaman dimuat ulang.
- Data uji yang tertinggal di akun pemilik proyek: bookmark *Laskar Pelangi*, listing *Ronggeng Dukuh Paruk* (tidak tersedia, lokasi "Uji QA - Taman Suropati"), minat "Fiksi Sejarah", dan satu laporan uji berstatus `REJECTED`. Listing ikut terhapus saat `db:seed --reset` hanya jika bukunya dummy; hapus manual bila perlu.
- Belum terverifikasi: ubah nama tampilan, edit detail listing, hapus minat/bookmark, alur keluar, navigasi keyboard manual, pembaca layar, dan kontras warna terukur.
