# Sistem Penerimaan Murid Baru SMAN 2 Ngawi

Portal PPDB berbasis **Node.js native** dengan dukungan Supabase untuk database dan storage dokumen. Cocok untuk dipush ke GitHub, dijalankan di laptop, VPS, atau hosting Node.js lain.

Secara default data berjalan di file lokal `db/data.json`. Untuk hosting permanen, aplikasi bisa langsung memakai Supabase sebagai database dan storage dokumen.

## Fitur

- Landing page PPDB dengan UI modern dan responsif.
- Menu: Beranda, Alur, Jadwal, Persyaratan, Program, Daftar Sekarang, Cek Status, Peringkat, Admin, Kontak.
- Form pendaftaran calon murid baru.
- Nomor pendaftaran otomatis.
- Data tersimpan di `db/data.json` saat lokal atau Supabase saat hosting produksi.
- Upload dokumen pendaftaran tersimpan di folder lokal atau Supabase Storage.
- Cek status memakai nomor pendaftaran atau NISN.
- Bukti pendaftaran dapat dibuka dan dicetak dari nomor pendaftaran.
- Peringkat nilai otomatis berdasarkan rumus:
  - **Nilai akhir = 60% nilai tes + 40% nilai rapor**
- Filter dan pencarian ranking.
- Panel admin berbasis username, password, dan token sesi untuk update nilai tes, status seleksi, catatan, ekspor CSV, dan reset data.
- API backend siap disambungkan ke frontend lain dan sudah mendukung Supabase.

## Cara Menjalankan

Pastikan Node.js sudah terpasang, minimal versi 18.

```bash
cd ppdb-sman2-ngawi
npm start
```

Buka browser:

```text
http://localhost:3000
```

Kredensial admin default:

```text
Username: admin
Password: adminppdb
```

Anda bisa mengganti kredensial admin melalui environment variable:

```bash
ADMIN_USERNAME=operator ADMIN_PASSWORD=passwordRahasia ADMIN_SESSION_SECRET=teksRahasiaPanjang npm start
```

Pada Windows PowerShell:

```powershell
$env:ADMIN_USERNAME="operator"; $env:ADMIN_PASSWORD="passwordRahasia"; $env:ADMIN_SESSION_SECRET="teksRahasiaPanjang"; npm start
```

Server juga otomatis membaca file `.env` lokal jika tersedia.

## Database Supabase

Mode lokal tidak membutuhkan database eksternal. Untuk hosting permanen, gunakan Supabase:

1. Buat project baru di Supabase.
2. Buka **SQL Editor** lalu jalankan isi file `supabase/schema.sql`.
3. Buka **Project Settings > API** dan salin `Project URL` serta `service_role key`.
4. Isi environment variable berikut di hosting:

```text
SUPABASE_URL=https://project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service_role_key_dari_supabase
SUPABASE_STORAGE_BUCKET=ppdb-documents
```

Migrasi data awal dari `db/data.json` ke Supabase:

```bash
npm run migrate:supabase
```

Jika Supabase sudah berisi data dan Anda memang ingin merge/upsert data lokal:

```bash
node scripts/migrate-local-data-to-supabase.js --force
```

Jika variable Supabase tidak diisi, server otomatis kembali memakai `db/data.json` dan folder `uploads/`.

## Deploy ke Vercel

Repository ini sudah disiapkan untuk Vercel melalui `vercel.json` dan serverless function `api/index.js`.

1. Import repository GitHub ini di Vercel.
2. Pilih framework **Other** jika Vercel meminta framework.
3. Kosongkan build command jika tidak diperlukan.
4. Isi environment variable berikut di Vercel Project Settings:

```text
SUPABASE_URL=https://project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service_role_key_dari_supabase
SUPABASE_STORAGE_BUCKET=ppdb-documents
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password_admin_anda
ADMIN_SESSION_SECRET=teks_rahasia_panjang
ADMIN_SESSION_TTL_MS=28800000
SCHOOL_NAME=SMAN 2 NGAWI
REGISTRATION_YEAR=2026
```

Catatan: untuk deployment Vercel, gunakan Supabase sebagai database dan storage. Jangan mengandalkan `db/data.json` atau folder `uploads` untuk data produksi.

## Menyambungkan ke Tunnel

### LocalTunnel

```bash
npx localtunnel --port 3000 --subdomain ppdb-sman2-ngawi
```

### Ngrok

```bash
ngrok http 3000
```

### Cloudflare Tunnel

```bash
cloudflared tunnel --url http://localhost:3000
```

## Push ke GitHub

```bash
git init
git add .
git commit -m "Initial PPDB SMAN 2 Ngawi dynamic website"
git branch -M main
git remote add origin https://github.com/username/ppdb-sman2-ngawi.git
git push -u origin main
```

## Struktur Folder

```text
ppdb-sman2-ngawi/
server.js
package.json
README.md
api/
  [...path].js
  index.js
  vercel-handler.js
db/
  data.json
public/
  index.html
  styles.css
  app.js
scripts/
  migrate-local-data-to-supabase.js
supabase/
  schema.sql
vercel.json
```

## API Utama

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/health` | Cek server aktif |
| POST | `/api/register` | Menyimpan pendaftaran baru |
| GET | `/api/ranking` | Mengambil ranking peserta |
| GET | `/api/status/:keyword` | Cek status dari nomor daftar atau NISN |
| GET | `/bukti/:registrationNumber` | Bukti pendaftaran siap cetak |
| POST | `/api/admin/login` | Login admin dan membuat token sesi |
| GET | `/api/admin/me` | Cek sesi admin aktif |
| GET | `/api/admin/applicants` | Data admin semua pendaftar |
| GET | `/api/admin/applicants/:registrationNumber/documents/:documentKey` | Unduh dokumen pendaftar |
| PATCH | `/api/admin/applicants/:registrationNumber` | Update nilai/status/catatan |
| GET | `/api/admin/export` | Ekspor CSV |
| POST | `/api/admin/reset` | Reset ke data contoh |

Endpoint admin membutuhkan header:

```text
Authorization: Bearer token_dari_api_admin_login
```

## Catatan Produksi

Versi ini sudah mendukung database dan storage Supabase. Untuk dipakai resmi oleh sekolah, sebaiknya tetap ditambahkan:

- Role admin/operator/verifikator.
- Audit log perubahan data.
- HTTPS dan backup database.
- Proteksi rate limit dan validasi NISN lebih ketat.
