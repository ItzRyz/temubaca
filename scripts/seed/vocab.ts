/**
 * Word lists for synthetic text. Names are common Indonesian given and family names combined at
 * random, so a combination may match a real person by chance, as any common name would; nothing
 * here is copied from a real account. Book titles, authors, and publishers are invented and marked
 * `metadata.synthetic` on the row.
 */

export const givenNames = [
    "Adi", "Agus", "Ahmad", "Aisyah", "Aldi", "Alya", "Andi", "Anisa", "Arif", "Asih", "Ayu", "Bagas", "Bayu", "Bima",
    "Budi", "Cahya", "Citra", "Dani", "Dewi", "Dimas", "Dina", "Eka", "Elsa", "Endah", "Fajar", "Farah", "Fikri", "Fitri",
    "Galih", "Gita", "Hadi", "Hana", "Hendra", "Ika", "Ilham", "Indah", "Intan", "Irfan", "Joko", "Kartika", "Kevin",
    "Laras", "Lestari", "Lia", "Maya", "Melati", "Nadia", "Naufal", "Nina", "Nur", "Oki", "Putri", "Raden", "Rahma",
    "Raka", "Rani", "Reza", "Rina", "Rizky", "Sari", "Satria", "Sekar", "Sinta", "Siti", "Sri", "Taufik", "Tia", "Tika",
    "Umar", "Utami", "Vina", "Wahyu", "Wulan", "Yoga", "Yuni", "Zahra", "Zaki",
] as const;

export const familyNames = [
    "Anggraini", "Ardiansyah", "Gunawan", "Hakim", "Halim", "Handayani", "Harahap", "Hasibuan", "Hidayat", "Irawan",
    "Kurniawan", "Kusuma", "Lubis", "Maharani", "Mahendra", "Nasution", "Nugraha", "Nugroho", "Permana", "Pratama",
    "Prasetyo", "Purba", "Purnomo", "Putra", "Rahayu", "Ramadhan", "Saputra", "Setiawan", "Siregar", "Situmorang",
    "Suryadi", "Susanto", "Syahputra", "Tanjung", "Utomo", "Wibowo", "Widodo", "Wijaya", "Yulianti", "Yusuf",
] as const;

/** Fictional imprints for synthetic books. */
export const publishers = [
    "Penerbit Lentera Senja", "Aksara Teluk", "Pustaka Kenari", "Rumah Baca Nusantara Press", "Penerbit Daun Lontar",
    "Kanal Kata", "Penerbit Arus Pagi", "Teras Pustaka", "Penerbit Seribu Pena", "Jendela Aksara", "Penerbit Rintik",
    "Kedai Kata Press", "Penerbit Tanah Merah", "Galeri Halaman",
] as const;

export const titleNouns = [
    "Senja", "Hujan", "Rumah", "Jalan", "Laut", "Kota", "Kampung", "Langit", "Pelabuhan", "Stasiun", "Kebun", "Sungai",
    "Jendela", "Surat", "Lentera", "Pohon", "Pasar", "Gunung", "Pulau", "Musim", "Bayangan", "Lagu", "Peta", "Perahu",
] as const;
export const titlePlaces = [
    "Ujung Dermaga", "Tepi Kali", "Balik Bukit", "Kaki Gunung", "Persimpangan", "Gang Sempit", "Pinggir Kota", "Ladang Tebu",
    "Halaman Belakang", "Ujung Pulau", "Muara", "Lereng Utara",
] as const;
export const titleAdjectives = [
    "yang Hilang", "Terakhir", "Kedua", "yang Pulang", "Tanpa Nama", "di Bulan Juni", "yang Tertunda", "Kecil", "Lama",
    "yang Menunggu", "Sunyi", "Biru", "Panjang",
] as const;
export const nonfictionTopics = [
    "Membaca Lambat", "Menulis Esai", "Literasi Keluarga", "Kebiasaan Membaca", "Merawat Ingatan", "Perpustakaan Kampung",
    "Belajar Mandiri", "Kesehatan Jiwa Remaja", "Berkebun di Kota", "Ekonomi Rumah Tangga", "Sejarah Kota Pelabuhan",
    "Bahasa Daerah", "Kuliner Pesisir", "Pendidikan Anak Usia Dini", "Filsafat Sehari-hari",
] as const;

export const bookDescriptionOpeners = [
    "Kisah tentang", "Novel ini mengikuti", "Kumpulan tulisan yang membahas", "Buku ini mengajak pembaca menelusuri",
    "Sebuah catatan perjalanan tentang", "Cerita yang berpusat pada",
] as const;
export const bookDescriptionSubjects = [
    "seorang guru honorer di pinggir kota", "keluarga yang bertahan setelah banjir besar", "persahabatan tiga anak kampung",
    "kebiasaan membaca di rumah", "kenangan masa kecil di pelabuhan", "perempuan yang membuka taman baca",
    "pemuda yang pulang ke desa", "hubungan ibu dan anak", "sejarah sebuah pasar tua", "cara merawat kesehatan mental",
] as const;
export const bookDescriptionClosers = [
    "Ditulis dengan bahasa yang sederhana.", "Cocok untuk diskusi kelompok baca.", "Dilengkapi catatan penulis di akhir buku.",
    "Ringan, tetapi meninggalkan banyak pertanyaan.", "Banyak dipakai dalam kelas literasi.",
] as const;

/** Typed meeting points for owners outside the mapped area (generic, no named venue). */
export const typedMeetingPoints = ["Depan perpustakaan kota", "Lobi kampus", "Taman kota", "Stasiun terdekat", "Kafe dekat alun-alun"] as const;
export const conditionNotes = ["Ada sedikit lipatan di sampul", "Halaman agak menguning", "Ada coretan pensil di beberapa halaman", "Sampul plastik masih terpasang", "Punggung buku agak longgar"] as const;
export const requestNotes = ["Untuk bahan diskusi klub baca minggu depan.", "Sudah lama mencari buku ini.", "Saya akan menjaganya dengan baik.", "Boleh ambil di akhir pekan?", "Untuk tugas kuliah.", "Anak saya ingin membacanya."] as const;
export const preferredTimes = ["Sabtu pagi", "Minggu sore", "Hari kerja setelah jam 5", "Jumat siang", "Fleksibel, kabari saja"] as const;
export const responseNotes = ["Maaf, bukunya sedang dibaca keluarga.", "Coba lagi bulan depan, ya.", "Titik temunya terlalu jauh untuk saya minggu ini."] as const;
export const disputeDetails = [
    "Sampul sobek dan beberapa halaman basah saat dikembalikan.",
    "Sudah lewat dua minggu dari tenggat dan peminjam belum membalas pesan.",
    "Peminjam menyatakan bukunya hilang saat pindah rumah.",
    "Ada perbedaan pendapat soal kondisi buku saat serah terima.",
] as const;
export const resolutionNotes = {
    RETURNED: ["Buku sudah diterima kembali oleh pemilik; kerusakan ringan.", "Kedua pihak mengonfirmasi buku telah dikembalikan."],
    LOST: ["Peminjam mengakui buku hilang; pemilik memutuskan tidak menawarkan salinan ini lagi.", "Buku tidak dapat ditemukan setelah pengecekan."],
} as const;
export const extensionNotes = ["Masih separuh jalan membacanya.", "Ada ujian minggu ini, belum sempat selesai.", null] as const;

export type CommunityKind = { key: string; prefixes: readonly string[]; interests: readonly string[]; blurb: string };

/** The community kinds of the brief; interests are site genre labels (src/features/books/genres.ts). */
export const communityKinds: readonly CommunityKind[] = [
    { key: "mahasiswa", prefixes: ["Klub Baca", "Lingkar Buku"], interests: ["Fiksi Sastra", "Filsafat", "Isu Sosial", "Sejarah"], blurb: "Klub membaca mahasiswa yang bertemu setiap pekan untuk membahas satu buku." },
    { key: "sekolah", prefixes: ["Gerakan Literasi", "Pojok Baca"], interests: ["Anak & Remaja", "Pendidikan", "Persahabatan"], blurb: "Komunitas literasi sekolah yang menghidupkan pojok baca dan kunjungan perpustakaan." },
    { key: "perpustakaan", prefixes: ["Sahabat Perpustakaan", "Teman Pustaka"], interests: ["Sejarah", "Nonfiksi", "Sastra Indonesia"], blurb: "Relawan yang membantu kegiatan perpustakaan umum di sekitar mereka." },
    { key: "diskusi", prefixes: ["Forum Diskusi Buku", "Kopi dan Buku"], interests: ["Fiksi Sastra", "Sastra Indonesia", "Fiksi Sejarah", "Filsafat"], blurb: "Klub diskusi buku santai dengan tema bacaan berganti setiap bulan." },
    { key: "penulis", prefixes: ["Kelas Menulis", "Rumah Pena"], interests: ["Puisi", "Fiksi Sastra", "Biografi"], blurb: "Komunitas penulis pemula yang saling membaca dan memberi masukan naskah." },
    { key: "tukar", prefixes: ["Tukar Buku", "Rak Berjalan"], interests: ["Fiksi Sastra", "Romansa", "Komik & Novel Grafis", "Nonfiksi"], blurb: "Komunitas pertukaran buku: bawa satu, pulang membawa satu." },
    { key: "anak", prefixes: ["Dongeng", "Taman Baca Anak"], interests: ["Anak & Remaja", "Keluarga", "Pendidikan"], blurb: "Kegiatan membaca nyaring dan dongeng untuk anak-anak di lingkungan sekitar." },
    { key: "digital", prefixes: ["Literasi Digital", "Melek Media"], interests: ["Pendidikan", "Nonfiksi", "Isu Sosial"], blurb: "Kelas literasi digital: memilah informasi, membaca kritis, dan menulis di internet." },
    { key: "ruang-publik", prefixes: ["Baca di Taman", "Lapak Baca"], interests: ["Fiksi Sastra", "Anak & Remaja", "Agama & Spiritualitas", "Kesehatan Mental"], blurb: "Lapak baca gratis di taman dan ruang publik setiap akhir pekan." },
];
export const communityNameWords = ["Senja", "Pelita", "Kenari", "Rintik", "Akar", "Lentera", "Teduh", "Cakrawala", "Rimba", "Purnama", "Serambi", "Bianglala", "Pagi", "Embun", "Kemuning", "Sauh"] as const;

export const evidenceNotes = ["Dokumentasi kegiatan tiga bulan terakhir.", "Surat keterangan dari pengelola tempat kegiatan.", "Tautan ke arsip kegiatan dan daftar pengurus.", null] as const;
export const reviewNotes = {
    APPROVED: ["Bukti kegiatan lengkap.", "Kegiatan rutin terdokumentasi dengan baik.", null],
    REJECTED: ["Bukti kegiatan belum menunjukkan kegiatan rutin.", "Tautan bukti tidak dapat dibuka.", "Profil belum menjelaskan kegiatan komunitas."],
    REVOKED: ["Beberapa laporan valid tentang permintaan biaya di luar platform.", "Komunitas memakai nama komunitas lain tanpa izin.", "Acara berulang kali tidak berlangsung sesuai jadwal."],
} as const;

export type EventKind = { key: string; online: boolean; title: (subject: string) => string; description: string };
export const eventKinds: readonly EventKind[] = [
    { key: "diskusi", online: false, title: (s) => `Diskusi Buku: ${s}`, description: "Membahas buku pilihan bulan ini. Baca minimal separuh buku sebelum datang." },
    { key: "bedah", online: false, title: (s) => `Bedah Buku ${s}`, description: "Bedah buku bersama pembaca dan fasilitator komunitas." },
    { key: "baca-bersama", online: false, title: () => "Baca Bareng Akhir Pekan", description: "Membaca bersama dalam diam selama satu jam, lalu berbagi kesan." },
    { key: "workshop", online: false, title: () => "Workshop Menulis Cerpen", description: "Latihan menulis cerpen pendek dengan umpan balik dari peserta lain." },
    { key: "pertemuan", online: false, title: () => "Pertemuan Rutin Anggota", description: "Rapat bulanan anggota untuk menyusun agenda kegiatan berikutnya." },
    { key: "tukar", online: false, title: () => "Tukar Buku Bulanan", description: "Bawa buku layak baca untuk ditukar dengan buku dari peserta lain." },
    { key: "donasi", online: false, title: () => "Pengumpulan Donasi Buku", description: "Mengumpulkan buku layak baca untuk taman baca yang membutuhkan." },
    { key: "daring", online: true, title: (s) => `Diskusi Daring: ${s}`, description: "Diskusi lewat panggilan video; tautan dibagikan di halaman ini." },
    { key: "kelas-daring", online: true, title: () => "Kelas Literasi Digital (Daring)", description: "Belajar memeriksa informasi dan sumber berita bersama." },
];

export type MerchTemplate = { category: string; titles: readonly string[]; price: readonly [number, number]; variants: readonly string[][] };
/** Categories are the app's `merchandiseCategories`; prices in rupiah. */
export const merchTemplates: readonly MerchTemplate[] = [
    { category: "Tote Bag", titles: ["Tote Bag", "Tote Bag Kanvas", "Tas Belanja Lipat"], price: [45_000, 120_000], variants: [[], ["Krem", "Hitam"], ["Natural", "Hijau Tua", "Biru"]] },
    { category: "Aksesori Koleksi", titles: ["Pembatas Buku", "Stiker Literasi", "Gantungan Kunci", "Pin Enamel"], price: [8_000, 40_000], variants: [[], ["Set isi 3", "Set isi 5"], ["Desain A", "Desain B", "Desain C"]] },
    { category: "Rilisan Cetak", titles: ["Zine Edisi", "Notebook", "Antologi Cerpen Anggota", "Kalender Literasi"], price: [25_000, 150_000], variants: [[], ["Bergaris", "Polos"], ["A5", "A6"]] },
    { category: "Pakaian", titles: ["Kaos Komunitas", "Kaos \"Satu Buku Sehari\"", "Hoodie Komunitas"], price: [85_000, 220_000], variants: [["S", "M", "L", "XL"], ["M", "L", "XL", "XXL"], ["S", "M", "L"]] },
    { category: "Lainnya", titles: ["Paket Merchandise Acara", "Lampu Baca Jepit", "Sampul Buku Kain"], price: [15_000, 100_000], variants: [[], ["Paket Kecil", "Paket Lengkap"]] },
];
export const stockNotes = ["Stok terbatas", "Pre-order, siap 2 minggu", "Dicetak ulang setiap bulan", null, null] as const;
export const fulfillmentNotes = ["Ambil saat acara komunitas", "Kirim lewat ekspedisi, ongkir ditanggung pembeli", "Ambil di titik temu komunitas", null] as const;

export const reportDetails = [
    "Informasinya tidak sama dengan yang saya temui di lokasi.",
    "Pemilik meminta transfer uang jaminan di luar aplikasi.",
    "Deskripsinya memuat kata-kata kasar.",
    "Acara ini tidak berlangsung, tetapi masih tampil.",
    null,
    null,
] as const;
export const reportOutcomes = {
    RESOLVED: ["Konten sudah diperbaiki oleh pemilik.", "Listing disembunyikan sampai informasinya diperbarui.", "Peringatan diberikan kepada akun terkait."],
    REJECTED: ["Tidak ditemukan pelanggaran.", "Laporan duplikat.", "Informasi sudah sesuai."],
} as const;
export const hideReasons = ["Informasi buku tidak sesuai dengan salinan", "Foto dan deskripsi menyesatkan", "Pemilik meminta biaya di luar platform", "Laporan berulang dari peminjam"] as const;
export const appealReasons = ["Informasi sudah diperbaiki", "Salah paham dengan peminjam", "Listing tidak melanggar aturan"] as const;
export const appealDetails = ["Saya sudah memperbarui kondisi buku dan titik temu sesuai keadaan sebenarnya.", "Peminjam sudah menerima penjelasan dan masalahnya selesai.", "Biaya yang dimaksud adalah ongkos fotokopi yang diminta peminjam sendiri."] as const;
export const appealReviewNotes = {
    APPROVED: ["Perbaikan sudah sesuai; listing ditampilkan lagi.", "Penjelasan pemilik dapat diterima."],
    REJECTED: ["Informasi listing masih belum sesuai.", "Bukti belum cukup untuk menampilkan listing lagi."],
} as const;
export const suspensionReasons = ["Meminta uang jaminan di luar platform berulang kali", "Bahasa kasar kepada peminjam", "Memakai identitas orang lain"] as const;
