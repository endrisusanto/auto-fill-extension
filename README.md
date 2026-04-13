# auto-fill-extension

Browser extension untuk mengotomatiskan pengisian formulir pada platform **Samsung Build Approval Server (BAS)**. Dirancang untuk meningkatkan produktivitas, mengurangi kesalahan manusia (*human error*), dan memberikan pengalaman "One-Click Submission".

## 🚀 Fitur Utama
- **Multi-Form Support**: Mendukung pengisian otomatis untuk halaman **SMR**, **Normal**, dan **SKU**.
- **Smart Data Filling**: Mengisi Submitter Name, PL Email, CSC Type (MainCSC), QuickBuildPath, dan SCAT URL secara instan.
- **Dynamic Selects**: Otomatis memilih Carrier (XID) dan Country (Indonesia) pada komponen Angular khusus.
- **Intelligent Email List**: Menambahkan daftar email notifikasi secara otomatis dan menghapus duplikasi email yang sudah ada.
- **Glassmorphism UI**: Tombol overlay transparan di tengah layar untuk akses cepat, yang akan meminimalkan diri ke pojok kanan bawah setelah digunakan.
- **Cross-Browser Compatibility**: Bekerja di Firefox, Google Chrome, dan Microsoft Edge.

## 🛠️ Instalasi

### Firefox
1. Buka Firefox dan akses `about:debugging`.
2. Klik **"This Firefox"**.
3. Klik **"Load Temporary Add-on..."**.
4. Pilih file `manifest.json` di dalam folder ini.

### Chrome / Edge (Chromium)
1. Akses `chrome://extensions` atau `edge://extensions`.
2. Aktifkan **"Developer mode"**.
3. Klik **"Load unpacked"**.
4. Pilih folder `auto-fill-extension` ini secara utuh.

## 📖 Cara Penggunaan
1. Buka laman [Build Approval System](https://buildapprovalsystem.com).
2. Navigasi ke menu formulir (SMR, Normal, atau SKU).
3. Klik tombol besar **"⚡ AUTO FILL"** yang muncul di tengah layar.
4. Verifikasi data yang terisi, lalu lanjutkan proses *submission* Anda.

## 📊 Analisis Dampak (Impact Analysis)
Dokumen analisis manfaat bisnis (ROI, produktivitas, dan penghematan biaya) dapat ditemukan di:
`impact_analysis.md`

## ⚖️ Lisensi
Dibuat untuk kebutuhan internal tim Submitter Samsung.

---
**Peringatan**: Selalu periksa kembali data yang diisi otomatis sebelum melakukan klik "Submit" final untuk memastikan kesesuaian dengan task yang sedang dikerjakan.
