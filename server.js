const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const QRCode = require('qrcode');

const ROOT_DIR = __dirname;

function loadEnvFile(rootDir) {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (!key || (process.env[key] !== undefined && process.env[key] !== '')) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(ROOT_DIR);

const PORT = Number(process.env.PORT || 3000);
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminppdb';
const SCHOOL_NAME = process.env.SCHOOL_NAME || 'SMAN 2 NGAWI';
const REGISTRATION_YEAR = process.env.REGISTRATION_YEAR || '2026';
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'ppdb-documents';
const ADMIN_SESSION_TTL_MS = Number(process.env.ADMIN_SESSION_TTL_MS || 8 * 60 * 60 * 1000);
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET ||
  SUPABASE_SERVICE_ROLE_KEY ||
  crypto.createHash('sha256').update(`${ADMIN_PASSWORD}:${ROOT_DIR}`).digest('hex');
const ALLOW_LEGACY_ADMIN_PASSWORD = process.env.ALLOW_LEGACY_ADMIN_PASSWORD === 'true';
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DB_DIR = path.join(ROOT_DIR, 'db');
const DB_PATH = path.join(DB_DIR, 'data.json');
const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads');
const MAX_JSON_BYTES = 1_000_000;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_MULTIPART_BYTES = 40 * 1024 * 1024;

const documentDefinitions = [
  { key: 'familyCard', label: 'Kartu Keluarga', required: true, allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'] },
  { key: 'birthCertificate', label: 'Akta Kelahiran', required: true, allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'] },
  { key: 'reportDocument', label: 'Rapor Semester 1-5 / Keterangan Nilai', required: true, allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'] },
  { key: 'nisnProof', label: 'Bukti NISN dan Data Dapodik', required: true, allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'] },
  { key: 'photo', label: 'Pas Foto 3x4', required: true, allowedExtensions: ['.jpg', '.jpeg', '.png'] },
  { key: 'achievementCertificate', label: 'Sertifikat Prestasi', requiredForPathway: 'Prestasi', allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'] }
];

const documentDefinitionMap = Object.fromEntries(documentDefinitions.map(item => [item.key, item]));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const allowedStatuses = [
  'Menunggu Verifikasi',
  'Terverifikasi',
  'Cadangan',
  'Diterima',
  'Ditolak'
];

function seedApplicants() {
  return [
    {
      registrationNumber: 'PPDB-2026-0001',
      nisn: '0087654321',
      name: 'Alya Putri Maharani',
      school: 'SMP Negeri 1 Ngawi',
      birthDate: '2011-03-14',
      gender: 'Perempuan',
      pathway: 'Prestasi',
      reportScore: 91.2,
      testScore: 88,
      phone: '081234567801',
      email: 'alya@example.com',
      address: 'Ngawi, Jawa Timur',
      achievement: 'Juara OSN IPA tingkat kabupaten',
      status: 'Diterima',
      notes: 'Berkas lengkap',
      createdAt: '2026-06-01T08:15:00.000Z',
      updatedAt: '2026-06-03T09:00:00.000Z'
    },
    {
      registrationNumber: 'PPDB-2026-0002',
      nisn: '0087654322',
      name: 'Bima Arya Pratama',
      school: 'SMP Negeri 2 Ngawi',
      birthDate: '2011-07-22',
      gender: 'Laki-laki',
      pathway: 'Zonasi',
      reportScore: 86.5,
      testScore: 90,
      phone: '081234567802',
      email: 'bima@example.com',
      address: 'Kecamatan Ngawi',
      achievement: 'Aktif Pramuka dan basket',
      status: 'Diterima',
      notes: 'Nilai tes sangat baik',
      createdAt: '2026-06-01T10:20:00.000Z',
      updatedAt: '2026-06-03T09:05:00.000Z'
    },
    {
      registrationNumber: 'PPDB-2026-0003',
      nisn: '0087654323',
      name: 'Cahya Dewi Lestari',
      school: 'MTs Negeri Ngawi',
      birthDate: '2011-01-08',
      gender: 'Perempuan',
      pathway: 'Afirmasi',
      reportScore: 84.75,
      testScore: 81,
      phone: '081234567803',
      email: 'cahya@example.com',
      address: 'Geneng, Ngawi',
      achievement: 'Pengurus OSIS',
      status: 'Cadangan',
      notes: 'Menunggu kuota final',
      createdAt: '2026-06-02T06:45:00.000Z',
      updatedAt: '2026-06-03T09:10:00.000Z'
    },
    {
      registrationNumber: 'PPDB-2026-0004',
      nisn: '0087654324',
      name: 'Dimas Bagas Saputra',
      school: 'SMP Negeri 3 Ngawi',
      birthDate: '2010-11-17',
      gender: 'Laki-laki',
      pathway: 'Prestasi',
      reportScore: 89.4,
      testScore: 84,
      phone: '081234567804',
      email: 'dimas@example.com',
      address: 'Paron, Ngawi',
      achievement: 'Juara futsal tingkat kabupaten',
      status: 'Terverifikasi',
      notes: 'Menunggu pengumuman final',
      createdAt: '2026-06-02T11:10:00.000Z',
      updatedAt: '2026-06-03T09:15:00.000Z'
    },
    {
      registrationNumber: 'PPDB-2026-0005',
      nisn: '0087654325',
      name: 'Eka Ramadhan Wijaya',
      school: 'SMP Islam Ngawi',
      birthDate: '2011-04-29',
      gender: 'Laki-laki',
      pathway: 'Perpindahan Orang Tua',
      reportScore: 82.1,
      testScore: 78,
      phone: '081234567805',
      email: 'eka@example.com',
      address: 'Ngawi Kota',
      achievement: 'Minat teknologi informasi',
      status: 'Terverifikasi',
      notes: 'Dokumen perpindahan tervalidasi',
      createdAt: '2026-06-02T13:30:00.000Z',
      updatedAt: '2026-06-03T09:20:00.000Z'
    },
    {
      registrationNumber: 'PPDB-2026-0006',
      nisn: '0087654326',
      name: 'Farah Nabila Salsabila',
      school: 'SMP Negeri 4 Ngawi',
      birthDate: '2011-09-03',
      gender: 'Perempuan',
      pathway: 'Zonasi',
      reportScore: 87,
      testScore: null,
      phone: '081234567806',
      email: 'farah@example.com',
      address: 'Karangjati, Ngawi',
      achievement: 'Minat jurnalistik',
      status: 'Menunggu Verifikasi',
      notes: 'Belum mengikuti tes',
      createdAt: '2026-06-03T03:35:00.000Z',
      updatedAt: '2026-06-03T03:35:00.000Z'
    }
  ];
}

function seedDatabase() {
  return {
    meta: {
      schoolName: SCHOOL_NAME,
      registrationYear: REGISTRATION_YEAR,
      lastSequence: 6,
      createdAt: new Date().toISOString()
    },
    applicants: seedApplicants()
  };
}

function mapMetaFromSupabase(row) {
  return {
    schoolName: row.school_name || SCHOOL_NAME,
    registrationYear: row.registration_year || REGISTRATION_YEAR,
    lastSequence: Number(row.last_sequence || 0),
    createdAt: row.created_at || new Date().toISOString()
  };
}

function mapMetaToSupabase(meta) {
  return {
    id: 'default',
    school_name: meta.schoolName || SCHOOL_NAME,
    registration_year: meta.registrationYear || REGISTRATION_YEAR,
    last_sequence: Number(meta.lastSequence || 0),
    created_at: meta.createdAt || new Date().toISOString()
  };
}

function applicantRow(applicant) {
  return {
    registration_number: applicant.registrationNumber,
    nisn: applicant.nisn,
    data: applicant,
    created_at: applicant.createdAt || new Date().toISOString(),
    updated_at: applicant.updatedAt || new Date().toISOString()
  };
}

function parseResponseBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function supabaseErrorMessage(data, fallback) {
  if (data && typeof data === 'object') {
    return data.message || data.details || data.hint || fallback;
  }
  return data || fallback;
}

async function supabaseRest(pathname, options = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('Node.js 18 atau lebih baru diperlukan untuk koneksi Supabase.');
  }

  const hasBody = options.body !== undefined;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    method: options.method || 'GET',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    body: hasBody ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const data = parseResponseBody(text);

  if (!response.ok) {
    throw new Error(supabaseErrorMessage(data, 'Gagal mengakses Supabase.'));
  }

  return data;
}

async function supabaseStorage(pathname, options = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('Node.js 18 atau lebih baru diperlukan untuk koneksi Supabase.');
  }

  const hasJson = options.json !== undefined;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/${pathname}`, {
    method: options.method || 'GET',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...(hasJson ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    body: hasJson ? JSON.stringify(options.json) : options.body
  });

  if (options.raw && response.ok) {
    return Buffer.from(await response.arrayBuffer());
  }

  const text = await response.text();
  const data = parseResponseBody(text);
  if (!response.ok) {
    throw new Error(supabaseErrorMessage(data, 'Gagal mengakses Supabase Storage.'));
  }

  return data;
}

function postgrestValue(value) {
  return encodeURIComponent(String(value));
}

function storagePath(value) {
  return String(value).split('/').map(segment => encodeURIComponent(segment)).join('/');
}

async function ensureSupabaseDb() {
  let rows;
  try {
    rows = await supabaseRest('ppdb_meta?id=eq.default&select=*');
  } catch (error) {
    throw new Error(`Supabase belum siap. Jalankan file supabase/schema.sql di SQL Editor Supabase. Detail: ${error.message}`);
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    await writeSupabaseDb(seedDatabase());
  }
}

async function readSupabaseDb() {
  await ensureSupabaseDb();
  const [metaRows, applicantRows] = await Promise.all([
    supabaseRest('ppdb_meta?id=eq.default&select=*'),
    supabaseRest('ppdb_applicants?select=data&order=created_at.asc')
  ]);

  return {
    meta: mapMetaFromSupabase(metaRows[0] || {}),
    applicants: Array.isArray(applicantRows)
      ? applicantRows.map(row => row.data).filter(Boolean)
      : []
  };
}

async function writeSupabaseDb(data) {
  await supabaseRest('ppdb_meta?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: mapMetaToSupabase(data.meta || {})
  });

  const currentRows = await supabaseRest('ppdb_applicants?select=registration_number');
  const nextRegistrationNumbers = new Set((data.applicants || []).map(item => item.registrationNumber));
  const staleRows = Array.isArray(currentRows)
    ? currentRows.filter(row => !nextRegistrationNumbers.has(row.registration_number))
    : [];

  for (const row of staleRows) {
    await supabaseRest(`ppdb_applicants?registration_number=eq.${postgrestValue(row.registration_number)}`, {
      method: 'DELETE'
    });
  }

  if (data.applicants && data.applicants.length) {
    await supabaseRest('ppdb_applicants?on_conflict=registration_number', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: data.applicants.map(applicantRow)
    });
  }
}

async function allocateRegistration(db) {
  const fallbackSequence = Number(db.meta.lastSequence || 0) + 1;
  if (!USE_SUPABASE) {
    return {
      sequence: fallbackSequence,
      registrationNumber: makeRegistrationNumber(fallbackSequence)
    };
  }

  try {
    const result = await supabaseRest('rpc/ppdb_next_registration_number', {
      method: 'POST',
      body: { p_registration_year: REGISTRATION_YEAR }
    });
    const row = Array.isArray(result) ? result[0] : result;
    if (row && row.registration_number && Number.isFinite(Number(row.last_sequence))) {
      return {
        sequence: Number(row.last_sequence),
        registrationNumber: row.registration_number
      };
    }
  } catch (error) {
    console.warn(`Fungsi sequence Supabase tidak tersedia, memakai fallback aplikasi: ${error.message}`);
  }

  return {
    sequence: fallbackSequence,
    registrationNumber: makeRegistrationNumber(fallbackSequence)
  };
}

async function ensureDb() {
  if (USE_SUPABASE) {
    await ensureSupabaseDb();
    return;
  }

  await fsp.mkdir(DB_DIR, { recursive: true });
  try {
    await fsp.access(DB_PATH, fs.constants.F_OK);
  } catch {
    await writeDb(seedDatabase());
  }
}

async function readDb() {
  if (USE_SUPABASE) {
    return readSupabaseDb();
  }

  await ensureDb();
  const raw = await fsp.readFile(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

async function writeDb(data) {
  if (USE_SUPABASE) {
    await writeSupabaseDb(data);
    return;
  }

  await fsp.mkdir(DB_DIR, { recursive: true });
  const tmpPath = `${DB_PATH}.tmp`;
  await fsp.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  await fsp.rename(tmpPath, DB_PATH);
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendText(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > MAX_JSON_BYTES) {
        reject(new Error('Ukuran request terlalu besar.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Format JSON tidak valid.'));
      }
    });
    req.on('error', reject);
  });
}

function parseContentDisposition(value) {
  const result = {};
  String(value || '').split(';').forEach(part => {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey || !rawValue.length) return;
    const key = rawKey.toLowerCase();
    const joinedValue = rawValue.join('=').trim();
    result[key] = joinedValue.replace(/^"|"$/g, '');
  });
  return result;
}

function parseMultipart(req) {
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    return Promise.reject(new Error('Format unggahan dokumen tidak valid.'));
  }

  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const separator = Buffer.from('\r\n\r\n');

  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_MULTIPART_BYTES) {
        reject(new Error('Total ukuran unggahan terlalu besar. Maksimal 40 MB per pendaftaran.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks);
        const fields = {};
        const files = {};
        let cursor = body.indexOf(boundary);

        while (cursor !== -1) {
          cursor += boundary.length;

          if (body[cursor] === 45 && body[cursor + 1] === 45) break;
          if (body[cursor] === 13 && body[cursor + 1] === 10) cursor += 2;

          const headerEnd = body.indexOf(separator, cursor);
          if (headerEnd === -1) break;

          const headerText = body.slice(cursor, headerEnd).toString('utf8');
          const headers = {};
          headerText.split('\r\n').forEach(line => {
            const index = line.indexOf(':');
            if (index === -1) return;
            headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
          });

          const disposition = parseContentDisposition(headers['content-disposition']);
          const fieldName = disposition.name;
          const nextBoundary = body.indexOf(boundary, headerEnd + separator.length);
          if (!fieldName || nextBoundary === -1) break;

          let dataEnd = nextBoundary;
          if (body[dataEnd - 2] === 13 && body[dataEnd - 1] === 10) dataEnd -= 2;

          const content = body.slice(headerEnd + separator.length, dataEnd);
          if (disposition.filename) {
            if (content.length > 0) {
              files[fieldName] = {
                fieldName,
                originalName: path.basename(disposition.filename),
                mimeType: headers['content-type'] || 'application/octet-stream',
                size: content.length,
                buffer: content
              };
            }
          } else {
            fields[fieldName] = content.toString('utf8').trim();
          }

          cursor = nextBoundary;
        }

        resolve({ fields, files });
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

function normalizeText(value) {
  return String(value || '').trim();
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function calculateFinalScore(applicant) {
  const reportScore = toNumberOrNull(applicant.reportScore);
  const testScore = toNumberOrNull(applicant.testScore);
  if (reportScore === null || testScore === null) return null;
  return round2((testScore * 0.6) + (reportScore * 0.4));
}

function publicApplicant(applicant) {
  const finalScore = calculateFinalScore(applicant);
  return {
    registrationNumber: applicant.registrationNumber,
    nisn: applicant.nisn,
    name: applicant.name,
    school: applicant.school,
    birthDate: applicant.birthDate,
    gender: applicant.gender,
    pathway: applicant.pathway,
    reportScore: applicant.reportScore,
    testScore: applicant.testScore,
    finalScore,
    phone: applicant.phone,
    email: applicant.email,
    address: applicant.address,
    achievement: applicant.achievement,
    status: applicant.status,
    notes: applicant.notes,
    createdAt: applicant.createdAt,
    updatedAt: applicant.updatedAt
  };
}

function adminApplicant(applicant) {
  return {
    ...publicApplicant(applicant),
    documents: documentList(applicant.documents)
  };
}

function getRanking(applicants, filters = {}) {
  const search = normalizeText(filters.search).toLowerCase();
  const pathway = normalizeText(filters.pathway);

  let rows = applicants.map(publicApplicant);

  if (pathway) {
    rows = rows.filter(item => item.pathway === pathway);
  }

  if (search) {
    rows = rows.filter(item => [
      item.registrationNumber,
      item.nisn,
      item.name,
      item.school,
      item.pathway,
      item.status
    ].some(value => String(value || '').toLowerCase().includes(search)));
  }

  rows.sort((a, b) => {
    const scoreA = a.finalScore ?? -1;
    const scoreB = b.finalScore ?? -1;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return String(a.createdAt).localeCompare(String(b.createdAt));
  });

  return rows.map((item, index) => ({
    rank: item.finalScore === null ? null : index + 1,
    ...item
  }));
}

function validateApplicant(payload, existingApplicants) {
  const errors = [];
  const required = ['name', 'nisn', 'school', 'birthDate', 'gender', 'pathway', 'reportScore', 'phone', 'email', 'address'];

  required.forEach(field => {
    if (!normalizeText(payload[field])) errors.push(`${field} wajib diisi.`);
  });

  const nisn = normalizeText(payload.nisn);
  if (nisn && !/^\d{8,12}$/.test(nisn)) {
    errors.push('NISN harus berupa angka 8-12 digit.');
  }

  if (existingApplicants.some(item => item.nisn === nisn)) {
    errors.push('NISN sudah terdaftar. Gunakan menu Cek Status untuk melihat data pendaftaran.');
  }

  const reportScore = Number(payload.reportScore);
  if (!Number.isFinite(reportScore) || reportScore < 0 || reportScore > 100) {
    errors.push('Rata-rata nilai rapor harus berada pada rentang 0-100.');
  }

  const email = normalizeText(payload.email);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    errors.push('Format email tidak valid.');
  }

  const pathways = ['Prestasi', 'Zonasi', 'Afirmasi', 'Perpindahan Orang Tua'];
  if (payload.pathway && !pathways.includes(payload.pathway)) {
    errors.push('Jalur pendaftaran tidak valid.');
  }

  const genders = ['Laki-laki', 'Perempuan'];
  if (payload.gender && !genders.includes(payload.gender)) {
    errors.push('Jenis kelamin tidak valid.');
  }

  return errors;
}

function documentIsRequired(definition, pathway) {
  return Boolean(definition.required || definition.requiredForPathway === pathway);
}

function validateDocumentUploads(payload, files) {
  const errors = [];
  const pathway = normalizeText(payload.pathway);

  for (const definition of documentDefinitions) {
    const file = files[definition.key];
    if (documentIsRequired(definition, pathway) && !file) {
      errors.push(`${definition.label} wajib diunggah.`);
      continue;
    }
    if (!file) continue;

    const extension = path.extname(file.originalName).toLowerCase();
    const allowedExtensions = definition.allowedExtensions || [];
    if (!allowedExtensions.includes(extension)) {
      errors.push(`${definition.label} harus berformat ${allowedExtensions.map(item => item.replace('.', '').toUpperCase()).join(', ')}.`);
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      errors.push(`${definition.label} maksimal 5 MB.`);
    }
  }

  return errors;
}

function sanitizeFileName(value) {
  const base = path.basename(value || 'dokumen').replace(/\.[^.]*$/, '');
  return base
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'dokumen';
}

function applicantUploadDir(registrationNumber) {
  return path.join(UPLOAD_DIR, registrationNumber);
}

async function saveApplicantDocuments(registrationNumber, files) {
  if (USE_SUPABASE) {
    return saveSupabaseApplicantDocuments(registrationNumber, files);
  }

  return saveLocalApplicantDocuments(registrationNumber, files);
}

async function saveLocalApplicantDocuments(registrationNumber, files) {
  const documents = {};
  const targetDir = applicantUploadDir(registrationNumber);
  await fsp.mkdir(targetDir, { recursive: true });
  const uploadedAt = new Date().toISOString();

  for (const definition of documentDefinitions) {
    const file = files[definition.key];
    if (!file) continue;

    const extension = path.extname(file.originalName).toLowerCase();
    const fileName = `${definition.key}-${sanitizeFileName(file.originalName)}${extension}`;
    const filePath = path.join(targetDir, fileName);
    await fsp.writeFile(filePath, file.buffer);

    documents[definition.key] = {
      label: definition.label,
      originalName: file.originalName,
      fileName,
      mimeType: file.mimeType,
      size: file.size,
      uploadedAt
    };
  }

  return documents;
}

async function saveSupabaseApplicantDocuments(registrationNumber, files) {
  const documents = {};
  const uploadedAt = new Date().toISOString();

  for (const definition of documentDefinitions) {
    const file = files[definition.key];
    if (!file) continue;

    const extension = path.extname(file.originalName).toLowerCase();
    const fileName = `${definition.key}-${sanitizeFileName(file.originalName)}${extension}`;
    const objectPath = `${registrationNumber}/${fileName}`;

    await supabaseStorage(`object/${encodeURIComponent(SUPABASE_STORAGE_BUCKET)}/${storagePath(objectPath)}`, {
      method: 'POST',
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'x-upsert': 'false'
      },
      body: file.buffer
    });

    documents[definition.key] = {
      label: definition.label,
      originalName: file.originalName,
      fileName,
      mimeType: file.mimeType,
      size: file.size,
      uploadedAt,
      storageProvider: 'supabase',
      storageBucket: SUPABASE_STORAGE_BUCKET,
      storagePath: objectPath
    };
  }

  return documents;
}

async function downloadSupabaseDocument(documentMeta) {
  if (!documentMeta.storagePath) {
    throw new Error('Path dokumen Supabase tidak tersedia.');
  }

  return supabaseStorage(`object/${encodeURIComponent(documentMeta.storageBucket || SUPABASE_STORAGE_BUCKET)}/${storagePath(documentMeta.storagePath)}`, {
    raw: true
  });
}

async function removeSupabaseDocuments(applicants = []) {
  const paths = [];
  for (const applicant of applicants) {
    for (const documentMeta of Object.values(applicant.documents || {})) {
      if (documentMeta && documentMeta.storageProvider === 'supabase' && documentMeta.storagePath) {
        paths.push(documentMeta.storagePath);
      }
    }
  }

  if (!paths.length) return;

  await supabaseStorage(`object/${encodeURIComponent(SUPABASE_STORAGE_BUCKET)}`, {
    method: 'DELETE',
    json: { prefixes: paths }
  });
}

async function clearUploadedDocuments(applicants = []) {
  if (USE_SUPABASE) {
    await removeSupabaseDocuments(applicants);
  }

  await fsp.rm(UPLOAD_DIR, { recursive: true, force: true });
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
}

function documentList(documents = {}) {
  return documentDefinitions.map(definition => {
    const item = documents[definition.key];
    return {
      key: definition.key,
      label: definition.label,
      required: Boolean(definition.required),
      requiredForPathway: definition.requiredForPathway || null,
      uploaded: Boolean(item),
      originalName: item ? item.originalName : null,
      size: item ? item.size : null,
      uploadedAt: item ? item.uploadedAt : null
    };
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDateOnly(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatProofScore(value) {
  if (value === null || value === undefined || value === '') return '-';
  return Number(value).toFixed(2).replace(/\.00$/, '');
}

function proofRow(label, value) {
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value || '-')}</td></tr>`;
}

function makeProofVerificationCode(applicant) {
  const source = [
    applicant.registrationNumber,
    applicant.nisn,
    applicant.createdAt,
    REGISTRATION_YEAR,
    ADMIN_SESSION_SECRET
  ].join('|');
  const hash = crypto.createHash('sha256').update(source).digest('hex').slice(0, 12).toUpperCase();
  return hash.match(/.{1,4}/g).join('-');
}

function makeQrSvg(text) {
  const qr = QRCode.create(text, {
    errorCorrectionLevel: 'M',
    margin: 1
  });
  const size = qr.modules.size;
  const cells = qr.modules.data;
  const quietZone = 2;
  const viewBoxSize = size + quietZone * 2;
  const rects = [];

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (cells[row * size + col]) {
        rects.push(`<rect x="${col + quietZone}" y="${row + quietZone}" width="1" height="1"/>`);
      }
    }
  }

  return [
    `<svg class="qr-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" role="img" aria-label="QR verifikasi bukti pendaftaran">`,
    '<rect width="100%" height="100%" fill="#fff"/>',
    `<g fill="#102033">${rects.join('')}</g>`,
    '</svg>'
  ].join('');
}

function buildPublicUrl(req, pathname, searchParams = {}) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const localHost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('[::1]');
  const proto = req.headers['x-forwarded-proto'] || (localHost ? 'http' : 'https');
  const url = new URL(pathname, `${proto}://${host}`);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function renderProofDocument(applicant, proofUrl) {
  const publicData = publicApplicant(applicant);
  const documents = documentList(applicant.documents);
  const issuedAt = new Date().toISOString();
  const verificationCode = makeProofVerificationCode(applicant);
  const verificationUrl = proofUrl || `/bukti/${encodeURIComponent(publicData.registrationNumber)}`;
  const qrSvg = makeQrSvg(verificationUrl);
  const documentRows = documents.map(document => `
    <tr>
      <td>${escapeHtml(document.label)}</td>
      <td>${document.uploaded ? 'Sudah diunggah' : 'Belum diunggah'}</td>
      <td>${escapeHtml(document.originalName || '-')}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bukti Pendaftaran ${escapeHtml(publicData.registrationNumber)}</title>
  <style>
    @page { margin: 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; color: #102033; background: #eef7f5; line-height: 1.5; }
    .page { width: min(940px, calc(100% - 32px)); margin: 32px auto; background: #fff; border: 1px solid #cbded9; border-radius: 18px; padding: 34px; box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08); }
    .toolbar { width: min(940px, calc(100% - 32px)); margin: 24px auto 0; display: flex; justify-content: flex-end; gap: 10px; }
    .button { border: 0; border-radius: 999px; padding: 11px 18px; font-weight: 700; cursor: pointer; text-decoration: none; color: #fff; background: #0f766e; }
    .button.secondary { color: #102033; background: #fff; border: 1px solid #cbded9; }
    .letterhead { display: grid; grid-template-columns: 72px 1fr auto; gap: 18px; align-items: center; border-bottom: 3px double #0f766e; padding-bottom: 18px; margin-bottom: 22px; }
    .logo { width: 72px; height: 72px; border-radius: 16px; display: grid; place-items: center; color: #fff; background: #0f766e; font-size: 28px; font-weight: 900; }
    .kicker { margin: 0 0 4px; color: #0f766e; font-size: 12px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
    h1 { margin: 0; font-size: 27px; line-height: 1.15; text-transform: uppercase; }
    .subtitle { margin: 5px 0 0; color: #516277; }
    .number { text-align: right; font-size: 13px; color: #65758b; min-width: 210px; }
    .number strong { display: block; color: #102033; font-size: 22px; }
    .status { display: inline-block; margin-top: 8px; border-radius: 999px; padding: 6px 10px; color: #0f766e; background: #e0f7f3; font-weight: 800; }
    .document-title { text-align: center; margin: 22px 0 20px; }
    .document-title h2 { margin: 0; font-size: 22px; text-decoration: underline; text-underline-offset: 5px; text-transform: uppercase; }
    .document-title p { margin: 7px 0 0; color: #516277; }
    .verification { display: grid; grid-template-columns: 1fr 170px; gap: 20px; padding: 18px; border: 1px solid #cbded9; border-radius: 14px; background: #f8fbfa; margin-bottom: 22px; }
    .verification-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .verification-item { border-left: 4px solid #0f766e; padding-left: 12px; }
    .verification-item span { display: block; color: #65758b; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .verification-item strong, .verification-item a { color: #102033; font-size: 14px; font-weight: 800; overflow-wrap: anywhere; }
    .qr-card { text-align: center; align-self: start; }
    .qr-svg { width: 148px; height: 148px; border: 1px solid #cbded9; border-radius: 10px; padding: 8px; background: #fff; }
    .qr-caption { margin: 6px 0 0; color: #65758b; font-size: 11px; font-weight: 700; }
    .section { margin-top: 22px; }
    .section h2 { margin: 0 0 10px; font-size: 17px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbded9; padding: 10px 12px; text-align: left; vertical-align: top; }
    th { width: 34%; background: #f8fafc; color: #65758b; }
    .documents th { width: auto; }
    .signature { display: grid; grid-template-columns: 1fr 240px; gap: 24px; margin-top: 28px; color: #516277; font-size: 13px; }
    .sign-box { text-align: center; color: #102033; }
    .sign-space { height: 64px; }
    footer { margin-top: 22px; color: #65758b; font-size: 12px; border-top: 1px solid #cbded9; padding-top: 12px; }
    @media (max-width: 720px) {
      .letterhead, .verification, .signature { grid-template-columns: 1fr; }
      .number { text-align: left; }
      .qr-card { text-align: left; }
    }
    @media print {
      body { background: #fff; }
      .toolbar { display: none; }
      .page { width: 100%; margin: 0; border: 0; border-radius: 0; padding: 0; box-shadow: none; }
      .verification { break-inside: avoid; }
      .section { break-inside: avoid; }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <a class="button secondary" href="/">Kembali</a>
    <button class="button" type="button" onclick="window.print()">Cetak Bukti</button>
  </div>
  <main class="page">
    <header class="letterhead">
      <div class="logo">2N</div>
      <div>
        <p class="kicker">Sistem Penerimaan Murid Baru</p>
        <h1>${escapeHtml(SCHOOL_NAME)}</h1>
        <p class="subtitle">Bukti pendaftaran elektronik tahun ${escapeHtml(REGISTRATION_YEAR)}</p>
      </div>
      <div class="number">
        Nomor Pendaftaran
        <strong>${escapeHtml(publicData.registrationNumber)}</strong>
        <span class="status">${escapeHtml(publicData.status)}</span>
      </div>
    </header>

    <section class="document-title">
      <h2>Bukti Pendaftaran PPDB</h2>
      <p>Dokumen ini diterbitkan oleh sistem pendaftaran sebagai tanda bahwa data calon peserta didik telah diterima.</p>
    </section>

    <section class="verification">
      <div class="verification-grid">
        <div class="verification-item">
          <span>Nomor Pendaftaran</span>
          <strong>${escapeHtml(publicData.registrationNumber)}</strong>
        </div>
        <div class="verification-item">
          <span>Kode Verifikasi</span>
          <strong>${escapeHtml(verificationCode)}</strong>
        </div>
        <div class="verification-item">
          <span>Waktu Pendaftaran</span>
          <strong>${escapeHtml(formatDateTime(publicData.createdAt))}</strong>
        </div>
        <div class="verification-item">
          <span>Waktu Terbit Bukti</span>
          <strong>${escapeHtml(formatDateTime(issuedAt))}</strong>
        </div>
        <div class="verification-item">
          <span>Alamat Verifikasi</span>
          <a href="${escapeHtml(verificationUrl)}">${escapeHtml(verificationUrl)}</a>
        </div>
      </div>
      <div class="qr-card">
        ${qrSvg}
        <p class="qr-caption">Pindai untuk membuka bukti</p>
      </div>
    </section>

    <section class="section">
      <h2>Data Calon Peserta Didik</h2>
      <table>
        <tbody>
          ${proofRow('Nama Lengkap', publicData.name)}
          ${proofRow('NISN', publicData.nisn)}
          ${proofRow('Asal Sekolah', publicData.school)}
          ${proofRow('Tanggal Lahir', formatDateOnly(publicData.birthDate))}
          ${proofRow('Jenis Kelamin', publicData.gender)}
          ${proofRow('Jalur Pendaftaran', publicData.pathway)}
          ${proofRow('No. Telepon', publicData.phone)}
          ${proofRow('Email', publicData.email)}
          ${proofRow('Alamat', publicData.address)}
        </tbody>
      </table>
    </section>

    <section class="section">
      <h2>Nilai dan Status</h2>
      <table>
        <tbody>
          ${proofRow('Nilai Rapor', formatProofScore(publicData.reportScore))}
          ${proofRow('Nilai Tes', formatProofScore(publicData.testScore))}
          ${proofRow('Nilai Akhir', formatProofScore(publicData.finalScore))}
          ${proofRow('Prestasi', publicData.achievement)}
          ${proofRow('Catatan Panitia', publicData.notes)}
          ${proofRow('Waktu Pendaftaran', formatDateTime(publicData.createdAt))}
        </tbody>
      </table>
    </section>

    <section class="section">
      <h2>Kelengkapan Dokumen</h2>
      <table class="documents">
        <thead><tr><th>Dokumen</th><th>Status</th><th>Nama File</th></tr></thead>
        <tbody>${documentRows}</tbody>
      </table>
    </section>

    <section class="signature">
      <p>
        Bukti ini sah sebagai bukti pendaftaran elektronik. Keputusan verifikasi, penerimaan, dan daftar ulang tetap mengikuti pengumuman resmi panitia PPDB ${escapeHtml(SCHOOL_NAME)}.
      </p>
      <div class="sign-box">
        <div>Panitia PPDB</div>
        <div class="sign-space"></div>
        <strong>${escapeHtml(SCHOOL_NAME)}</strong>
      </div>
    </section>

    <footer>
      Dokumen otomatis. Simpan nomor pendaftaran dan kode verifikasi untuk memantau status seleksi.
    </footer>
  </main>
</body>
</html>`;
}

function makeRegistrationNumber(sequence) {
  return `PPDB-${REGISTRATION_YEAR}-${String(sequence).padStart(4, '0')}`;
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function signAdminPayload(payload) {
  return crypto
    .createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(payload)
    .digest('base64url');
}

function createAdminToken(username) {
  const now = Date.now();
  const payload = base64UrlJson({
    sub: username,
    iat: now,
    exp: now + ADMIN_SESSION_TTL_MS
  });

  return {
    token: `${payload}.${signAdminPayload(payload)}`,
    expiresAt: new Date(now + ADMIN_SESSION_TTL_MS).toISOString()
  };
}

function verifyAdminToken(token) {
  const [payload, signature, extra] = String(token || '').split('.');
  if (!payload || !signature || extra) return null;
  if (!safeEqual(signature, signAdminPayload(payload))) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!safeEqual(session.sub, ADMIN_USERNAME)) return null;
    if (!Number.isFinite(Number(session.exp)) || Date.now() > Number(session.exp)) return null;
    return session;
  } catch {
    return null;
  }
}

function adminSessionFromRequest(req) {
  const authorization = req.headers.authorization || '';
  const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const headerToken = req.headers['x-admin-token'];
  return verifyAdminToken(bearerToken || headerToken);
}

function isAuthorized(req) {
  const session = adminSessionFromRequest(req);
  if (session) {
    req.adminSession = session;
    return true;
  }

  if (ALLOW_LEGACY_ADMIN_PASSWORD) {
    const headerPassword = req.headers['x-admin-password'];
    return Boolean(headerPassword && safeEqual(headerPassword, ADMIN_PASSWORD));
  }

  return false;
}

function requireAdmin(req, res) {
  if (!isAuthorized(req)) {
    sendJson(res, 401, {
      success: false,
      message: 'Sesi admin tidak valid atau sudah kedaluwarsa.'
    });
    return false;
  }
  return true;
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/"/g, '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
}

function buildCsv(applicants) {
  const headers = [
    'rank',
    'registrationNumber',
    'nisn',
    'name',
    'school',
    'gender',
    'birthDate',
    'pathway',
    'reportScore',
    'testScore',
    'finalScore',
    'status',
    'phone',
    'email',
    'address',
    'achievement',
    'notes',
    'createdAt',
    'updatedAt'
  ];
  const ranked = getRanking(applicants);
  const lines = [headers.join(',')];
  for (const row of ranked) {
    lines.push(headers.map(header => csvEscape(row[header])).join(','));
  }
  return lines.join('\n');
}

async function handleApi(req, res, url) {
  const method = req.method;
  const pathname = url.pathname;

  if (method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, {
      success: true,
      message: 'Server PPDB aktif.',
      schoolName: SCHOOL_NAME,
      registrationYear: REGISTRATION_YEAR,
      database: USE_SUPABASE ? 'supabase' : 'local-json',
      storage: USE_SUPABASE ? 'supabase-storage' : 'local-folder',
      time: new Date().toISOString()
    });
  }

  if (method === 'POST' && pathname === '/api/admin/login') {
    const payload = await parseBody(req);
    const username = normalizeText(payload.username);
    const password = normalizeText(payload.password);

    if (!safeEqual(username, ADMIN_USERNAME) || !safeEqual(password, ADMIN_PASSWORD)) {
      return sendJson(res, 401, {
        success: false,
        message: 'Username atau password admin tidak valid.'
      });
    }

    const session = createAdminToken(ADMIN_USERNAME);
    return sendJson(res, 200, {
      success: true,
      message: 'Login admin berhasil.',
      username: ADMIN_USERNAME,
      token: session.token,
      expiresAt: session.expiresAt
    });
  }

  if (method === 'GET' && pathname === '/api/admin/me') {
    if (!requireAdmin(req, res)) return;
    return sendJson(res, 200, {
      success: true,
      username: ADMIN_USERNAME,
      expiresAt: req.adminSession ? new Date(Number(req.adminSession.exp)).toISOString() : null
    });
  }

  if (method === 'POST' && pathname === '/api/register') {
    const contentType = req.headers['content-type'] || '';
    const parsedRequest = contentType.includes('multipart/form-data')
      ? await parseMultipart(req)
      : { fields: await parseBody(req), files: {} };
    const payload = parsedRequest.fields;
    const files = parsedRequest.files;
    const db = await readDb();
    const errors = [
      ...validateApplicant(payload, db.applicants),
      ...validateDocumentUploads(payload, files)
    ];

    if (errors.length) {
      return sendJson(res, 400, {
        success: false,
        message: 'Pendaftaran belum bisa diproses.',
        errors
      });
    }

    const registration = await allocateRegistration(db);
    const nextSequence = registration.sequence;
    const now = new Date().toISOString();
    const registrationNumber = registration.registrationNumber;
    const documents = await saveApplicantDocuments(registrationNumber, files);
    const applicant = {
      registrationNumber,
      nisn: normalizeText(payload.nisn),
      name: normalizeText(payload.name),
      school: normalizeText(payload.school),
      birthDate: normalizeText(payload.birthDate),
      gender: normalizeText(payload.gender),
      pathway: normalizeText(payload.pathway),
      reportScore: round2(Number(payload.reportScore)),
      testScore: null,
      phone: normalizeText(payload.phone),
      email: normalizeText(payload.email),
      address: normalizeText(payload.address),
      achievement: normalizeText(payload.achievement),
      documents,
      status: 'Menunggu Verifikasi',
      notes: 'Pendaftaran berhasil. Menunggu verifikasi panitia.',
      createdAt: now,
      updatedAt: now
    };

    db.meta.lastSequence = nextSequence;
    db.applicants.push(applicant);
    await writeDb(db);

    return sendJson(res, 201, {
      success: true,
      message: 'Pendaftaran berhasil disimpan.',
      applicant: publicApplicant(applicant)
    });
  }

  if (method === 'GET' && pathname === '/api/ranking') {
    const db = await readDb();
    const ranking = getRanking(db.applicants, {
      search: url.searchParams.get('search') || '',
      pathway: url.searchParams.get('pathway') || ''
    });

    return sendJson(res, 200, {
      success: true,
      count: ranking.length,
      data: ranking
    });
  }

  if (method === 'GET' && pathname.startsWith('/api/status/')) {
    const keyword = decodeURIComponent(pathname.replace('/api/status/', '')).trim().toLowerCase();
    if (!keyword) {
      return sendJson(res, 400, {
        success: false,
        message: 'Masukkan nomor pendaftaran atau NISN.'
      });
    }

    const db = await readDb();
    const applicant = db.applicants.find(item =>
      String(item.registrationNumber).toLowerCase() === keyword ||
      String(item.nisn).toLowerCase() === keyword
    );

    if (!applicant) {
      return sendJson(res, 404, {
        success: false,
        message: 'Data pendaftaran tidak ditemukan.'
      });
    }

    const ranking = getRanking(db.applicants);
    const ranked = ranking.find(item => item.registrationNumber === applicant.registrationNumber);

    return sendJson(res, 200, {
      success: true,
      applicant: {
        ...publicApplicant(applicant),
        rank: ranked ? ranked.rank : null
      }
    });
  }

  if (method === 'GET' && pathname === '/api/admin/applicants') {
    if (!requireAdmin(req, res)) return;
    const db = await readDb();
    return sendJson(res, 200, {
      success: true,
      data: getRanking(db.applicants).map(row => {
        const source = db.applicants.find(item => item.registrationNumber === row.registrationNumber);
        return {
          ...row,
          documents: source ? documentList(source.documents) : documentList()
        };
      })
    });
  }

  if (method === 'GET' && pathname.includes('/documents/')) {
    const match = pathname.match(/^\/api\/admin\/applicants\/([^/]+)\/documents\/([^/]+)$/);
    if (match) {
      if (!requireAdmin(req, res)) return;

      const registrationNumber = decodeURIComponent(match[1]);
      const documentKey = decodeURIComponent(match[2]);
      const definition = documentDefinitionMap[documentKey];
      if (!definition) {
        return sendJson(res, 404, {
          success: false,
          message: 'Dokumen tidak ditemukan.'
        });
      }

      const db = await readDb();
      const applicant = db.applicants.find(item => item.registrationNumber === registrationNumber);
      const documentMeta = applicant && applicant.documents ? applicant.documents[documentKey] : null;
      if (!applicant || !documentMeta) {
        return sendJson(res, 404, {
          success: false,
          message: 'Dokumen belum tersedia.'
        });
      }

      try {
        let body;
        if (documentMeta.storageProvider === 'supabase' && documentMeta.storagePath) {
          body = await downloadSupabaseDocument(documentMeta);
        } else {
          const uploadDirectory = path.resolve(applicantUploadDir(registrationNumber));
          const filePath = path.resolve(uploadDirectory, documentMeta.fileName);
          if (!filePath.startsWith(`${uploadDirectory}${path.sep}`)) {
            return sendJson(res, 403, {
              success: false,
              message: 'Akses dokumen ditolak.'
            });
          }
          body = await fsp.readFile(filePath);
        }

        res.writeHead(200, {
          'Content-Type': documentMeta.mimeType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${sanitizeFileName(documentMeta.originalName)}${path.extname(documentMeta.originalName).toLowerCase()}"`,
          'Cache-Control': 'no-store'
        });
        return res.end(body);
      } catch {
        return sendJson(res, 404, {
          success: false,
          message: 'File dokumen tidak ditemukan di server.'
        });
      }
    }
  }

  if (method === 'PATCH' && pathname.startsWith('/api/admin/applicants/')) {
    if (!requireAdmin(req, res)) return;

    const registrationNumber = decodeURIComponent(pathname.replace('/api/admin/applicants/', '')).trim();
    const payload = await parseBody(req);
    const db = await readDb();
    const applicant = db.applicants.find(item => item.registrationNumber === registrationNumber);

    if (!applicant) {
      return sendJson(res, 404, {
        success: false,
        message: 'Pendaftar tidak ditemukan.'
      });
    }

    const testScore = toNumberOrNull(payload.testScore);
    if (payload.testScore !== undefined && payload.testScore !== '' && (testScore === null || testScore < 0 || testScore > 100)) {
      return sendJson(res, 400, {
        success: false,
        message: 'Nilai tes harus berada pada rentang 0-100.'
      });
    }

    if (payload.status !== undefined && !allowedStatuses.includes(payload.status)) {
      return sendJson(res, 400, {
        success: false,
        message: 'Status tidak valid.'
      });
    }

    if (payload.testScore !== undefined) applicant.testScore = testScore;
    if (payload.status !== undefined) applicant.status = payload.status;
    if (payload.notes !== undefined) applicant.notes = normalizeText(payload.notes);
    applicant.updatedAt = new Date().toISOString();

    await writeDb(db);

    return sendJson(res, 200, {
      success: true,
      message: 'Data pendaftar berhasil diperbarui.',
      applicant: publicApplicant(applicant)
    });
  }

  if (method === 'GET' && pathname === '/api/admin/export') {
    if (!requireAdmin(req, res)) return;
    const db = await readDb();
    const csv = buildCsv(db.applicants);
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="data-ppdb-sman2-ngawi.csv"',
      'Cache-Control': 'no-store'
    });
    return res.end(csv);
  }

  if (method === 'POST' && pathname === '/api/admin/reset') {
    if (!requireAdmin(req, res)) return;
    const db = await readDb();
    const freshDb = seedDatabase();
    await clearUploadedDocuments(db.applicants);
    await writeDb(freshDb);
    return sendJson(res, 200, {
      success: true,
      message: 'Data berhasil direset.',
      data: getRanking(freshDb.applicants)
    });
  }

  return sendJson(res, 404, {
    success: false,
    message: 'Endpoint API tidak ditemukan.'
  });
}

async function serveRegistrationProof(req, res, url) {
  const registrationNumber = decodeURIComponent(url.pathname.replace('/bukti/', '')).trim();
  if (!registrationNumber) {
    return sendText(res, 400, 'Nomor pendaftaran tidak valid.');
  }

  const db = await readDb();
  const applicant = db.applicants.find(item =>
    String(item.registrationNumber).toLowerCase() === registrationNumber.toLowerCase()
  );

  if (!applicant) {
    return sendText(res, 404, 'Data pendaftaran tidak ditemukan.');
  }

  const verificationCode = makeProofVerificationCode(applicant);
  const proofUrl = buildPublicUrl(req, `/bukti/${encodeURIComponent(applicant.registrationNumber)}`, {
    kode: verificationCode
  });

  return sendText(res, 200, renderProofDocument(applicant, proofUrl), 'text/html; charset=utf-8');
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';

  const safePath = path.normalize(pathname).replace(/^([/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendText(res, 403, 'Forbidden');
  }

  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const body = await fsp.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    res.end(body);
  } catch (error) {
    sendText(res, 500, 'Gagal membaca file.');
  }
}

async function requestHandler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }

    if (url.pathname.startsWith('/bukti/')) {
      await serveRegistrationProof(req, res, url);
      return;
    }

    await serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, {
      success: false,
      message: error.message || 'Terjadi kesalahan server.'
    });
  }
}

async function startServer() {
  await ensureDb();
  http.createServer(requestHandler).listen(PORT, () => {
    console.log(`PPDB ${SCHOOL_NAME} berjalan di http://localhost:${PORT}`);
    console.log(`Username admin: ${ADMIN_USERNAME}`);
  });
}

if (require.main === module) {
  startServer().catch(error => {
    console.error('Gagal menyiapkan database:', error);
    process.exit(1);
  });
}

module.exports = Object.assign(requestHandler, {
  ensureDb,
  requestHandler,
  startServer
});
