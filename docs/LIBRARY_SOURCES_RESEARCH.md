# TemuBaca Library Availability Sources Research

**Status:** riset selesai; belum ada sumber yang dipilih atau diintegrasikan  
**Diteliti:** 2026-10-19  
**Keputusan terkait:** `DEC-13` (arah: integrasi katalog perpustakaan), `TB-023` (tetap tertahan sampai pemilik memilih sumber pertama)

## Ruang lingkup

Dokumen ini menilai sumber data yang bisa menjawab "perpustakaan mana yang memiliki buku ini, dan apakah tersedia" di bagian "Cara Membaca di Sekitarmu" pada halaman detail buku. Dokumen ini tidak memilih sumber, tidak mengizinkan integrasi produksi, dan tidak mengubah kode. Datanya disimpan terpisah dari `book_accesses` (hak akses hasil permintaan pinjam antar pengguna).

Dua hal sering tertukar dan dibedakan di seluruh dokumen ini:

- **Rekaman bibliografis / holdings:** "perpustakaan X mencatat judul ini di koleksinya" (lokasi, nomor panggil, barcode).
- **Ketersediaan tingkat eksemplar:** "eksemplar ini sedang di rak" atau "sedang dipinjam". Ini hanya ada bila sistem perpustakaan menyiarkannya secara langsung.

## Cara membaca bukti

Tanda di tabel dan teks:

- **[V]** Diverifikasi. Endpoint atau berkas benar-benar diambil pada 2026-10-19 dari mesin riset ini (permintaan `curl` dengan `User-Agent: TemuBacaResearch/1.0`, tanpa kunci, tanpa login), atau kode sumbernya dibaca.
- **[D]** Hanya didokumentasikan oleh halaman resmi atau sumber pihak ketiga yang dikutip. Tidak dicoba langsung.
- **[?]** Belum diketahui. Tidak ditemukan bukti, atau permintaan diblokir. Jangan dianggap ada.

Semua uji dijalankan dari satu jaringan, satu kali, dengan beberapa permintaan per situs. Ini bukan uji beban dan bukan uji keandalan jangka panjang.

## Ringkasan perbandingan

| Sumber | API / ekspor publik | Cari lewat ISBN / judul | Ketersediaan per eksemplar | Izin dan syarat | Usaha integrasi |
|---|---|---|---|---|---|
| Indonesia OneSearch (Perpusnas) | Tidak ada API terdokumentasi [?]. Tampilan RSS hasil pencarian VuFind berfungsi [V]. OAI-PMH server "Not Configured" [V] | ISBN dan judul berfungsi [V] | Tidak terlihat pada rekaman contoh [V]; hanya lokasi koleksi dan barcode | Halaman syarat tidak ditemukan [?]. `robots.txt` memberi 404 [V] | Sedang. Perlu parsing HTML halaman rekaman |
| Katalog Induk Nasional / OPAC Perpusnas | Tidak diketahui [?] | Tidak diketahui [?] | Tidak diketahui [?] | Tidak diketahui [?] | Tidak bisa dinilai; situs menolak klien otomatis (HTTP 403) [V] |
| iPusnas | Tidak ada API publik yang ditemukan [?] | Tidak diketahui [?] | Ada di aplikasi (antrean bila salinan habis) [D], tidak ada akses programatik | Perlu kerja sama dengan Perpusnas | Tinggi, bergantung izin |
| SLiMS | Ada OAI-PMH (`oai2.php`) dan REST `api/v1` bawaan [V, dari kode] | Pencarian OPAC per perpustakaan; REST bawaan tidak punya pencarian ISBN [V] | Tabel eksemplar ada di basis data; ekspos ke publik tidak terverifikasi | Tiap perpustakaan memutuskan sendiri | Sedang sampai tinggi: satu integrasi per instalasi |
| INLISLite (Perpusnas) | Halaman "OAI PMH Service" ada di situs resmi [V]; isi tidak terbaca | Tidak diketahui [?] | Tidak diketahui [?] | Tidak diketahui [?] | Tidak bisa dinilai |
| OPAC universitas (UI, UGM, ITB) | Tidak ditemukan endpoint terbuka [?] | Tidak diketahui [?] | Tidak diketahui [?] | Tidak diketahui [?] | Satu per satu, tinggi |
| Open Library (lending) | Ya, publik [V] | ISBN dan OLID [V] | Hanya status pinjam e-book Internet Archive [D, V sebagian] | Aturan penggunaan API Open Library | Rendah, tetapi nilai untuk buku Indonesia kecil |
| WorldCat | Search API v2 memakai token; v1 dihentikan [D] | ISBN, nomor OCLC [D] | Holdings ya, ketersediaan waktu nyata tidak [D] | Perlu langganan OCLC [D] | Tinggi, tidak realistis untuk TemuBaca |

## Temuan per sumber

### 1. Indonesia OneSearch (onesearch.id) — kandidat terkuat

Layanan penemuan nasional yang dijalankan Perpusnas. Halaman beranda menyebut sekitar 16,5 juta entri unik dan 23,2 juta entri dengan duplikat, dikumpulkan dengan harvesting otomatis dari repositori organisasi mitra [V, teks beranda].

Diverifikasi pada 2026-10-19:

- Halaman menyatakan `Generator: VuFind 3/OneSearch` [V].
- Pencarian ISBN `https://onesearch.id/Search/Results?lookfor=9789793062792&type=ISN` mengembalikan 67 rekaman berjudul LASKAR PELANGI [V]. ISBN lain (`9786020331263`, sebuah ISBN uji yang diambil sembarang) mengembalikan 0 hasil [V]. Cakupan ISBN secara umum belum diukur.
- Menambahkan `&view=rss` ke URL hasil pencarian mengembalikan RSS XML: `opensearch:totalResults`, 50 butir per halaman, tautan halaman berikutnya, serta judul, penulis, tahun, dan tautan `/Record/<id>` per butir [V]. RSS tidak memuat nama perpustakaan.
- Halaman rekaman (`/Record/IOS19238.195766-4-2018`) menampilkan institusi ("DINAS PERPUSTAKAAN DAN KEARSIPAN KOTA SURABAYA"), nama perpustakaan, "Lokasi Koleksi" (contoh: TBM RW 5 Rungkut Kidul), barcode, nomor panggil, dan tautan ke katalog sumber (`sipus.surabaya.go.id`). Metadata Dublin Core juga tertanam di halaman [V].
- Pada rekaman contoh tidak ada penanda "tersedia" atau "dipinjam" [V]. Satu rekaman bukan bukti bagi semua mitra.
- `https://onesearch.id/OAI/Server?verb=Identify` menjawab "OAI Server Not Configured." [V]. Jadi OneSearch tidak membuka rekamannya untuk di-harvest ulang lewat OAI-PMH.
- `https://onesearch.id/api/v1/search` mengembalikan 404 [V]. Tidak ditemukan API REST resmi.
- `robots.txt` mengembalikan 404, dan halaman syarat yang dicoba (`/Content/terms`, `/Content/about`) juga 404 [V]. Syarat penggunaan dan pembatasan laju tidak diketahui [?].

Konteks tambahan [D]: OneSearch dirancang agar mitra menyediakan OAI-PMH untuk di-harvest ke OneSearch (materi lokakarya 2016 di [idr.uin-antasari.ac.id](https://idr.uin-antasari.ac.id/6511/3/Open%20Archives%20Initiative%20%28OAI%29%20Indonesia%20OneSearch.pdf)). Data ini adalah arah mitra → OneSearch, bukan OneSearch → pihak ketiga.

Penilaian: satu-satunya sumber nasional yang terbukti menjawab "perpustakaan mana yang mencatat ISBN ini". Kelemahannya: tanpa API resmi, integrasi bergantung pada struktur HTML VuFind (rapuh), butuh satu permintaan tambahan per rekaman untuk mendapat nama perpustakaan, dan tanpa status eksemplar. Syarat penggunaan belum jelas, jadi izin tertulis dari Perpusnas diperlukan sebelum dipakai di produksi.

### 2. Perpusnas: OPAC, Katalog Induk Nasional (KIN), situs utama

`opac.perpusnas.go.id`, `kin.perpusnas.go.id`, dan `www.perpusnas.go.id` semuanya menjawab HTTP 403 untuk klien otomatis [V]. Kemungkinan ada perlindungan bot; penyebab pastinya tidak diselidiki. Konsekuensinya: tidak ada endpoint yang bisa diverifikasi.

Pencarian web tidak menemukan dokumentasi publik Z39.50, SRU, atau OAI-PMH untuk KIN. Sumber yang ada hanya menyebut KIN sebagai katalog induk dengan fungsi mirip OneSearch (tesis IPB 2024 di [repository.ipb.ac.id](https://repository.ipb.ac.id/handle/123456789/157652?show=full)) [D]. Z39.50 untuk Perpusnas: tidak ada bukti [?]. Dan Z39.50 memakai TCP langsung, yang tidak cocok dengan fungsi serverless Vercel.

### 3. iPusnas

Aplikasi perpustakaan digital Perpusnas. Koleksi per 1 Nov 2024 dilaporkan sekitar 126 ribu judul dengan sekitar 1,57 juta salinan, dan antrean muncul bila stok habis [D, laporan media yang dikutip di hasil pencarian]. Pencarian tidak menemukan dokumentasi API resmi. `ipusnas.id` tidak dapat dihubungi dari mesin ini (tanpa respons HTTP), dan `ipusnas.perpusnas.go.id` menjawab 403 [V]. Jangan melakukan scraping aplikasi tanpa izin.

Catatan produk: iPusnas adalah ketersediaan e-book (digital), bukan "perpustakaan di sekitarmu". Nilainya untuk pembaca 13+ di seluruh Indonesia tinggi, tetapi hanya bisa dihubungkan dengan tautan keluar sampai ada kerja sama.

### 4. SLiMS (Senayan Library Management System)

Sistem manajemen perpustakaan sumber terbuka, lisensi GPL-3.0, repositori `slims/slims9_bulian` aktif (commit terakhir 2026-10-16) [V, metadata GitHub].

Dari kode sumber (`master`) [V]:

- `oai2.php` + `lib/oaipmh/` adalah penyedia data OAI-PMH 2.0 dengan format Dublin Core (`record_dc.php`) dan RIF-CS. Penghapusan rekaman diperlakukan `transient`. Apakah rekaman memuat status eksemplar: belum dibaca sampai tuntas [?].
- `api/v1/routes.php` hanya berisi rute agregat: `/biblio/popular`, `/biblio/latest`, `/biblio/gmd/..`, `/biblio/coll_type/..`, `/item/total/{all,lent,available}`, `/loan/summary`, dll. Tidak ada rute pencarian per ISBN atau per judul, dan hitungan item bersifat total seluruh perpustakaan, bukan per judul.
- Halaman detail OPAC mendukung `?p=show_detail&inXML=true&id=<id>` (XML) dan `JSONLD=true` bila fitur `jsonld_detail` aktif [V, kode `show_detail.inc.php`].

Tidak terverifikasi [?]: perpustakaan nyata mana yang menjalankan SLiMS dan membuka `oai2.php`-nya. Uji `slims.web.id/demo/oai2.php` memberi 404, jadi tidak ada instalasi hidup yang berhasil diuji. Mengaktifkan atau menutup OAI-PMH adalah pilihan tiap perpustakaan.

Penilaian: SLiMS adalah platform yang paling mungkin dipakai perpustakaan umum dan sekolah di daerah, dan pelaksanaan terbaik adalah per-perpustakaan: tiap mitra memberi tahu URL OPAC-nya dan menyetujui pengambilan. Biaya naik seiring jumlah perpustakaan.

### 5. INLISLite

Aplikasi perpustakaan terintegrasi buatan Perpusnas, versi 3.x berbasis framework Yii [D, hasil pencarian jurnal]. Situs resmi `inlislite.perpusnas.go.id` menjawab 200 dan menampilkan menu "Aplikasi Pendukung" yang memuat "OAI PMH Service", "Migrator", "SMS Gateway Service", dan "RFID Gateway Service" [V]. Isi halaman OAI-PMH dimuat dinamis dan tidak berhasil dibaca; format, autentikasi, dan syarat tidak diketahui [?]. Portal Jakarta (`perpustakaan.jakarta.go.id`, "JAKLITERA") tampak memakai INLIS berdasarkan teks halaman [V]. Jalur `/oai2.php` di sana 404, yang wajar karena itu jalur SLiMS, bukan bukti OAI mati [V].

### 6. OPAC universitas (UI, UGM, ITB)

- UI: `lib.ui.ac.id` menjawab 403 [V]; `opac.ui.ac.id` tidak merespons [V].
- UGM: `opac.lib.ugm.ac.id` menjawab 200 dengan judul "UGM Framework" [V]; perangkat lunak dan endpoint terbuka tidak teridentifikasi [?].
- ITB: `digilib.itb.ac.id` menjawab 200 (judul "Perpustakaan Digital - Digilib ITB") [V]; `/oai2.php` dan `/oai` memberi 404 [V]; endpoint terbuka tidak ditemukan [?].

Katalog kampus lebih cocok bagi mahasiswa kampus itu sendiri, bukan pembaca 13+ se-Indonesia, dan sering membatasi pinjam untuk sivitas. Prioritas rendah.

### 7. Open Library (lending)

Diverifikasi [V]:

- `https://openlibrary.org/api/books?bibkeys=ISBN:...&format=json&jscmd=data` dan `search.json` berfungsi tanpa kunci.
- `search.json` mengembalikan `ebook_access`. Untuk "Laskar Pelangi", "The rainbow troops", dan "Ayat-ayat cinta" nilainya `no_ebook`. Untuk "Harry Potter" `borrowable`. Jadi lending Internet Archive nyaris tidak mencakup buku Indonesia.
- `https://openlibrary.org/availability/v2?type=openlibrary_work&ids=<OLID>` ada; parameter `type` hanya menerima `openlibrary_work`, `openlibrary_edition`, atau `identifier` (ISBN tidak diterima langsung).
- Pencarian `isbn=9789793062792` di Open Library mengembalikan "Kota yang bernama dan tak bernama" dan "Laskar Pelangi", sedangkan OneSearch mengembalikan 67 rekaman Laskar Pelangi untuk ISBN yang sama. Satu contoh ini menunjukkan data ISBN Open Library untuk buku Indonesia bisa tidak konsisten; penyebabnya tidak diselidiki.

Didokumentasikan [D]: Read API (`/api/volumes/brief/isbn/<isbn>.json`) mengembalikan status "full access", "lendable", "checked out", atau "restricted" ([dokumentasi](https://openlibrary.org/dev/docs/api/read)). Batas laju dan identifikasi `User-Agent` mengikuti ulasan di `BOOK_CATALOG_PROVIDER_REVIEW.md`.

Penilaian: aman dan murah ditambahkan sebagai tautan "baca digital" untuk buku berbahasa Inggris, tetapi tidak menjawab "perpustakaan di sekitarmu" untuk buku Indonesia. Ini sumber ketersediaan digital, bukan perpustakaan fisik.

### 8. WorldCat

- `search.worldcat.org` (antarmuka web) menjawab 200 [V]. Endpoint lama `www.worldcat.org/webservices/catalog/content/isbn/...` menjawab HTTP 520 [V]; OCLC menyatakan dukungan Search API 1.0 berakhir 31 Des 2024 [D].
- Search API v2 memakai token akses, bukan WSKey di URL ([help.oclc.org](https://help.oclc.org/Librarian_Toolbox/OCLC_APIs/Troubleshooting/Why_am_I_receiving_an_error_when_I_try_and_access_the_WC_Search_API_v2_using_our_V1_key)) [D].
- WSKey untuk Search API disebut hanya diberikan kepada perpustakaan yang punya langganan Cataloging and Metadata dan FirstSearch/WorldCat Discovery; jalur lain adalah kemitraan komersial ([oclc.org](https://www.oclc.org/developer/api/oclc-apis/worldcat-search-api.en.html)) [D]. Holdings (perpustakaan mana yang memiliki) tersedia; ketersediaan waktu nyata tidak disebut [D].
- Cakupan perpustakaan Indonesia di WorldCat: tidak diukur [?].

Penilaian: tidak realistis bagi TemuBaca sebelum 30 Okt 2026 dan kemungkinan tidak sesuai secara biaya atau kelayakan.

## Temuan lintas sumber

1. Tidak ada sumber yang terbukti memberi status eksemplar (tersedia / dipinjam) lewat API terbuka. Yang terverifikasi hanyalah "perpustakaan mencatat judul ini" (OneSearch) dan agregat jumlah eksemplar (SLiMS REST).
2. Antarmuka UI harus jujur: gunakan wording seperti "Tercatat di koleksi · dicek 3 hari lalu", bukan "Tersedia", kecuali sumbernya benar-benar menyiarkan status eksemplar.
3. Banyak situs Perpusnas memblokir klien otomatis (403). Integrasi yang bergantung pada mereka berisiko, dan sebelum dipakai perlu persetujuan tertulis, bukan sekadar menyiasati blokir.
4. Dalam 11 hari tersisa, integrasi per-perpustakaan (SLiMS/INLIS) tidak mungkin diselesaikan tanpa mitra yang sudah bersedia.

## Rekomendasi untuk MVP sebelum 30 Okt 2026

**Sumber pertama: Indonesia OneSearch, mode "tercatat di koleksi", dengan syarat izin Perpusnas.**

1. Server TemuBaca mencari ISBN (`type=ISN&lookfor=<isbn>&view=rss`), lalu hanya untuk buku yang dibuka pengguna mengambil beberapa halaman `/Record/<id>` untuk institusi, lokasi, dan tautan katalog sumber. Simpan hasil di cache `library_holdings`; jangan memanggil OneSearch dari peramban pengguna dan jangan menyertakan data pengguna.
2. Status yang ditampilkan: `listed` ("tercatat di koleksi") dengan tanggal dicek. Tidak ada klaim "tersedia" di MVP.
3. Hubungi Perpusnas lebih dulu (lihat pertanyaan untuk pemilik). Tanpa jawaban sebelum peluncuran, pakai jalur cadangan di bawah.

**Jalur cadangan yang tidak bergantung izin pihak ketiga:** daftar perpustakaan yang dikurasi admin dengan tanggal "terakhir dicek" (opsi yang sudah tercatat di DEC-13), memakai tabel yang sama dengan `source = 'curated'`. Cepat dibuat dan tidak berisiko hukum. Bagian perpustakaan di halaman buku bisa tetap tersembunyi bila daftar kosong.

**Setelah peluncuran:** satu atau dua perpustakaan mitra berbasis SLiMS atau INLIS yang mau membuka OAI-PMH atau memberi akses, untuk status per eksemplar. Open Library hanya sebagai tautan "baca digital" bila relevan.

**Tidak direkomendasikan:** WorldCat (biaya dan kelayakan), scraping iPusnas atau situs yang menjawab 403, dan Z39.50 (tidak ada bukti layanan, dan tidak cocok dengan serverless).

## Sketsa model data

Terpisah dari `book_accesses`. Tabel di bawah hanyalah sketsa, bukan migrasi.

`libraries`

| Kolom | Catatan |
|---|---|
| `id` | uuid |
| `name`, `city`, `province` | nama dan wilayah |
| `institution` | induk (mis. dinas perpustakaan) |
| `catalog_url` | tautan katalog resmi |
| `external_ref` | id di sumber, mis. `9720` dari OneSearch |
| `kind` | `public`, `school`, `university`, `community` |

`library_holdings`

| Kolom | Catatan |
|---|---|
| `id` | uuid |
| `library_id` → `libraries` | |
| `book_id` → buku di katalog TemuBaca | |
| `source` | `onesearch`, `slims_oai`, `curated`, `openlibrary` |
| `source_record_id` | mis. id `/Record/...` atau OAI identifier |
| `source_url` | tautan ke rekaman di katalog sumber |
| `call_number`, `collection_location` | opsional |
| `status` | `listed`, `available`, `on_loan`, `unknown`. MVP hanya `listed` dan `unknown` |
| `copies_total`, `copies_available` | null bila sumber tidak menyiarkan |
| `match_method`, `match_confidence` | `isbn13`, `isbn10`, `title_author`; hanya `isbn*` yang tampil otomatis |
| `checked_at` | kapan terakhir dikonfirmasi sumber |
| `created_at`, `updated_at` | |

**Aturan kesegaran (usulan):**

- `listed`: dianggap segar 30 hari; sesudahnya label "terakhir dicek N hari lalu" tetap tampil, dan dijadwalkan cek ulang saat halaman buku dibuka.
- `available` / `on_loan` (bila nanti ada sumber): segar 24 jam. Lewat itu tampilkan `unknown`, bukan status lama.
- Kegagalan sumber (timeout, 403, 429): pertahankan baris lama, jangan naikkan `checked_at`, catat percobaan gagal.

**Penanganan duplikasi:**

- Kunci unik `(library_id, book_id, source, source_record_id)`.
- Satu perpustakaan bisa muncul dari beberapa sumber; saat tampil, gabungkan per `(library_id, book_id)` dan pilih sumber dengan prioritas `slims_oai` > `onesearch` > `curated`, tetapi pakai `checked_at` terbaru untuk label kesegaran.
- Banyak rekaman dengan judul sama dari satu institusi (OneSearch mengembalikan 67 rekaman untuk satu ISBN) harus diringkas menjadi satu baris per `library_id`, dengan jumlah eksemplar bila tersedia.
- Pencocokan hanya lewat ISBN-13 yang dinormalkan (ISBN-10 dikonversi). Pencocokan judul-penulis disimpan dengan `match_confidence` rendah dan tidak ditampilkan otomatis.

**Keamanan dan privasi:** tabel dapat dibaca publik (RLS `select` untuk semua), tetapi tulis hanya lewat peran server (job atau route server, tanpa kunci pengguna). Tidak ada data pengguna yang dikirim ke sumber; permintaan keluar memakai `User-Agent` yang mengidentifikasi TemuBaca dengan kontak, dan menghormati batas laju yang disetujui.

## Pertanyaan terbuka untuk pemilik

1. **Izin Perpusnas untuk OneSearch.** Maukah pemilik mengirim surat atau surel kepada Perpusnas (Pusat Data dan Informasi) untuk meminta izin pengambilan data OneSearch secara otomatis, batas laju yang wajar, dan atribusi yang diminta? Tanpa jawaban sebelum 30 Okt, apakah jalur cadangan (daftar kurasi admin) yang dipakai saat peluncuran?
2. **Kerja sama iPusnas.** Apakah ada kontak di Perpusnas untuk akses data iPusnas, atau cukup tautan keluar?
3. **Mitra pertama.** Adakah satu atau dua perpustakaan (umum, sekolah, atau komunitas) yang sudah dikenal pemilik dan bersedia membuka OAI-PMH atau memberi daftar koleksi, sebagai pembuktian jalur SLiMS/INLIS?
4. **Wording produk.** Setujukah pemilik bahwa MVP menampilkan "tercatat di koleksi" dan bukan "tersedia", mengingat tidak ada status eksemplar yang terverifikasi?
5. **Cakupan wilayah.** Bagian "di sekitarmu" mengandalkan lokasi pengguna (DEC-07 peta masih terbuka). Apakah MVP cukup menampilkan perpustakaan per kota atau provinsi tanpa jarak?
6. **Pengelolaan data kurasi.** Siapa yang memelihara daftar perpustakaan kurasi setelah peluncuran, dan seberapa sering "terakhir dicek" diperbarui?
7. **Tanggung jawab hukum atas data pihak ketiga.** Perlukah catatan di kebijakan privasi atau halaman bantuan bahwa data perpustakaan berasal dari katalog pihak lain dan bisa tertinggal?

## Bukti dan batas

Sumber yang dikutip (semua diakses 2026-10-19 kecuali dinyatakan lain):

- Indonesia OneSearch: [onesearch.id](https://onesearch.id/), contoh [pencarian ISBN dengan tampilan RSS](https://onesearch.id/Search/Results?lookfor=9789793062792&type=ISN&view=rss), [OAI server](https://onesearch.id/OAI/Server?verb=Identify) (jawaban "OAI Server Not Configured.").
- Materi OneSearch/OAI-PMH 2016: [idr.uin-antasari.ac.id](https://idr.uin-antasari.ac.id/6511/3/Open%20Archives%20Initiative%20%28OAI%29%20Indonesia%20OneSearch.pdf).
- SLiMS: [slims/slims9_bulian](https://github.com/slims/slims9_bulian), berkas [`api/v1/routes.php`](https://github.com/slims/slims9_bulian/blob/master/api/v1/routes.php), [`oai2.php`](https://github.com/slims/slims9_bulian/blob/master/oai2.php), [`lib/oaipmh/`](https://github.com/slims/slims9_bulian/tree/master/lib/oaipmh), [situs SLiMS](https://slims.web.id/web/pages/about/).
- INLISLite: [inlislite.perpusnas.go.id](https://inlislite.perpusnas.go.id/) dan [halaman OAI PMH Service](https://inlislite.perpusnas.go.id/oai-pmh-service).
- Open Library: [Read API](https://openlibrary.org/dev/docs/api/read), [API usage](https://openlibrary.org/developers/api), `search.json` dan `availability/v2` (dicoba langsung).
- WorldCat: [WorldCat Search API (OCLC)](https://www.oclc.org/developer/api/oclc-apis/worldcat-search-api.en.html), [bantuan OCLC tentang v1/v2](https://help.oclc.org/Librarian_Toolbox/OCLC_APIs/Troubleshooting/Why_am_I_receiving_an_error_when_I_try_and_access_the_WC_Search_API_v2_using_our_V1_key).
- Konteks KIN: [tesis IPB](https://repository.ipb.ac.id/handle/123456789/157652?show=full).

Batas riset ini:

- Tidak ada permintaan yang dikirim dengan login, kunci, atau menembus perlindungan bot. Situs yang menjawab 403 dicatat sebagai tidak diketahui.
- Tidak ada pembacaan syarat penggunaan OneSearch, Perpusnas, atau perpustakaan mana pun, karena halaman syarat tidak ditemukan atau situs memblokir. Kepatuhan harus dikonfirmasi dengan pemilik data.
- Tidak ada uji laju, beban, atau keandalan jangka panjang. Keandalan setiap sumber di atas belum dinilai.
- Cakupan ISBN buku Indonesia di OneSearch hanya diuji pada satu ISBN yang ada dan satu yang tidak ada; belum ada sampel representatif.
- Apakah rekaman OAI-PMH SLiMS dan INLISLite memuat status eksemplar belum dikonfirmasi.
- Pernyataan bertanda [D] bersumber dari dokumentasi atau pihak ketiga dan bisa sudah berubah.
