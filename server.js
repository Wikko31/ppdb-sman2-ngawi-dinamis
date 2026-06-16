const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminppdb';
const SCHOOL_NAME = process.env.SCHOOL_NAME || 'SMAN 2 NGAWI';
const REGISTRATION_YEAR = process.env.REGISTRATION_YEAR || '2026';

const ROOT_DIR = __dirname;
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

async function ensureDb() {
  await fsp.mkdir(DB_DIR, { recursive: true });
  try {
    await fsp.access(DB_PATH, fs.constants.F_OK);
  } catch {
    await writeDb(seedDatabase());
  }
}

async function readDb() {
  await ensureDb();
  const raw = await fsp.readFile(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

async function writeDb(data) {
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

async function clearUploadedDocuments() {
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

function makeRegistrationNumber(sequence) {
  return `PPDB-${REGISTRATION_YEAR}-${String(sequence).padStart(4, '0')}`;
}

function isAuthorized(req) {
  const headerPassword = req.headers['x-admin-password'];
  return Boolean(headerPassword && headerPassword === ADMIN_PASSWORD);
}

function requireAdmin(req, res) {
  if (!isAuthorized(req)) {
    sendJson(res, 401, {
      success: false,
      message: 'Akses admin ditolak. Password admin tidak valid.'
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
      time: new Date().toISOString()
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

    const nextSequence = Number(db.meta.lastSequence || 0) + 1;
    const now = new Date().toISOString();
    const registrationNumber = makeRegistrationNumber(nextSequence);
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

      const uploadDirectory = path.resolve(applicantUploadDir(registrationNumber));
      const filePath = path.resolve(uploadDirectory, documentMeta.fileName);
      if (!filePath.startsWith(`${uploadDirectory}${path.sep}`)) {
        return sendJson(res, 403, {
          success: false,
          message: 'Akses dokumen ditolak.'
        });
      }

      try {
        const body = await fsp.readFile(filePath);
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
    const freshDb = seedDatabase();
    await clearUploadedDocuments();
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

    await serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, {
      success: false,
      message: error.message || 'Terjadi kesalahan server.'
    });
  }
}

ensureDb()
  .then(() => {
    http.createServer(requestHandler).listen(PORT, () => {
      console.log(`PPDB ${SCHOOL_NAME} berjalan di http://localhost:${PORT}`);
      console.log(`Password admin: ${ADMIN_PASSWORD}`);
    });
  })
  .catch(error => {
    console.error('Gagal menyiapkan database:', error);
    process.exit(1);
  });
