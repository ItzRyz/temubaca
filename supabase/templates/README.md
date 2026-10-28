# Template email Supabase Auth

Semua template mengirim kode OTP 6 digit (`{{ .Token }}`), bukan tautan. Supabase tidak membaca folder ini secara otomatis; salin isinya ke dashboard (Authentication → Email Templates).

| Template di dashboard | Subject | File | Dipakai aplikasi? |
| --- | --- | --- | --- |
| Confirm signup | `Kode verifikasi TemuBaca: {{ .Token }}` | `confirm-signup.html` | Ya, `/verify-email` |
| Reset Password | `Kode atur ulang kata sandi TemuBaca: {{ .Token }}` | `reset-password.html` | Ya, `/verify-email` → `/update-password` |
| Magic Link | `Kode masuk TemuBaca: {{ .Token }}` | `magic-link.html` | Belum, aplikasi belum punya masuk tanpa kata sandi |
| Invite user | `Kode undangan TemuBaca: {{ .Token }}` | `invite-user.html` | Belum, belum ada alur undangan |
| Change Email Address | `Kode konfirmasi email baru TemuBaca: {{ .Token }}` | `change-email.html` | Belum, belum ada fitur ganti email |
| Reauthentication | `Kode konfirmasi identitas TemuBaca: {{ .Token }}` | `reauthentication.html` | Belum |

Template yang belum dipakai tetap dipasang supaya email bawaan Supabase (berbahasa Inggris, berisi tautan) tidak pernah terkirim. Fitur yang memakainya perlu halaman input kode sendiri (`verifyOtp` dengan type `magiclink`, `invite`, `email_change`, atau `reauthenticate`).

## Salin kode

Klien email (Gmail, Outlook, Apple Mail) memblokir JavaScript, jadi tombol salin otomatis tidak bisa dibuat. Kode diberi `user-select: all`: satu ketukan atau tekan lama memilih seluruh kode, lalu pengguna memilih **Salin**. Gmail dan iOS juga sering menawarkan salin otomatis untuk kode OTP.

## Pengaturan lain

- Authentication → Providers → Email: **Email OTP Length = 6** (aplikasi hanya menerima 6 digit angka).
- Batas kirim ulang di aplikasi 60 detik, mengikuti jeda minimum email Supabase. Jika jeda itu diubah, sesuaikan `OTP_RESEND_COOLDOWN_SECONDS` di `src/lib/validation/schemas/auth.schema.ts`.
- Template sengaja tidak memuat `{{ .ConfirmationURL }}`. Tautan lama yang sudah terkirim tetap ditangani `/auth/callback`.

## Isi email autentikasi (28 Okt 2026)

Mengikuti [panduan Supabase](https://supabase.com/docs/guides/auth/auth-smtp) agar tidak dianggap email promosi:

- Tanpa data dari pengguna: alamat email (`{{ .Email }}`, `{{ .NewEmail }}`) tidak dicantumkan di badan email.
- Tanpa tagline, tautan, gambar, atau ajakan lain; isinya hanya kode dan petunjuk singkat.
- Subjek pendek dan berisi kode.
- Ubah template jarang dan sekaligus. Setelah mengubah berkas di sini, salin ke dashboard (Authentication → Email Templates) dalam satu kali.

## Pengiriman (Resend) dan anti-spam

Production mengirim lewat SMTP Resend dengan domain terverifikasi **`mail.finsight.space`** (DNS di Cloudflare).

| Catatan DNS | Nilai | Status 28 Okt 2026 |
| --- | --- | --- |
| DKIM `resend._domainkey.mail.finsight.space` (TXT) | kunci dari Resend | ada |
| SPF `send.mail.finsight.space` (TXT) | `v=spf1 include:amazonses.com ~all` | ada |
| MX `send.mail.finsight.space` | `10 feedback-smtp.ap-northeast-1.amazonses.com` | ada |
| **DMARC `_dmarc.mail.finsight.space` (TXT)** | `v=DMARC1; p=none; rua=mailto:<alamat pemilik>; adkim=r; aspf=r` | **belum ada** |

Daftar periksa:

1. **Cloudflare → DNS:** tambah catatan DMARC di atas (TXT, nama `_dmarc.mail`). Gmail dan Yahoo mewajibkan DMARC; tanpa DMARC email mudah masuk spam walau SPF dan DKIM lolos. Setelah 1–2 minggu laporan `rua` bersih, ubah `p=none` menjadi `p=quarantine`. Catatan DKIM, SPF, dan MX yang ada jangan diubah.
2. **Resend → Domains → `mail.finsight.space`:** status *Verified*; matikan **Click tracking** dan **Open tracking**.
3. **Supabase → Authentication → Emails → SMTP Settings:**
   - Sender email `no-reply@mail.finsight.space` (harus di domain terverifikasi).
   - Sender name `TemuBaca`.
   - Host `smtp.resend.com`, port `465` (atau `587`), username `resend`, dan password berupa API key Resend.
4. **Supabase → Authentication → Email Templates:** salin isi dan subjek keenam template dari folder ini.
5. **Supabase → Authentication → Rate Limits:** batas email per jam disesuaikan dengan kebutuhan. Hindari lonjakan mendadak, karena reputasi domain baru masih dibangun.
6. **Jangka menengah:** domain khusus TemuBaca (mis. `mail.temubaca.id`) menghilangkan ketidakcocokan nama pengirim "TemuBaca" dengan domain `finsight.space` (DEC-01).

Cara memeriksa:

- **DNS:** `https://dns.google/resolve?name=_dmarc.mail.finsight.space&type=TXT`.
- **Skor:** daftar akun dengan alamat dari [mail-tester.com](https://www.mail-tester.com), lalu buka hasilnya. Targetnya ≥ 9/10.
- **Gmail:** buka email → ⋮ → *Tampilkan asli*. Harus terlihat `SPF: PASS`, `DKIM: PASS`, dan `DMARC: PASS`.
