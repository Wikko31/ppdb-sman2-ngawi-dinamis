# Sistem Penerimaan Murid Baru SMAN 2 Ngawi - Web Dinamis

Website PPDB dinamis berbasis **Node.js native** tanpa dependency tambahan. Cocok untuk dipush ke GitHub, dijalankan di laptop, VPS, atau disambungkan ke tunnel seperti LocalTunnel, Cloudflare Tunnel, atau Ngrok.

Secara default data berjalan di file lokal `db/data.json`. Untuk hosting permanen, aplikasi bisa langsung memakai Supabase sebagai database dan storage dokumen.

## Fitur

- Landing page PPDB dengan UI modern dan responsif.
- Menu: Beranda, Alur, Jadwal, Persyaratan, Program, Daftar Sekarang, Cek Status, Peringkat, Admin, Kontak.
- Form pendaftaran calon murid baru.
- Nomor pendaftaran otomatis.
- Data tersimpan dinamis di `db/data.json` atau Supabase.
- Upload dokumen pendaftaran tersimpan di folder lokal atau Supabase Storage.
- Cek status memakai nomor pendaftaran atau NISN.
- Peringkat nilai otomatis berdasarkan rumus:
  - **Nilai akhir = 60% nilai tes + 40% nilai rapor**
- Filter dan pencarian ranking.
- Panel admin demo untuk update nilai tes, status seleksi, catatan, ekspor CSV, dan reset data.
- API backend siap disambungkan ke frontend lain dan sudah mendukung Supabase.

## Cara Menjalankan

Pastikan Node.js sudah terpasang, minimal versi 18.

```bash
cd ppdb-sman2-ngawi-dinamis
npm start
```

Buka browser:

```text
http://localhost:3000
```

Password admin demo:

```text
adminppdb
```

Anda bisa mengganti password admin melalui environment variable:

```bash
ADMIN_PASSWORD=passwordRahasia npm start
```

Pada Windows PowerShell:

```powershell
$env:ADMIN_PASSWORD="passwordRahasia"; npm start
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

Jika variable Supabase tidak diisi, server otomatis kembali memakai `db/data.json` dan folder `uploads/`.

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
ppdb-sman2-ngawi-dinamis/
server.js
package.json
README.md
db/
  data.json
public/
  index.html
  styles.css
  app.js
supabase/
  schema.sql
```

## API Utama

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/health` | Cek server aktif |
| POST | `/api/register` | Menyimpan pendaftaran baru |
| GET | `/api/ranking` | Mengambil ranking peserta |
| GET | `/api/status/:keyword` | Cek status dari nomor daftar atau NISN |
| GET | `/api/admin/applicants` | Data admin semua pendaftar |
| GET | `/api/admin/applicants/:registrationNumber/documents/:documentKey` | Unduh dokumen pendaftar |
| PATCH | `/api/admin/applicants/:registrationNumber` | Update nilai/status/catatan |
| GET | `/api/admin/export` | Ekspor CSV |
| POST | `/api/admin/reset` | Reset ke data contoh |

Endpoint admin membutuhkan header:

```text
x-admin-password: adminppdb
```

## Catatan Produksi

Versi ini sudah mendukung database dan storage Supabase. Untuk dipakai resmi oleh sekolah, sebaiknya tetap ditambahkan:

- Login admin yang lebih aman dengan session/JWT.
- Role admin/operator/verifikator.
- Audit log perubahan data.
- HTTPS dan backup database.
- Proteksi rate limit dan validasi NISN lebih ketat.
