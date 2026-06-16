const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

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

const SCHOOL_NAME = process.env.SCHOOL_NAME || 'SMAN 2 NGAWI';
const REGISTRATION_YEAR = process.env.REGISTRATION_YEAR || '2026';
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'ppdb-documents';
const DB_PATH = path.join(ROOT_DIR, 'db', 'data.json');
const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads');

const documentDefinitions = [
  { key: 'familyCard', label: 'Kartu Keluarga' },
  { key: 'birthCertificate', label: 'Akta Kelahiran' },
  { key: 'reportDocument', label: 'Rapor Semester 1-5 / Keterangan Nilai' },
  { key: 'nisnProof', label: 'Bukti NISN dan Data Dapodik' },
  { key: 'photo', label: 'Pas Foto 3x4' },
  { key: 'achievementCertificate', label: 'Sertifikat Prestasi' }
];

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

function storagePath(value) {
  return String(value).split('/').map(segment => encodeURIComponent(segment)).join('/');
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
  const response = await fetch(`${SUPABASE_URL}/storage/v1/${pathname}`, {
    method: options.method || 'GET',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...(options.headers || {})
    },
    body: options.body
  });

  const text = await response.text();
  const data = parseResponseBody(text);
  if (!response.ok) {
    throw new Error(supabaseErrorMessage(data, 'Gagal mengakses Supabase Storage.'));
  }

  return data;
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

function sequenceFromRegistrationNumber(registrationNumber) {
  const match = String(registrationNumber || '').match(/-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

async function migrateApplicantDocuments(applicant) {
  if (!applicant.documents || typeof applicant.documents !== 'object') {
    return { applicant, uploadedCount: 0, missingCount: 0 };
  }

  let uploadedCount = 0;
  let missingCount = 0;
  const nextApplicant = {
    ...applicant,
    documents: { ...applicant.documents }
  };

  for (const definition of documentDefinitions) {
    const documentMeta = nextApplicant.documents[definition.key];
    if (!documentMeta) continue;
    if (documentMeta.storageProvider === 'supabase' && documentMeta.storagePath) continue;

    const fileName = documentMeta.fileName;
    const filePath = fileName
      ? path.join(UPLOAD_DIR, String(applicant.registrationNumber), fileName)
      : '';

    if (!filePath || !fs.existsSync(filePath)) {
      missingCount += 1;
      continue;
    }

    const objectPath = `${applicant.registrationNumber}/${fileName}`;
    const body = await fsp.readFile(filePath);
    await supabaseStorage(`object/${encodeURIComponent(SUPABASE_STORAGE_BUCKET)}/${storagePath(objectPath)}`, {
      method: 'POST',
      headers: {
        'Content-Type': documentMeta.mimeType || 'application/octet-stream',
        'x-upsert': 'true'
      },
      body
    });

    nextApplicant.documents[definition.key] = {
      ...documentMeta,
      storageProvider: 'supabase',
      storageBucket: SUPABASE_STORAGE_BUCKET,
      storagePath: objectPath
    };
    uploadedCount += 1;
  }

  return { applicant: nextApplicant, uploadedCount, missingCount };
}

async function main() {
  const force = process.argv.includes('--force');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diisi di .env.');
  }

  const source = JSON.parse(await fsp.readFile(DB_PATH, 'utf8'));
  const sourceApplicants = Array.isArray(source.applicants) ? source.applicants : [];
  if (!sourceApplicants.length) {
    throw new Error('Tidak ada data pendaftar di db/data.json.');
  }

  const currentRows = await supabaseRest('ppdb_applicants?select=registration_number');
  if (Array.isArray(currentRows) && currentRows.length && !force) {
    console.log(`Supabase sudah berisi ${currentRows.length} pendaftar. Jalankan dengan --force untuk merge/upsert data lokal.`);
    return;
  }

  let uploadedDocuments = 0;
  let missingDocuments = 0;
  const migratedApplicants = [];

  for (const applicant of sourceApplicants) {
    const migrated = await migrateApplicantDocuments(applicant);
    uploadedDocuments += migrated.uploadedCount;
    missingDocuments += migrated.missingCount;
    migratedApplicants.push(migrated.applicant);
  }

  const maxSequence = migratedApplicants.reduce((max, applicant) => {
    return Math.max(max, sequenceFromRegistrationNumber(applicant.registrationNumber));
  }, 0);
  const meta = {
    ...(source.meta || {}),
    lastSequence: Math.max(Number(source.meta?.lastSequence || 0), maxSequence)
  };

  await supabaseRest('ppdb_meta?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: mapMetaToSupabase(meta)
  });

  await supabaseRest('ppdb_applicants?on_conflict=registration_number', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: migratedApplicants.map(applicantRow)
  });

  console.log('Migrasi Supabase selesai.');
  console.log(`Pendaftar sumber: ${sourceApplicants.length}`);
  console.log(`Pendaftar dikirim: ${migratedApplicants.length}`);
  console.log(`Dokumen diunggah ke Storage: ${uploadedDocuments}`);
  if (missingDocuments) {
    console.log(`Dokumen yang metadata-nya ada tetapi file lokalnya tidak ditemukan: ${missingDocuments}`);
  }
}

main().catch(error => {
  console.error(`Migrasi Supabase gagal: ${error.message}`);
  process.exit(1);
});
