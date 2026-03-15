/* =====================================================
   Campus Lost & Found — script.js
   Wired to Node.js + Express REST API
   ===================================================== */

'use strict';

// ── API Configuration ─────────────────────────────────────────
const API_BASE = 'http://localhost:3000/api';

// ── Helpers ───────────────────────────────────────────────────
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ── Token management ──────────────────────────────────────────
const Auth = {
  getToken:  ()        => localStorage.getItem('clf_token'),
  setToken:  (token)   => localStorage.setItem('clf_token', token),
  getUser:   ()        => { try { return JSON.parse(localStorage.getItem('clf_user')); } catch { return null; } },
  setUser:   (user)    => localStorage.setItem('clf_user', JSON.stringify(user)),
  clear:     ()        => { localStorage.removeItem('clf_token'); localStorage.removeItem('clf_user'); },
  isLoggedIn:()        => !!Auth.getToken(),
  isAdmin:   ()        => Auth.getUser()?.role === 'admin',
};

// ── API fetch wrapper ─────────────────────────────────────────
async function api(method, endpoint, body = null, isFormData = false) {
  const headers = {};
  const token   = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body) opts.body = isFormData ? body : JSON.stringify(body);

  try {
    const res  = await fetch(`${API_BASE}${endpoint}`, opts);
    const data = await res.json();

    if (res.status === 401) {
      Auth.clear();
      if (!location.pathname.includes('login')) location.href = 'login.html';
      return null;
    }
    return { ok: res.ok, status: res.status, ...data };
  } catch (err) {
    console.error('API error:', err);
    toast('Network error. Is the server running?', 'error');
    return null;
  }
}

// ── Toast notifications ───────────────────────────────────────
function toast(msg, type = 'info', duration = 3400) {
  let wrap = $('#toast-container');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toast-container';
    document.body.appendChild(wrap);
  }
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const el    = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity   = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = 'all .25s';
    setTimeout(() => el.remove(), 270);
  }, duration);
}

// ── Modal helpers ─────────────────────────────────────────────
function openModal(id)  {
  const el = $(`#${id}`);
  if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const el = $(`#${id}`);
  if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
}
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop'))  { e.target.classList.remove('open'); document.body.style.overflow = ''; }
  if (e.target.dataset.modalClose) closeModal(e.target.dataset.modalClose);
  if (e.target.dataset.modalOpen)  openModal(e.target.dataset.modalOpen);
});

// ── Set active nav link ───────────────────────────────────────
function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  $$('.nav-link[data-page]').forEach(l => l.classList.toggle('active', l.dataset.page === page));

  // Show/hide admin nav link based on role
  const adminLink = $('.nav-link[data-page="admin.html"]');
  if (adminLink) adminLink.style.display = Auth.isAdmin() ? '' : 'none';

  // Update avatar initials
  const user = Auth.getUser();
  $$('.avatar').forEach(av => {
    if (user) {
      const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
      av.textContent = initials;
      av.title = user.name;
    }
  });
}

// ── Guard: redirect to login if not authenticated ─────────────
function requireLogin() {
  if (!Auth.isLoggedIn()) {
    location.href = 'login.html';
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════
//  PAGE: LOGIN / REGISTER
// ═══════════════════════════════════════════════════════════════
function initAuth() {
  const loginBlock  = $('#loginBlock');
  const signupBlock = $('#signupBlock');
  if (!loginBlock) return;

  // Already logged in → go to dashboard
  if (Auth.isLoggedIn()) { location.href = 'dashboard.html'; return; }

  // Toggle panels
  const show = (show, hide) => {
    hide.classList.add('hidden');
    show.classList.remove('hidden');
    show.style.animation = 'fadeUp .35s ease both';
  };
  $('#switchToSignup')?.addEventListener('click', e => { e.preventDefault(); show(signupBlock, loginBlock); });
  $('#switchToLogin')?.addEventListener('click',  e => { e.preventDefault(); show(loginBlock, signupBlock); });

  // ── Login ───────────────────────────────────────────────────
  $('#btnLogin')?.addEventListener('click', async () => {
    const email    = $('#loginEmail')?.value.trim();
    const password = $('#loginPass')?.value;
    if (!email || !password) { toast('Please fill in all fields.', 'error'); return; }

    const btn = $('#btnLogin');
    btn.textContent = 'Signing in…';
    btn.disabled    = true;

    const res = await api('POST', '/auth/login', { email, password });
    btn.textContent = 'Sign in →';
    btn.disabled    = false;

    if (!res?.ok) {
      toast(res?.error || 'Login failed.', 'error');
      return;
    }
    Auth.setToken(res.data.token);
    Auth.setUser(res.data.user);
    toast('Welcome back, ' + res.data.user.name.split(' ')[0] + '!', 'success', 1500);
    setTimeout(() => location.href = 'dashboard.html', 900);
  });

  // ── Register ────────────────────────────────────────────────
  $('#btnSignup')?.addEventListener('click', async () => {
    const name       = $('#signupName')?.value.trim();
    const email      = $('#signupEmail')?.value.trim();
    const password   = $('#signupPass')?.value;
    const role       = $('#signupRole')?.value || 'user';
    const department = $('#signupYear')?.value.trim() || '';

    if (!name || !email || !password) { toast('Please fill in all required fields.', 'error'); return; }
    if (password.length < 6) { toast('Password must be at least 6 characters.', 'error'); return; }

    const btn = $('#btnSignup');
    btn.textContent = 'Creating account…';
    btn.disabled    = true;

    const res = await api('POST', '/auth/register', { name, email, password, role, department });
    btn.textContent = 'Create account →';
    btn.disabled    = false;

    if (!res?.ok) {
      const msg = res?.errors?.[0]?.msg || res?.error || 'Registration failed.';
      toast(msg, 'error');
      return;
    }
    Auth.setToken(res.data.token);
    Auth.setUser(res.data.user);
    toast('Account created! Welcome to Campus L&F.', 'success', 1800);
    setTimeout(() => location.href = 'dashboard.html', 1100);
  });

  // Allow Enter key to submit login
  $$('#loginBlock input').forEach(inp => {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnLogin')?.click(); });
  });
}

// ═══════════════════════════════════════════════════════════════
//  PAGE: DASHBOARD
// ═══════════════════════════════════════════════════════════════
async function initDashboard() {
  if (!$('#tab-lost')) return;

  // ── Render stat cards ──────────────────────────────────────
  async function loadStats() {
    const res = await api('GET', '/items/stats');
    if (!res?.ok) return;
    const s = res.data;
    const statMap = {
      'stat-lost':    s.lost,
      'stat-found':   s.found,
      'stat-claimed': s.pending_claims,
      'stat-returned':s.returned,
    };
    for (const [id, val] of Object.entries(statMap)) {
      const el = $(`#${id}`);
      if (el) el.textContent = val ?? 0;
    }
  }

  // ── Build item card HTML ───────────────────────────────────
  function itemCardHTML(item) {
    const imgSrc  = item.image_url || `https://picsum.photos/seed/${item.id}/400/250`;
    const statusClass = { lost:'badge-lost', found:'badge-found', claimed:'badge-claimed', returned:'badge-returned' }[item.status] || 'badge-neutral';
    const dateStr = item.date_lost ? new Date(item.date_lost).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '';
    return `
      <div data-card-wrap>
        <a href="item-details.html?id=${item.id}" class="item-card" data-status="${item.status}">
          <div class="item-card-img">
            <img src="${imgSrc}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='https://picsum.photos/seed/${item.id}/400/250'">
            <div class="card-badge-wrap">
              <span class="badge ${statusClass}"><span class="badge-dot"></span>${capitalize(item.status)}</span>
            </div>
          </div>
          <div class="item-card-body">
            <div class="item-card-title">${escapeHtml(item.title)}</div>
            <div class="item-card-meta">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              ${escapeHtml(item.location)}
            </div>
            <div class="item-card-meta">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              ${dateStr}
            </div>
            <div class="item-card-footer">
              <span class="badge badge-neutral">${escapeHtml(item.category)}</span>
              <span class="text-xs text-muted">by ${escapeHtml(item.reporter_name || 'Unknown')}</span>
            </div>
          </div>
        </a>
      </div>`;
  }

  // ── Load and render items ──────────────────────────────────
  async function loadItems(type, gridId, params = {}) {
    const grid = $(`#${gridId}`);
    if (!grid) return;
    grid.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--ink-3);">Loading…</div>';

    const qs  = new URLSearchParams({ type, limit: 6, ...params }).toString();
    const res = await api('GET', `/items?${qs}`);

    if (!res?.ok || !res.data?.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;" class="empty-state"><div class="empty-icon">📭</div><p class="empty-msg">No ${type} items found.</p></div>`;
      return;
    }
    grid.innerHTML = res.data.map(itemCardHTML).join('');
  }

  // ── Tabs ───────────────────────────────────────────────────
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === btn.dataset.tab));
    });
  });

  // ── Filter chips ───────────────────────────────────────────
  let activeFilter = 'all';
  $$('.chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('.chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;
      const status = activeFilter === 'all' ? undefined : activeFilter;
      loadItems('lost',  'grid-lost',  status ? { status } : {});
      loadItems('found', 'grid-found', status ? { status } : {});
    });
  });

  // ── Live search ────────────────────────────────────────────
  const searchInput = $('#globalSearch');
  searchInput?.addEventListener('input', debounce(e => {
    const q = e.target.value.trim();
    loadItems('lost',  'grid-lost',  q ? { q } : {});
    loadItems('found', 'grid-found', q ? { q } : {});
  }, 320));

  // ── Initial load ───────────────────────────────────────────
  await Promise.all([
    loadStats(),
    loadItems('lost',  'grid-lost'),
    loadItems('found', 'grid-found'),
  ]);
}

// ═══════════════════════════════════════════════════════════════
//  PAGE: REPORT LOST / FOUND
// ═══════════════════════════════════════════════════════════════
function initReportForm() {
  const form = $('#reportForm');
  if (!form) return;
  if (!requireLogin()) return;

  // Determine type from page filename
  const isFound = location.pathname.includes('report-found');
  const type    = isFound ? 'found' : 'lost';

  // Set hidden type field
  const typeField = $('[name="type"]', form);
  if (typeField) typeField.value = type;

  // ── File upload preview ──────────────────────────────────
  initFileUploads();

  // ── Submit ────────────────────────────────────────────────
  $('#submitReport')?.addEventListener('click', async () => {
    const itemName = $('[name="itemName"]', form)?.value.trim();
    const category = $('[name="category"]', form)?.value;
    const location = $('[name="locationLost"] , [name="locationFound"]', form)?.value?.trim();
    const date     = $('[name="dateLost"]     , [name="dateFound"]',     form)?.value;
    const desc     = $('[name="description"]', form)?.value?.trim();

    if (!itemName) { toast('Item name is required.', 'error'); return; }
    if (!category) { toast('Please select a category.', 'error'); return; }
    if (!location) { toast('Location is required.', 'error'); return; }
    if (!date)     { toast('Date is required.', 'error'); return; }

    const btn = $('#submitReport');
    btn.textContent = 'Submitting…';
    btn.disabled    = true;

    // Build FormData to support file upload
    const fd = new FormData();
    fd.append('title',      itemName);
    fd.append('type',       type);
    fd.append('category',   category);
    fd.append('location',   location);
    fd.append('date_lost',  date);
    fd.append('description', desc || '');

    const timeField = $('[name="timeLost"], [name="timeFound"]', form);
    if (timeField?.value) fd.append('time_lost', timeField.value);

    const colorField = $('[name="color"]', form);
    if (colorField?.value) fd.append('color', colorField.value);

    const fileInput = $('input[type="file"]', form);
    if (fileInput?.files?.[0]) fd.append('image', fileInput.files[0]);

    const res = await api('POST', '/items', fd, true /* isFormData */);
    btn.textContent = type === 'lost' ? 'Submit Lost Report' : 'Submit Found Report';
    btn.disabled    = false;

    if (!res?.ok) {
      const msg = res?.errors?.[0]?.msg || res?.error || 'Failed to submit report.';
      toast(msg, 'error');
      return;
    }

    toast('Item reported successfully!', 'success');
    setTimeout(() => location.href = 'dashboard.html', 1400);
  });
}

// ═══════════════════════════════════════════════════════════════
//  PAGE: ITEM DETAILS
// ═══════════════════════════════════════════════════════════════
async function initItemDetails() {
  const container = $('#itemDetailContainer');
  if (!container) return;

  const params = new URLSearchParams(location.search);
  const itemId = params.get('id');
  if (!itemId) { container.innerHTML = '<p class="text-muted">No item ID provided.</p>'; return; }

  // ── Fetch item ─────────────────────────────────────────────
  const res = await api('GET', `/items/${itemId}`);
  if (!res?.ok) {
    container.innerHTML = '<p class="text-muted">Item not found or unavailable.</p>';
    return;
  }
  const item = res.data;

  // ── Update page title ──────────────────────────────────────
  document.title = `${item.title} — Campus Lost & Found`;

  // ── Render image ───────────────────────────────────────────
  const imgEl = $('#detailImg');
  if (imgEl) {
    imgEl.src   = item.image_url || `https://picsum.photos/seed/${item.id}/800/600`;
    imgEl.alt   = item.title;
    imgEl.onerror = () => { imgEl.src = `https://picsum.photos/seed/${item.id}/800/600`; };
  }

  // ── Render title & description ─────────────────────────────
  const titleEl = $('#detailTitle');
  if (titleEl) titleEl.textContent = item.title;

  const descEl = $('#detailDesc');
  if (descEl) descEl.textContent = item.description || 'No description provided.';

  // ── Status badge ───────────────────────────────────────────
  const statusEl = $('#detailStatus');
  if (statusEl) {
    const cls = { lost:'badge-lost', found:'badge-found', claimed:'badge-claimed', returned:'badge-returned' }[item.status] || '';
    statusEl.className = `badge ${cls}`;
    statusEl.innerHTML = `<span class="badge-dot"></span>${capitalize(item.status)}`;
  }

  // ── Meta rows ──────────────────────────────────────────────
  const set = (id, val) => { const el = $(`#${id}`); if (el) el.textContent = val || '—'; };
  set('detailLocation',  item.location);
  set('detailDate',      item.date_lost ? new Date(item.date_lost).toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'long', year:'numeric' }) : null);
  set('detailCategory',  item.category);
  set('detailReporter',  item.reporter_name ? `${item.reporter_name} (${item.reporter_department || 'N/A'})` : 'Anonymous');
  set('detailId',        `#LF-${String(item.id).padStart(4,'0')}`);

  // ── Breadcrumb ─────────────────────────────────────────────
  const bcCurrent = $('#bcCurrent');
  if (bcCurrent) bcCurrent.textContent = item.title;

  // ── Claim button logic ─────────────────────────────────────
  const btnClaim = $('#btnClaim');
  if (btnClaim) {
    const user = Auth.getUser();

    if (!user) {
      btnClaim.textContent = 'Sign in to Claim';
      btnClaim.addEventListener('click', () => location.href = 'login.html');
    } else if (item.user_id === user.id) {
      btnClaim.textContent = 'Your Item';
      btnClaim.disabled    = true;
      btnClaim.classList.replace('btn-teal', 'btn-outline');
    } else if (item.status === 'returned') {
      btnClaim.textContent = 'Already Returned';
      btnClaim.disabled    = true;
      btnClaim.classList.replace('btn-teal', 'btn-outline');
    } else {
      btnClaim.addEventListener('click', () => openModal('claimModal'));
    }
  }

  // ── Submit claim ───────────────────────────────────────────
  $('#submitClaim')?.addEventListener('click', async () => {
    if (!Auth.isLoggedIn()) { location.href = 'login.html'; return; }

    const message = $('#claimDescription')?.value.trim();
    const contact = $('#claimContact')?.value.trim();

    if (!message || message.length < 20) {
      toast('Please describe why this item belongs to you (min. 20 characters).', 'error');
      return;
    }

    const btn = $('#submitClaim');
    btn.textContent = 'Submitting…';
    btn.disabled    = true;

    const res = await api('POST', '/claims', { item_id: Number(itemId), message, contact });
    btn.textContent = 'Submit Claim';
    btn.disabled    = false;

    if (!res?.ok) {
      const msg = res?.errors?.[0]?.msg || res?.error || 'Failed to submit claim.';
      toast(msg, 'error');
      return;
    }

    closeModal('claimModal');
    toast("Claim submitted! You'll be notified within 24 hours.", 'success', 4500);

    // Update button state
    if (btnClaim) {
      btnClaim.textContent = 'Claim Submitted ✓';
      btnClaim.disabled    = true;
      btnClaim.classList.replace('btn-teal', 'btn-outline');
    }
    if (statusEl) {
      statusEl.className = 'badge badge-claimed';
      statusEl.innerHTML = '<span class="badge-dot"></span>Claimed';
    }
  });

  // ── Load similar items ─────────────────────────────────────
  const similarGrid = $('#similarItems');
  if (similarGrid) {
    const sim = await api('GET', `/items?category=${encodeURIComponent(item.category)}&limit=3`);
    if (sim?.ok && sim.data?.length) {
      const others = sim.data.filter(i => i.id !== item.id).slice(0, 2);
      if (others.length) {
        similarGrid.innerHTML = others.map(i => `
          <a href="item-details.html?id=${i.id}" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);transition:background .15s;" onmouseover="this.style.background='#FAFAF9'" onmouseout="this.style.background=''">
            <img src="${i.image_url || `https://picsum.photos/seed/${i.id}/60/45`}" alt="" style="width:56px;height:42px;border-radius:6px;object-fit:cover;border:1px solid var(--border);flex-shrink:0;">
            <div>
              <div class="fw-500 text-sm">${escapeHtml(i.title)}</div>
              <div class="text-xs text-muted">${escapeHtml(i.location)}</div>
            </div>
            <span class="badge badge-${i.status}" style="margin-left:auto;flex-shrink:0;"><span class="badge-dot"></span>${capitalize(i.status)}</span>
          </a>`).join('');
      } else {
        similarGrid.innerHTML = '<p class="text-xs text-muted" style="padding:16px;">No similar items found.</p>';
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  PAGE: ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════
async function initAdmin() {
  const adminTable = $('#adminTable');
  if (!adminTable) return;
  if (!requireLogin()) return;
  if (!Auth.isAdmin()) { toast('Admin access required.', 'error'); setTimeout(() => location.href = 'dashboard.html', 1500); return; }

  // ── Load stats ─────────────────────────────────────────────
  async function loadAdminStats() {
    const res = await api('GET', '/admin/stats');
    if (!res?.ok) return;
    const s = res.data.items;
    [['stat-lost',s.lost],['stat-found',s.found],['stat-claimed',s.claimed],['stat-returned',s.returned]]
      .forEach(([id,val]) => { const el = $(`#${id}`); if (el) el.textContent = val ?? 0; });
  }

  // ── Build table row ────────────────────────────────────────
  function buildRow(item) {
    const imgSrc    = item.image_url || `https://picsum.photos/seed/${item.id}/48/36`;
    const statusCls = { lost:'badge-lost', found:'badge-found', claimed:'badge-claimed', returned:'badge-returned' }[item.status] || '';
    const dateStr   = item.date_lost ? new Date(item.date_lost).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—';

    const actions = item.status !== 'returned'
      ? `<button class="btn btn-success btn-sm btn-approve" data-id="${item.id}">✓ Approve</button>
         <button class="btn btn-danger btn-sm btn-reject"  data-id="${item.id}">✕ Reject</button>
         <a href="item-details.html?id=${item.id}" class="btn btn-ghost btn-sm">View</a>`
      : `<span class="text-sm text-muted fw-500">Resolved</span>`;

    return `
      <tr data-status="${item.status}" data-item-id="${item.id}">
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <img src="${imgSrc}" alt="" style="width:44px;height:33px;border-radius:6px;object-fit:cover;border:1px solid var(--border);flex-shrink:0;" onerror="this.src='https://picsum.photos/seed/${item.id}/48/36'">
            <div>
              <div class="td-name">${escapeHtml(item.title)}</div>
              <div class="td-sub">${escapeHtml(item.category)}</div>
            </div>
          </div>
        </td>
        <td class="status-cell"><span class="badge ${statusCls}"><span class="badge-dot"></span>${capitalize(item.status)}</span></td>
        <td>
          <div class="td-name">${escapeHtml(item.reporter_name || '—')}</div>
          <div class="td-sub">${escapeHtml(item.reporter_department || '')}</div>
        </td>
        <td>${escapeHtml(item.location)}</td>
        <td class="text-sm text-muted">${dateStr}</td>
        <td>
          <span class="claims-count ${item.pending_claims > 0 ? 'high' : ''}">${item.pending_claims || 0}</span>
        </td>
        <td class="action-cell"><div class="td-actions">${actions}</div></td>
      </tr>`;
  }

  // ── Load all items into table ──────────────────────────────
  async function loadAdminItems(filters = {}) {
    const tbody = adminTable.querySelector('tbody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--ink-3);">Loading…</td></tr>';

    const qs  = new URLSearchParams({ limit: 50, ...filters }).toString();
    const res = await api('GET', `/admin/items?${qs}`);

    if (!res?.ok || !res.data?.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--ink-3);">No items found.</td></tr>';
      return;
    }
    tbody.innerHTML = res.data.map(buildRow).join('');

    // Update count
    const countEl = $('#adminItemCount');
    if (countEl) countEl.textContent = `Showing ${res.data.length} of ${res.meta?.total || res.data.length} items`;
  }

  // ── Approve / Reject via event delegation ─────────────────
  adminTable.addEventListener('click', async e => {
    // APPROVE
    const approveBtn = e.target.closest('.btn-approve');
    if (approveBtn) {
      const itemId = approveBtn.dataset.id;
      // Get pending claims for this item
      const claimsRes = await api('GET', `/claims/item/${itemId}`);
      if (!claimsRes?.ok || !claimsRes.data?.length) {
        toast('No pending claims to approve for this item.', 'error');
        return;
      }
      const pending = claimsRes.data.find(c => c.status === 'pending');
      if (!pending) { toast('No pending claim found.', 'error'); return; }

      const res = await api('PUT', `/admin/claims/${pending.id}/approve`);
      if (!res?.ok) { toast(res?.error || 'Failed to approve.', 'error'); return; }

      // Update row in-place
      const row = approveBtn.closest('tr');
      row.querySelector('.status-cell').innerHTML = '<span class="badge badge-returned"><span class="badge-dot"></span>Returned</span>';
      row.querySelector('.action-cell').innerHTML = '<span class="text-sm text-muted fw-500">Resolved</span>';
      row.dataset.status = 'returned';
      toast('Claim approved — item marked as Returned.', 'success');
      loadAdminStats();
      return;
    }

    // REJECT
    const rejectBtn = e.target.closest('.btn-reject');
    if (rejectBtn) {
      const itemId = rejectBtn.dataset.id;
      const claimsRes = await api('GET', `/claims/item/${itemId}`);
      if (!claimsRes?.ok || !claimsRes.data?.length) {
        // No claim exists — just toast
        toast('No pending claims for this item.', 'error');
        return;
      }
      const pending = claimsRes.data.find(c => c.status === 'pending');
      if (!pending) { toast('No pending claim found.', 'error'); return; }

      const res = await api('PUT', `/admin/claims/${pending.id}/reject`);
      if (!res?.ok) { toast(res?.error || 'Failed to reject.', 'error'); return; }

      const row = rejectBtn.closest('tr');
      row.querySelector('.status-cell').innerHTML = `<span class="badge badge-lost"><span class="badge-dot"></span>${capitalize(res.data?.item_type || 'lost')}</span>`;
      row.querySelector('.claims-count').textContent = '0';
      row.querySelector('.action-cell').innerHTML = `
        <div class="td-actions">
          <button class="btn btn-success btn-sm btn-approve" data-id="${itemId}">✓ Approve</button>
          <button class="btn btn-danger btn-sm btn-reject"  data-id="${itemId}">✕ Reject</button>
          <a href="item-details.html?id=${itemId}" class="btn btn-ghost btn-sm">View</a>
        </div>`;
      toast('Claim rejected.', 'info');
      loadAdminStats();
    }
  });

  // ── Filter chips ───────────────────────────────────────────
  $$('.admin-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('.admin-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const filter = chip.dataset.filter;
      loadAdminItems(filter && filter !== 'all' ? { status: filter } : {});
    });
  });

  // ── Admin search ───────────────────────────────────────────
  $('#adminSearch')?.addEventListener('input', debounce(e => {
    const q = e.target.value.trim();
    loadAdminItems(q ? { q } : {});
  }, 280));

  // ── Initial load ───────────────────────────────────────────
  await Promise.all([loadAdminStats(), loadAdminItems()]);
}

// ═══════════════════════════════════════════════════════════════
//  SHARED: File upload preview
// ═══════════════════════════════════════════════════════════════
function initFileUploads() {
  $$('.file-drop').forEach(drop => {
    const input   = $('input[type=file]', drop);
    const preview = drop.closest('.form-group')?.querySelector('.file-preview')
                 || $('#filePreview');

    drop.addEventListener('click', () => input?.click());
    drop.addEventListener('dragover',  e => { e.preventDefault(); drop.classList.add('drag-over'); });
    drop.addEventListener('dragleave', ()=> drop.classList.remove('drag-over'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) previewFile(file, drop, preview);
    });
    input?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) previewFile(file, drop, preview);
    });
  });
}

function previewFile(file, drop, preview) {
  if (!file.type.startsWith('image/')) { toast('Please upload an image file.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    if (preview) {
      preview.style.display = 'block';
      let img = $('img', preview);
      if (!img) { img = document.createElement('img'); preview.appendChild(img); }
      img.src = ev.target.result;
      const nm = preview.querySelector('.file-preview-name');
      if (nm) nm.textContent = file.name;
    }
    const lbl = drop.querySelector('.file-drop-title');
    if (lbl) lbl.textContent = `✓ ${file.name}`;
  };
  reader.readAsDataURL(file);
}

// ═══════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Logout handler
document.addEventListener('click', e => {
  if (e.target.closest('#btnLogout')) {
    Auth.clear();
    location.href = 'login.html';
  }
});

// ═══════════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  initAuth();
  initDashboard();
  initReportForm();
  initItemDetails();
  initAdmin();
  initFileUploads();
});
