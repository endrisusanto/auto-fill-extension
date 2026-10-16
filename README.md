# auto-fill-extension

Ekstensi browser untuk mengotomatiskan pengisian formulir dan navigasi data pada portal Samsung Build Approval Server (BAS) serta Mobile R&D Hub.

## Fitur Utama

- **Preset Profil Form**: Simpan dan kelola beberapa profil input (misalnya Daily Build, Bug Fix, SKU Khusus) lewat popup ekstensi.
- **Dukungan Multi-Form**: Mengisi formulir otomatis pada halaman SMR, Normal, dan SKU (Submitter Name, PL Email, CSC Type, QuickBuildPath, dan SCAT URL).
- **Pemilihan Dropdown Otomatis**: Mendeteksi dan memilih Carrier serta Country pada komponen dropdown Angular Material dan NG-ZORRO.
- **Daftar Email Notifikasi**: Memasukkan daftar email notifikasi secara otomatis dan menyaring duplikasi email.
- **Otomasi Halaman Ongoing Submissions**: Memilih kategori filter Email dan ukuran pagination 20 baris secara otomatis saat membuka halaman `#/ongoing-submissions` atau `#/mysubmissions-submitter`.
- **Session Bridge**: Memantau dan menyinkronkan token sesi (cookie sid dan status verifikasi perangkat) antara Build Approval System dan Mobile R&D Hub.
- **Tombol Overlay Cepat**: Tombol auto-fill langsung di halaman form yang mengecil ke sudut layar setelah digunakan.
- **Kompatibilitas Browser**: Berjalan pada Chromium (Google Chrome, Microsoft Edge) dan Mozilla Firefox.

## Instalasi

### Chrome dan Microsoft Edge (Chromium)
1. Buka `chrome://extensions` atau `edge://extensions`.
2. Aktifkan opsi **Developer mode** di pojok kanan atas.
3. Klik tombol **Load unpacked**.
4. Pilih folder root `auto-fill-extension`.

### Firefox
1. Buka Firefox dan akses halaman `about:debugging`.
2. Pilih menu **This Firefox**.
3. Klik **Load Temporary Add-on...**.
4. Pilih file `manifest.json` di dalam folder ekstensi.

## Cara Penggunaan

1. Buka portal [Build Approval System](https://buildapprovalsystem.com).
2. Buka menu formulir yang diinginkan (SMR, Normal, atau SKU).
3. Klik tombol **AUTO FILL** yang tampil di halaman untuk mengisi formulir sesuai preset aktif.
4. Pada halaman Ongoing Submissions, filter kategori Email dan ukuran tabel 20 baris akan terpilih secara otomatis saat halaman selesai dimuat.
5. Periksa kembali seluruh data yang terisi sebelum menekan tombol Submit final.

## Analisis Dampak

Dokumentasi mengenai evaluasi produktivitas dan alur kerja manual yang diotomatiskan dapat dilihat pada file `impact_analysis.md`.

## Lisensi

Dibuat untuk kebutuhan operasional internal tim Submitter Samsung.
