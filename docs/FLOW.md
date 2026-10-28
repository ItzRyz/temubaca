# FLOW — Alur Produk

Status proses ini rancangan untuk ditinjau; transisi akhir pinjam menunggu DEC-02.

## Penemuan buku dan akses

```text
Pengunjung → Cari/browse → Hasil (atau kosong/gagal) → Detail buku
                                              ↓
                               Cara Membaca: perpustakaan / book sharing
                                  ↓                       ↓
                           Detail akses            Listing pemilik
                                  └───────── pilih akses ─┘
                                                  ↓
                                       Masuk → ajukan pinjam
                                                  ↓
                          Pemilik tinjau → tolak / terima sesuai aturan
                                                  ↓
                                  sepakati titik temu publik
                                                  ↓
                                      serah-terima → pengembalian
```

Data perpustakaan adalah informasi katalog kecuali ada integrasi stok terkonfirmasi. Cantumkan sumber dan waktu pemeriksaan.

## Daftar, login, dan pilih minat (28 Okt 2026)

```text
Daftar → kode OTP email → /minat (pilih ≥ 3 minat, kab/kota opsional) → beranda
Login → akun tanpa minat? → ya: /minat?next=<tujuan> → Simpan & Lanjut / Lewati dulu → tujuan
                          → tidak: tujuan
```

"Lewati dulu" tidak menyimpan apa pun, jadi halaman muncul lagi pada login berikutnya selama akun belum punya minat. Minat diubah kemudian di Bookmark & Minat.

## Komunitas, acara, merchandise

```text
Pengelola → Ajukan/kelola profil → Peninjauan manusia → Profil publik
                                            ↓
                                  Acara dan listing merchandise
                                            ↓
Pengunjung → Profil komunitas → Detail acara / katalog merchandise
                                            ↓
             Cara membeli mengikuti DEC-03 (katalog atau transaksi platform)
```

Jangan tampilkan tombol checkout jika transaksi in-app belum disetujui.

## Moderasi

Pengguna melaporkan konten → konfirmasi penerimaan → antrean pengelola → tinjau bukti → tindakan/alasan tercatat → tindak lanjut bila diperlukan.

## Rekomendasi

Preferensi/bookmark yang diizinkan → kandidat berdasarkan konten/minat/lokasi umum → alasan rekomendasi → pengguna membuka atau mengabaikan. Sediakan fallback ketika data sedikit; jangan menjadikan rekomendasi syarat untuk menemukan konten.
