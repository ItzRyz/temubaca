# Template email Supabase Auth

Semua template mengirim kode OTP 6 digit (`{{ .Token }}`), bukan tautan. Supabase tidak membaca folder ini secara otomatis; salin isinya ke dashboard (Authentication → Email Templates).

| Template di dashboard | Subject | File | Dipakai aplikasi? |
| --- | --- | --- | --- |
| Confirm signup | `Kode verifikasi akun TemuBaca: {{ .Token }}` | `confirm-signup.html` | Ya, `/verify-email` |
| Reset Password | `Kode atur ulang kata sandi TemuBaca: {{ .Token }}` | `reset-password.html` | Ya, `/verify-email` → `/update-password` |
| Magic Link | `Kode masuk TemuBaca: {{ .Token }}` | `magic-link.html` | Belum, aplikasi belum punya masuk tanpa kata sandi |
| Invite user | `Undangan bergabung ke TemuBaca: {{ .Token }}` | `invite-user.html` | Belum, belum ada alur undangan |
| Change Email Address | `Kode konfirmasi email baru TemuBaca: {{ .Token }}` | `change-email.html` | Belum, belum ada fitur ganti email |
| Reauthentication | `Kode konfirmasi identitas TemuBaca: {{ .Token }}` | `reauthentication.html` | Belum |

Template yang belum dipakai tetap dipasang supaya email bawaan Supabase (berbahasa Inggris, berisi tautan) tidak pernah terkirim. Fitur yang memakainya perlu halaman input kode sendiri (`verifyOtp` dengan type `magiclink`, `invite`, `email_change`, atau `reauthenticate`).

## Salin kode

Klien email (Gmail, Outlook, Apple Mail) memblokir JavaScript, jadi tombol salin otomatis tidak bisa dibuat. Kode diberi `user-select: all`: satu ketukan atau tekan lama memilih seluruh kode, lalu pengguna memilih **Salin**. Gmail dan iOS juga sering menawarkan salin otomatis untuk kode OTP.

## Pengaturan lain

- Authentication → Providers → Email: **Email OTP Length = 6** (aplikasi hanya menerima 6 digit angka).
- Batas kirim ulang di aplikasi 60 detik, mengikuti jeda minimum email Supabase. Jika jeda itu diubah, sesuaikan `OTP_RESEND_COOLDOWN_SECONDS` di `src/lib/validation/schemas/auth.schema.ts`.
- Template sengaja tidak memuat `{{ .ConfirmationURL }}`. Tautan lama yang sudah terkirim tetap ditangani `/auth/callback`.
