const state = {
  adminToken: sessionStorage.getItem('ppdbAdminToken') || '',
  adminUsername: sessionStorage.getItem('ppdbAdminUsername') || '',
  rankingSearch: '',
  pathwayFilter: ''
};

const selectors = {
  navToggle: document.querySelector('#navToggle'),
  navLinks: document.querySelector('#navLinks'),
  registrationForm: document.querySelector('#registrationForm'),
  pathwaySelect: document.querySelector('#pathwaySelect'),
  achievementCertificate: document.querySelector('#achievementCertificate'),
  achievementRequiredText: document.querySelector('#achievementRequiredText'),
  formMessage: document.querySelector('#formMessage'),
  rankingBody: document.querySelector('#rankingBody'),
  rankingSearch: document.querySelector('#rankingSearch'),
  pathwayFilter: document.querySelector('#pathwayFilter'),
  statusKeyword: document.querySelector('#statusKeyword'),
  checkStatusBtn: document.querySelector('#checkStatusBtn'),
  statusResult: document.querySelector('#statusResult'),
  adminUsername: document.querySelector('#adminUsername'),
  adminPassword: document.querySelector('#adminPassword'),
  adminLoginBtn: document.querySelector('#adminLoginBtn'),
  adminLogin: document.querySelector('#adminLogin'),
  adminArea: document.querySelector('#adminArea'),
  adminBody: document.querySelector('#adminBody'),
  adminMessage: document.querySelector('#adminMessage'),
  exportCsvBtn: document.querySelector('#exportCsvBtn'),
  resetDataBtn: document.querySelector('#resetDataBtn'),
  logoutAdminBtn: document.querySelector('#logoutAdminBtn'),
  statApplicants: document.querySelector('#statApplicants'),
  statVerified: document.querySelector('#statVerified'),
  backToTop: document.querySelector('#backToTop'),
  toast: document.querySelector('#toast')
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatScore(value) {
  if (value === null || value === undefined || value === '') return '-';
  return Number(value).toFixed(2).replace(/\.00$/, '');
}

function statusClass(status) {
  return `status-${String(status || '').toLowerCase().replaceAll(' ', '-')}`;
}

function proofUrl(registrationNumber) {
  return `/bukti/${encodeURIComponent(registrationNumber)}`;
}

function adminAuthHeaders() {
  return state.adminToken ? { Authorization: `Bearer ${state.adminToken}` } : {};
}

function showToast(message) {
  selectors.toast.textContent = message;
  selectors.toast.classList.add('show');
  setTimeout(() => selectors.toast.classList.remove('show'), 2600);
}

function setMessage(element, message, type = 'success') {
  element.textContent = message || '';
  element.classList.remove('success', 'error');
  if (message) element.classList.add(type);
}

function setMessageHtml(element, html, type = 'success') {
  element.innerHTML = html || '';
  element.classList.remove('success', 'error');
  if (html) element.classList.add(type);
}

function updateAchievementRequirement() {
  const isPrestasi = selectors.pathwaySelect?.value === 'Prestasi';
  if (selectors.achievementCertificate) {
    selectors.achievementCertificate.required = isPrestasi;
  }
  if (selectors.achievementRequiredText) {
    selectors.achievementRequiredText.textContent = isPrestasi
      ? '(wajib untuk jalur Prestasi)'
      : '(khusus jalur Prestasi)';
  }
}

async function api(path, options = {}) {
  const headers = {
    ...(options.admin ? adminAuthHeaders() : {}),
    ...(options.headers || {})
  };

  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const request = { ...options, headers };
  delete request.admin;
  const response = await fetch(path, request);

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'string'
      ? payload
      : payload.message || payload.errors?.join(' ') || 'Request gagal.';
    throw new Error(message);
  }

  return payload;
}

async function loadRanking() {
  const params = new URLSearchParams();
  if (state.rankingSearch) params.set('search', state.rankingSearch);
  if (state.pathwayFilter) params.set('pathway', state.pathwayFilter);
  const result = await api(`/api/ranking?${params.toString()}`);
  renderRanking(result.data || []);
  updateStats(result.data || []);
}

function updateStats(rows) {
  selectors.statApplicants.textContent = rows.length;
  const verifiedCount = rows.filter(item => ['Terverifikasi', 'Diterima', 'Cadangan'].includes(item.status)).length;
  selectors.statVerified.textContent = verifiedCount;
}

function renderRanking(rows) {
  if (!rows.length) {
    selectors.rankingBody.innerHTML = '<tr><td colspan="8" class="muted-text">Belum ada data ranking.</td></tr>';
    return;
  }

  selectors.rankingBody.innerHTML = rows.map(item => `
    <tr>
      <td>${item.rank ? `<span class="rank-pill">${item.rank}</span>` : '<span class="muted-text">-</span>'}</td>
      <td>${escapeHtml(item.registrationNumber)}</td>
      <td>${escapeHtml(item.name)}<br><span class="muted-text">${escapeHtml(item.nisn)}</span></td>
      <td>${escapeHtml(item.pathway)}</td>
      <td>${formatScore(item.reportScore)}</td>
      <td>${formatScore(item.testScore)}</td>
      <td><strong>${formatScore(item.finalScore)}</strong></td>
      <td><span class="status-chip ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
    </tr>
  `).join('');
}

async function handleRegister(event) {
  event.preventDefault();
  setMessage(selectors.formMessage, 'Mengirim data pendaftaran...', 'success');

  const formData = new FormData(selectors.registrationForm);

  try {
    const result = await api('/api/register', {
      method: 'POST',
      body: formData
    });

    const number = result.applicant.registrationNumber;
    setMessageHtml(
      selectors.formMessage,
      `Pendaftaran dan dokumen berhasil dikirim. Nomor pendaftaran Anda: <strong>${escapeHtml(number)}</strong>. <a class="inline-link" href="${proofUrl(number)}" target="_blank" rel="noopener">Cetak bukti pendaftaran</a>.`,
      'success'
    );
    selectors.registrationForm.reset();
    selectors.statusKeyword.value = number;
    await loadRanking();
    showToast('Pendaftaran berhasil disimpan');
  } catch (error) {
    setMessage(selectors.formMessage, error.message, 'error');
  }
}

async function checkStatus() {
  const keyword = selectors.statusKeyword.value.trim();
  if (!keyword) {
    selectors.statusResult.className = 'status-result empty';
    selectors.statusResult.textContent = 'Masukkan nomor pendaftaran atau NISN terlebih dahulu.';
    return;
  }

  selectors.statusResult.className = 'status-result';
  selectors.statusResult.textContent = 'Mencari data pendaftaran...';

  try {
    const result = await api(`/api/status/${encodeURIComponent(keyword)}`);
    const item = result.applicant;
    selectors.statusResult.innerHTML = `
      <div class="status-grid">
        <div><strong>Nama</strong>${escapeHtml(item.name)}</div>
        <div><strong>No. Pendaftaran</strong>${escapeHtml(item.registrationNumber)}</div>
        <div><strong>NISN</strong>${escapeHtml(item.nisn)}</div>
        <div><strong>Jalur</strong>${escapeHtml(item.pathway)}</div>
        <div><strong>Nilai Rapor</strong>${formatScore(item.reportScore)}</div>
        <div><strong>Nilai Tes</strong>${formatScore(item.testScore)}</div>
        <div><strong>Nilai Akhir</strong>${formatScore(item.finalScore)}</div>
        <div><strong>Ranking</strong>${item.rank || '-'}</div>
        <div><strong>Status</strong><span class="status-chip ${statusClass(item.status)}">${escapeHtml(item.status)}</span></div>
        <div><strong>Catatan</strong>${escapeHtml(item.notes || '-')}</div>
      </div>
      <div class="proof-actions">
        <a class="btn btn-soft" href="${proofUrl(item.registrationNumber)}" target="_blank" rel="noopener">Cetak Bukti Pendaftaran</a>
      </div>
    `;
  } catch (error) {
    selectors.statusResult.className = 'status-result empty';
    selectors.statusResult.textContent = error.message;
  }
}

async function loginAdmin() {
  const username = selectors.adminUsername.value.trim();
  const password = selectors.adminPassword.value.trim();
  if (!username || !password) {
    setMessage(selectors.adminMessage, 'Masukkan username dan password admin terlebih dahulu.', 'error');
    return;
  }

  try {
    const result = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    state.adminToken = result.token;
    state.adminUsername = result.username;
    sessionStorage.setItem('ppdbAdminToken', result.token);
    sessionStorage.setItem('ppdbAdminUsername', result.username);
    sessionStorage.removeItem('ppdbAdminPassword');
    selectors.adminPassword.value = '';
    await loadAdmin();
    selectors.adminLogin.classList.add('hidden');
    selectors.adminArea.classList.remove('hidden');
    setMessage(selectors.adminMessage, 'Berhasil masuk panel admin.', 'success');
  } catch (error) {
    state.adminToken = '';
    state.adminUsername = '';
    sessionStorage.removeItem('ppdbAdminToken');
    sessionStorage.removeItem('ppdbAdminUsername');
    setMessage(selectors.adminMessage, error.message, 'error');
  }
}

async function loadAdmin() {
  const result = await api('/api/admin/applicants', { admin: true });
  renderAdmin(result.data || []);
}

function renderAdmin(rows) {
  if (!rows.length) {
    selectors.adminBody.innerHTML = '<tr><td colspan="7" class="muted-text">Belum ada pendaftar.</td></tr>';
    return;
  }

  selectors.adminBody.innerHTML = rows.map(item => `
    <tr data-id="${escapeHtml(item.registrationNumber)}">
      <td>${escapeHtml(item.registrationNumber)}<br><span class="muted-text">${escapeHtml(item.nisn)}</span><br><a class="inline-link small-link" href="${proofUrl(item.registrationNumber)}" target="_blank" rel="noopener">Bukti</a></td>
      <td>${escapeHtml(item.name)}<br><span class="muted-text">${escapeHtml(item.pathway)}</span></td>
      <td><input type="number" min="0" max="100" step="0.01" data-field="testScore" value="${item.testScore ?? ''}" placeholder="0-100"></td>
      <td>
        <select data-field="status">
          ${['Menunggu Verifikasi', 'Terverifikasi', 'Cadangan', 'Diterima', 'Ditolak'].map(status => `<option value="${status}" ${status === item.status ? 'selected' : ''}>${status}</option>`).join('')}
        </select>
      </td>
      <td><textarea rows="2" data-field="notes" placeholder="Catatan admin">${escapeHtml(item.notes || '')}</textarea></td>
      <td>${renderDocumentList(item)}</td>
      <td><button class="btn btn-primary save-admin-btn">Simpan</button></td>
    </tr>
  `).join('');
}

function renderDocumentList(item) {
  const documents = item.documents || [];
  if (!documents.length) {
    return '<span class="document-missing">Belum ada dokumen</span>';
  }

  return `
    <div class="document-links">
      ${documents.map(doc => doc.uploaded ? `
        <button type="button" class="document-link download-document-btn" data-registration="${escapeHtml(item.registrationNumber)}" data-document="${escapeHtml(doc.key)}">${escapeHtml(doc.label)}</button>
      ` : `
        <span class="document-missing">${escapeHtml(doc.label)}: belum diunggah</span>
      `).join('')}
    </div>
  `;
}

async function saveAdminRow(button) {
  const row = button.closest('tr');
  const registrationNumber = row.dataset.id;
  const payload = {
    testScore: row.querySelector('[data-field="testScore"]').value,
    status: row.querySelector('[data-field="status"]').value,
    notes: row.querySelector('[data-field="notes"]').value
  };

  try {
    await api(`/api/admin/applicants/${encodeURIComponent(registrationNumber)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      admin: true
    });
    setMessage(selectors.adminMessage, `Data ${registrationNumber} berhasil diperbarui.`, 'success');
    await Promise.all([loadRanking(), loadAdmin()]);
    showToast('Data berhasil disimpan');
  } catch (error) {
    setMessage(selectors.adminMessage, error.message, 'error');
  }
}

async function exportCsv() {
  try {
    const response = await fetch('/api/admin/export', {
      headers: adminAuthHeaders()
    });
    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.message || 'Gagal ekspor CSV.');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data-ppdb-sman2-ngawi.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('CSV berhasil dibuat');
  } catch (error) {
    setMessage(selectors.adminMessage, error.message, 'error');
  }
}

async function downloadDocument(button) {
  const registrationNumber = button.dataset.registration;
  const documentKey = button.dataset.document;

  try {
    const response = await fetch(`/api/admin/applicants/${encodeURIComponent(registrationNumber)}/documents/${encodeURIComponent(documentKey)}`, {
      headers: adminAuthHeaders()
    });

    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.message || 'Dokumen gagal diunduh.');
    }

    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const filenameMatch = disposition.match(/filename="([^"]+)"/);
    const filename = filenameMatch ? filenameMatch[1] : `${registrationNumber}-${documentKey}`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Dokumen berhasil diunduh');
  } catch (error) {
    setMessage(selectors.adminMessage, error.message, 'error');
  }
}

async function resetData() {
  const confirmed = confirm('Reset data pendaftaran? Data tambahan akan hilang.');
  if (!confirmed) return;

  try {
    await api('/api/admin/reset', { method: 'POST', admin: true });
    await Promise.all([loadRanking(), loadAdmin()]);
    setMessage(selectors.adminMessage, 'Data berhasil direset.', 'success');
    showToast('Data berhasil direset');
  } catch (error) {
    setMessage(selectors.adminMessage, error.message, 'error');
  }
}

function logoutAdmin(message = 'Anda keluar dari panel admin.') {
  state.adminToken = '';
  state.adminUsername = '';
  sessionStorage.removeItem('ppdbAdminToken');
  sessionStorage.removeItem('ppdbAdminUsername');
  sessionStorage.removeItem('ppdbAdminPassword');
  selectors.adminUsername.value = '';
  selectors.adminPassword.value = '';
  selectors.adminLogin.classList.remove('hidden');
  selectors.adminArea.classList.add('hidden');
  setMessage(selectors.adminMessage, message, 'success');
}

function setupNavigation() {
  selectors.navToggle.addEventListener('click', () => selectors.navLinks.classList.toggle('show'));
  selectors.navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => selectors.navLinks.classList.remove('show'));
  });

  window.addEventListener('scroll', () => {
    selectors.backToTop.classList.toggle('show', window.scrollY > 600);
  });
  selectors.backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function setupRevealAnimation() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
}

function debounce(callback, delay = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}

function setupEvents() {
  updateAchievementRequirement();
  selectors.registrationForm.addEventListener('submit', handleRegister);
  selectors.pathwaySelect.addEventListener('change', updateAchievementRequirement);
  selectors.checkStatusBtn.addEventListener('click', checkStatus);
  selectors.statusKeyword.addEventListener('keydown', event => {
    if (event.key === 'Enter') checkStatus();
  });

  selectors.rankingSearch.addEventListener('input', debounce(event => {
    state.rankingSearch = event.target.value.trim();
    loadRanking().catch(error => showToast(error.message));
  }));

  selectors.pathwayFilter.addEventListener('change', event => {
    state.pathwayFilter = event.target.value;
    loadRanking().catch(error => showToast(error.message));
  });

  selectors.adminLoginBtn.addEventListener('click', loginAdmin);
  selectors.adminUsername.addEventListener('keydown', event => {
    if (event.key === 'Enter') loginAdmin();
  });
  selectors.adminPassword.addEventListener('keydown', event => {
    if (event.key === 'Enter') loginAdmin();
  });

  selectors.adminBody.addEventListener('click', event => {
    if (event.target.classList.contains('save-admin-btn')) {
      saveAdminRow(event.target);
    }
    if (event.target.classList.contains('download-document-btn')) {
      downloadDocument(event.target);
    }
  });

  selectors.exportCsvBtn.addEventListener('click', exportCsv);
  selectors.resetDataBtn.addEventListener('click', resetData);
  selectors.logoutAdminBtn.addEventListener('click', logoutAdmin);
}

async function init() {
  setupNavigation();
  setupRevealAnimation();
  setupEvents();
  await loadRanking();

  sessionStorage.removeItem('ppdbAdminPassword');
  if (state.adminUsername) {
    selectors.adminUsername.value = state.adminUsername;
  }

  if (state.adminToken) {
    const tokenAtInit = state.adminToken;
    selectors.adminLogin.classList.add('hidden');
    selectors.adminArea.classList.remove('hidden');
    loadAdmin().catch(() => {
      if (state.adminToken === tokenAtInit) {
        logoutAdmin('Sesi admin berakhir. Silakan masuk kembali.');
      }
    });
  }
}

init().catch(error => {
  console.error(error);
  showToast('Gagal memuat aplikasi');
});
