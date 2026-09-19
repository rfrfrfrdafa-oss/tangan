#http://127.0.0.1:5500/

# AI RPS — Batu, Gunting, Kertas

Game web sederhana yang memakai **Teachable Machine Image + TensorFlow.js** untuk mengenali gerakan tangan dari webcam, lalu bermain Batu–Gunting–Kertas melawan pilihan AI acak.

link model:
https://teachablemachine.withgoogle.com/models/MhjafiE0H/
link advenced model:
https://teachablemachine.withgoogle.com/models/oeA8O6Guh/

## Struktur

```text
ai-rps-teachable-machine/
├── index.html
├── style.css
├── script.js
└── README.md
```

## 1. Buat model di Teachable Machine

Buat **Image Project** dengan 3 kelas:

- `Batu`
- `Gunting`
- `Kertas`

Latih tiap kelas menggunakan beberapa variasi posisi tangan, jarak, pencahayaan, dan latar. Setelah selesai, gunakan menu **Export Model → TensorFlow.js** lalu salin URL model.

Kode game memuat dua berkas dari URL tersebut:

```text
model.json
metadata.json
```

Teachable Machine memang menyediakan checkpoint model dalam bentuk URL dan library image-nya menyediakan `tmImage.load(modelURL, metadataURL)`. Library tersebut juga menyediakan `tmImage.Webcam`, termasuk `play()`, `update()`, dan `stop()`. [1]

## 2. Jalankan

Tidak diperlukan Node.js atau build tool.

Untuk uji lokal, disarankan menjalankan server sederhana supaya perilaku browser mendekati deployment HTTPS. Misalnya:

```bash
python -m http.server 8000
```

Kemudian buka `http://localhost:8000`.

Untuk deployment, project ini sengaja hanya memakai file statis sehingga cocok dengan GitHub Pages. GitHub Pages dapat menerbitkan file statis dari sebuah repository; `index.html` menjadi entry file. [2]

## 3. Deploy ke GitHub Pages

Push ke repository GitHub:

```bash
git init
git add .
git commit -m "Add AI RPS game"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

Di GitHub buka:

**Settings → Pages → Build and deployment → Source → Deploy from a branch**

Pilih branch `main` dan folder `/ (root)`, lalu **Save**. GitHub mendokumentasikan konfigurasi tersebut sebagai salah satu cara resmi menerbitkan situs Pages. [3]

## 4. Cara memakai game

1. Tempel URL model Teachable Machine pada kolom model.
2. Klik **Muat Model**.
3. Klik **Mulai Kamera** dan izinkan akses webcam.
4. Tunggu label `LIVE`.
5. Klik **Main Sekarang**.
6. Saat hitungan 3–2–1 selesai, tunjukkan Batu, Gunting, atau Kertas.
7. AI memilih gerakan secara acak dan hasil pertandingan dihitung otomatis.

URL model disimpan di `localStorage`, sehingga tidak perlu ditempel ulang pada browser yang sama.

## Catatan teknis

### Nama kelas

Game mengenali nama kelas yang mengandung salah satu dari:

- `batu` atau `rock`
- `gunting` atau `scissor`
- `kertas` atau `paper`

Nama Indonesia tersebut paling mudah digunakan.

### Confidence threshold

Di `script.js` terdapat:

```js
const CONFIDENCE_THRESHOLD = 0.60;
```

Nilai tersebut dipakai agar game tidak memutuskan gerakan ketika prediksi terlalu rendah. Game juga merata-ratakan beberapa frame terakhir agar hasil webcam lebih stabil.

### Webcam dan HTTPS

Akses webcam browser melalui Media Capture membutuhkan secure context; HTTPS adalah cara normal untuk deployment publik. GitHub Pages cocok untuk hal ini karena situs Pages diterbitkan sebagai situs web, sedangkan `getUserMedia()`/akses kamera mensyaratkan konteks aman dan izin pengguna. [4]

### CDN

Template memakai:

```html
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8.5/dist/teachablemachine-image.min.js"></script>
```

Versi TensorFlow.js 4.22.0 merupakan tag `latest` yang tercatat pada npm saat riset ini dibuat; paket `@teachablemachine/image` tercatat pada versi 0.8.5. [5][6]

## Sources

1. Google Creative Lab / Teachable Machine Community. *Teachable Machine Library — Image*. API dan contoh pemuatan `model.json`, `metadata.json`, webcam, serta prediksi. https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/image
2. GitHub Docs. *Creating a GitHub Pages site*. Entry file dan penerbitan situs statis. https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
3. GitHub Docs. *Configuring a publishing source for your GitHub Pages site*. Deploy from a branch dan folder root/docs. https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
4. MDN Web Docs. *MediaDevices: getUserMedia() method*. Secure context HTTPS dan izin pengguna untuk webcam. https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
5. npm. *@tensorflow/tfjs*. Version listing yang menunjukkan 4.22.0 sebagai `latest` saat riset. https://www.npmjs.com/package/@tensorflow/tfjs
6. npm. *@teachablemachine/image*. Version listing yang menunjukkan 0.8.5. https://www.npmjs.com/package/@teachablemachine/image
