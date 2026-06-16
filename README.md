# Sistem Penerimaan Murid Baru SMAN 2 Ngawi - Web Dinamis

Website PPDB dinamis berbasis **Node.js native** tanpa dependency tambahan. Cocok untuk dipush ke GitHub, dijalankan di laptop, VPS, atau disambungkan ke tunnel seperti LocalTunnel, Cloudflare Tunnel, atau Ngrok.

## Fitur

- Landing page PPDB dengan UI modern dan responsif.
- Menu: Beranda, Alur, Jadwal, Persyaratan, Program, Daftar Sekarang, Cek Status, Peringkat, Admin, Kontak.
- Form pendaftaran calon murid baru.
- Nomor pendaftaran otomatis.
- Data tersimpan dinamis di `db/data.json`.
- Cek status memakai nomor pendaftaran atau NISN.
- Peringkat nilai otomatis berdasarkan rumus:
  - **Nilai akhir = 60% nilai tes + 40% nilai rapor**
- Filter dan pencarian ranking.
- Panel admin demo untuk update nilai tes, status seleksi, catatan, ekspor CSV, dan reset data.
- API backend siap disambungkan ke frontend lain atau dikembangkan ke database sungguhan.

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
├── server.js
├── package.json
├── README.md
├── db/
│   └── data.json
└── public/
    ├── index.html
    ├── styles.css
    └── app.js
```

## API Utama

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/health` | Cek server aktif |
| POST | `/api/register` | Menyimpan pendaftaran baru |
| GET | `/api/ranking` | Mengambil ranking peserta |
| GET | `/api/status/:keyword` | Cek status dari nomor daftar atau NISN |
| GET | `/api/admin/applicants` | Data admin semua pendaftar |
| PATCH | `/api/admin/applicants/:registrationNumber` | Update nilai/status/catatan |
| GET | `/api/admin/export` | Ekspor CSV |
| POST | `/api/admin/reset` | Reset ke data contoh |

Endpoint admin membutuhkan header:

```text
x-admin-password: adminppdb
```

## Catatan Produksi

Versi ini sudah dinamis, tetapi masih cocok untuk tahap prototype/ujicoba. Untuk dipakai resmi oleh sekolah, sebaiknya ditambahkan:

- Login admin yang lebih aman dengan session/JWT.
- Database PostgreSQL/MySQL.
- Upload dan validasi dokumen.
- Role admin/operator/verifikator.
- Audit log perubahan data.
- HTTPS dan backup database.
- Proteksi rate limit dan validasi NISN lebih ketat.
