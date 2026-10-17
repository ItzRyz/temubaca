# Template email Supabase Auth

Template ini mengirim kode OTP 6 digit (`{{ .Token }}`) yang dimasukkan di `/verify-email`. Supabase tidak membaca folder ini secara otomatis; salin isinya ke dashboard.

| Dashboard: Authentication → Email Templates | Subject | Isi (Source) |
| --- | --- | --- |
| Confirm signup | `Kode verifikasi akun TemuBaca: {{ .Token }}` | `confirm-signup.html` |
| Reset Password | `Kode atur ulang kata sandi TemuBaca: {{ .Token }}` | `reset-password.html` |

Pengaturan lain di dashboard:

- Authentication → Providers → Email: **Email OTP Length = 6** (aplikasi hanya menerima 6 digit angka).
- Batas kirim ulang di aplikasi 60 detik, mengikuti jeda minimum email Supabase. Jika jeda itu diubah, sesuaikan `OTP_RESEND_COOLDOWN_SECONDS` di `src/lib/validation/schemas/auth.schema.ts`.

Template sengaja tidak memuat `{{ .ConfirmationURL }}`. Tautan lama yang sudah terkirim tetap ditangani `/auth/callback`.
