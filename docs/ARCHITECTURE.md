# Arsitektur TemuBaca

**Status:** rancangan kerja yang diselaraskan dengan repo pada 2026-10-09. Struktur rute yang dituju mengikuti keputusan struktur final; implementasi domain dikembangkan bertahap.

## Batas aplikasi

- `src/app/` menangani App Router, layout, halaman, dan HTTP Route Handlers. Route groups mengelompokkan UI tanpa menambah segmen URL.
- `src/features/<domain>/` menampung komponen, aksi, dan logika aplikasi khusus domain. UI bersama tetap berada di `src/components/ui/`.
- `src/lib/` menampung infrastruktur lintas fitur: auth, Supabase, API, Drizzle, validasi, permission, integrasi eksternal, rate limit, logging, dan utilitas.
- `src/config/` menyimpan konfigurasi aplikasi yang aman dibagikan; rahasia hanya berasal dari environment server.
- `drizzle/migrations/` adalah output migrasi yang dapat ditinjau. Skema TypeScript sumber berada di `src/lib/db/schema.ts`.
- `docs/` memuat kebutuhan produk, keputusan, kontrak, keamanan, dan catatan pengujian.

## Alur permintaan

```text
Browser
  → App Router page atau Route Handler
  → validasi Zod dan autentikasi/otorisasi server
  → query/repository Drizzle
  → PostgreSQL
```

Komponen client mengirim perubahan melalui Server Action atau API yang memeriksa sesi dan kepemilikan. Jangan memindahkan rahasia, keputusan otorisasi, atau akses database ke Client Component.

## Struktur domain saat ini

```text
src/features/
├── auth/             # Server actions dan komponen auth
├── books/            # Komponen katalog buku
├── bookmarks/        # Tombol simpan buku
├── book-listings/    # Form penawaran dan kontrol listing
├── profile/          # Pengaturan profil dasar
├── recommendations/  # Minat dan rekomendasi baseline buku
└── reports/          # Pelaporan buku/listing dan tinjauan admin
```

Query database tetap di `src/lib/db/queries/`; Route Handlers mengorkestrasi validasi, izin, rate limit, dan query. Pindahkan logika domain keluar dari komponen ketika aturan bisnis mulai dipakai lintas route.

## Rute yang sudah berjalan

Route group saat ini memuat beranda, Tentang, dan katalog buku di `(public)`, auth di `(auth)`, dashboard dan halaman privat di `(app)`, serta tinjauan laporan admin di `(management)`. Rute kanonis juga mencakup `/settings` dan `/recommendations`; `/auth` serta `/profile/bookmarks` dan `/profile/listings` dipertahankan untuk kompatibilitas. Callback lama `/auth/callback` tetap berjalan; alias `/callback` tersedia tanpa mengharuskan perubahan konfigurasi Supabase. Halaman komunitas, perpustakaan, dan acara belum diaktifkan karena definisi visibilitas, verifikasi, dan sumber ketersediaan masih menunggu keputusan.

## Keputusan integrasi

- Supabase Auth dan PostgreSQL/Drizzle sudah digunakan di kode; hosting dan sumber database produksi belum ditetapkan.
- Query runtime menggunakan driver Drizzle `node-postgres`; `DATABASE_URL` dipakai aplikasi dan Drizzle Kit memilih `DIRECT_URL` untuk migrasi bila tersedia.
- Upstash Redis dipakai oleh rate-limit provider. Endpoint rate limited memerlukan kredensial Upstash.
- Katalog eksternal memiliki interface netral provider, tetapi provider belum dipilih (`DEC-06`).
- Storage gambar, peta, rekomendasi, dan deployment belum diaktifkan atau diputuskan. Jangan menambah provider sebelum keputusan dicatat.
- Checkout/payment tetap di luar implementasi sampai `DEC-03` disetujui.

Lihat [DECISIONS.md](DECISIONS.md), [DATABASE.md](DATABASE.md), dan [SECURITY.md](SECURITY.md) untuk batas keputusan dan data.
