# Operasional TemuBaca (TB-043)

Panduan menjalankan dan memulihkan layanan production. Ditulis 26 Okt 2026. Langkah yang belum pernah diuji ditandai **belum diuji**.

## Layanan production

| Layanan | Isi | Paket | Akses |
|---|---|---|---|
| Vercel, proyek `temubaca` (tim `itzryzs-projects`) | Website Next.js, https://temubaca.vercel.app, deploy otomatis dari `master` | Hobby | Pemilik repo website |
| Supabase, proyek `tpwadnezwjgfrjtqdbkt` | Postgres 17 (14 MB pada 26 Okt 2026), Auth, Storage | Free | Pemilik repo website |
| FastAPI Cloud, app `temubaca-ml` (tim Al Farizi) | ML Service, https://temubaca-ml.fastapicloud.dev | Hobby | Pemilik akun ML |
| Upstash Redis | Rate limit | Gratis | Pemilik repo website |

Secret ada di environment Vercel dan FastAPI Cloud, tidak pernah di repo. Daftar env website ada di `src/env.ts`; ML memakai `INTERNAL_TOKEN` dan `ROUTING_GRAPHS`.

## Logging

Aturan umum: log hanya berisi metadata. Token, isi request, email, minat pengguna, kode wilayah, dan koordinat tidak pernah dicatat.

| Sumber | Yang dicatat | Tempat melihat |
|---|---|---|
| Website `[API_ERROR]` (`src/lib/logging`) | Method, path, dan nama error; tanpa pesan, stack, atau payload | Vercel → Logs |
| Website `[ML_SERVICE_ERROR]` | Jenis kegagalan (`timeout`, `unavailable`, ...) dan kode error ML; tanpa titik rute | Vercel → Logs |
| Website `[DATABASE_POOL_ERROR]` | Kegagalan pool koneksi | Vercel → Logs |
| ML `app.routing` | Moda, versi graf, status, latensi, jumlah node, cache hit | `fastapi cloud logs` |
| ML `app.recommendations` | Jumlah minat, minat tak dikenali, hasil, sumber, `notice`, versi model, latensi (ML-T08) | `fastapi cloud logs` |
| ML uvicorn | Path dan status setiap request | `fastapi cloud logs` |
| Supabase | Log Postgres, Auth, dan Storage | Dashboard Supabase → Logs |

Log FastAPI Cloud paket Hobby hanya bisa diambil sampai 1 hari ke belakang (`Cannot fetch logs older than 1 day`, 26 Okt 2026). Simpan potongan log yang dibutuhkan untuk insiden sebelum lewat sehari.

## Pemeriksaan rutin

Jalankan setelah setiap deploy, dan minimal sekali seminggu:

```bash
# Website dan peta
curl -s -o /dev/null -w "%{http_code}\n" https://temubaca.vercel.app/map
# ML Service: versi model, jumlah buku, dan kedua graf rute
curl -s https://temubaca-ml.fastapicloud.dev/health
# ML tanpa token harus 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://temubaca-ml.fastapicloud.dev/api/routing/route -H 'content-type: application/json' -d '{}'
```

Di SQL editor Supabase:

```sql
-- Cron retensi DEC-11 harus tercatat setiap hari (jadwal 19:00 UTC di vercel.json)
select max("createdAt") from admin_audit_logs where action = 'RETENTION_RUN';
```

Lalu buka Supabase → Advisors → Security. Pada 26 Okt 2026 hanya tersisa `auth_leaked_password_protection`, yang butuh paket Pro dan sengaja tidak diaktifkan.

## Backup

Paket Supabase Free tidak menyediakan backup harian yang bisa diunduh atau dipulihkan dari dashboard; backup harian otomatis hanya untuk Pro ke atas. Supabase menyarankan proyek Free mengekspor data sendiri secara rutin dengan `supabase db dump` dan menyimpannya di luar Supabase ([Database Backups](https://supabase.com/docs/guides/platform/backups)).

**Kapan:** setiap minggu, dan selalu sebelum menerapkan migrasi ke production.

**Caranya** (perlu Docker untuk Supabase CLI, dan `DIRECT_URL` production dari pemilik akun; jangan simpan URL ini di repo):

```bash
mkdir -p ~/temubaca-backup/$(date +%F) && cd ~/temubaca-backup/$(date +%F)
bunx supabase db dump --db-url "$DIRECT_URL" -f roles.sql --role-only
bunx supabase db dump --db-url "$DIRECT_URL" -f schema.sql
bunx supabase db dump --db-url "$DIRECT_URL" -f data.sql --use-copy --data-only
tar czf - roles.sql schema.sql data.sql | gpg --symmetric --cipher-algo AES256 -o temubaca-$(date +%F).tar.gz.gpg
rm roles.sql schema.sql data.sql
```

Langkah dump diuji 26 Okt 2026 pada stack lokal (`--local` menggantikan `--db-url`). Ketiga berkas berisi data `auth` (akun pengguna), `drizzle.__drizzle_migrations__`, semua tabel `public`, dan metadata Storage, dan jumlah baris `places` di dump sama dengan database. `pg_dump` memperingatkan foreign key melingkar pada dump data saja; langkah restore di bawah menanganinya dengan `session_replication_role = replica`.

Hal yang perlu diingat:

- **Data pribadi.** Dump berisi email dan data akun. Simpan hanya dalam bentuk terenkripsi, di luar folder repo, dan jangan pernah ke GitHub: kedua repo publik, jadi backup otomatis lewat GitHub Actions tidak dipakai.
- **Storage tidak ikut.** Dump hanya memuat metadata berkas. Pada 26 Okt 2026 production belum punya bucket maupun berkas (bucket `merchandise-photos` dan `community-evidence` dibuat otomatis saat unggahan pertama). Begitu ada berkas, unduh juga isi bucket dari dashboard Storage.
- **Password role.** Dump role tidak memuat password `temubaca_app`; setelah restore, buat ulang dengan `bun scripts/runtime-role.ts --cloud --vercel` lalu redeploy.
- **Data turunan.** Katalog buku dapat diimpor ulang (`bun run books:import`) dan titik Peta Literasi dari `scripts/data/places-osm.json` (`bun run places:import`), tetapi akun, listing, pinjaman, laporan, dan komunitas hanya ada di backup.

## Restore (belum diuji)

Restore memakai panduan resmi Supabase ke proyek baru yang kosong, bukan menimpa proyek berjalan. Belum pernah diuji karena belum ada proyek staging (TB-044); uji sekali begitu proyek itu ada.

```bash
gpg -d temubaca-YYYY-MM-DD.tar.gz.gpg | tar xzf -
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql --dbname "$NEW_DIRECT_URL"
```

Setelah itu: buat ulang password `temubaca_app`, perbarui `DATABASE_URL`/`DIRECT_URL` dan key Supabase di Vercel, redeploy, lalu jalankan pemeriksaan rutin di atas dan `bun run db:migrate:dev -- --cloud` (harus "No pending migrations").

## Rollback

- **Website.** Vercel → Deployments → Instant Rollback. Di paket Hobby, rollback hanya bisa ke deploy production tepat sebelumnya; bila yang sehat lebih lama, revert commit buruk di `master` dan push. Setelah rollback, revert juga commit buruknya supaya push berikutnya tidak membawanya kembali.
- **ML Service.** Deploy ulang commit sebelumnya dari salinan bersih (`git archive <commit>` ditambah `data/graphs/`), seperti di README ML bagian 10a. Jangan deploy dari folder repo: file yang tidak dilacak Git ikut terunggah.
- **Database.** Migrasi Drizzle hanya maju. Migrasi production sejauh ini hanya menambah tabel atau kolom, jadi rollback kode tetap jalan di atas skema baru. Bila migrasi harus dibatalkan, tulis SQL kebalikannya, jalankan di transaksi, lalu hapus barisnya dari `drizzle.__drizzle_migrations__`. Contoh untuk 0018:

```sql
begin;
alter table borrow_requests drop column "meetingPlaceId";
alter table book_listings drop column "meetingPlaceIds";
delete from drizzle."__drizzle_migrations__" where hash = '460f8fdc93bc546803575eaa786bfbcf997ac286695c5768f6050e15ca888b5c';
commit;
```

## Respons insiden

1. **Kenali.** Catat waktu, gejala, dan layanan yang terdampak. Ambil potongan log sebelum hilang (ML hanya 1 hari).
2. **Batasi.**
   - Konten berbahaya: sembunyikan lewat portal admin (listing, komunitas, tempat), dan tangguhkan akun bila perlu; semua tercatat di jejak audit.
   - Deploy rusak: rollback seperti di atas.
   - Secret bocor: rotasi segera sesuai `SECURITY.md` → Tindak lanjut kredensial, mulai dari secret yang bocor.
   - ML bermasalah: website tetap jalan tanpa ML (rekomendasi memakai baseline, rute menawarkan Google Maps). Kosongkan `RECOMMENDATION_API_URL` di Vercel bila ML perlu dimatikan sementara.
3. **Pulihkan.** Perbaiki, deploy, lalu jalankan pemeriksaan rutin.
4. **Kabari.** Bila data pengguna terdampak, beri tahu pengguna yang terdampak sesuai Kebijakan Privasi.
5. **Catat.** Tulis ringkasan di `docs/HANDOFF.md`: kronologi, penyebab, dampak, dan pencegahan.

Penanggung jawab: pemilik repo website untuk Vercel, Supabase, dan Upstash; pemilik akun ML untuk FastAPI Cloud.

## Email autentikasi

Kode verifikasi dan atur ulang kata sandi dikirim Supabase Auth lewat SMTP Resend, dari domain `mail.finsight.space`. Template, subjek, catatan DNS (DKIM, SPF, DMARC), dan daftar periksa anti-spam ada di [`supabase/templates/README.md`](../supabase/templates/README.md). Template di repo disalin manual ke dashboard Supabase; aplikasi tidak perlu dideploy ulang.
