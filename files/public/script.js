/* =====================================================
   TraceUp — script.js
   Wired to Node.js + Express REST API
   ===================================================== */

'use strict';

// ── API Configuration ─────────────────────────────────────────
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
const API_BASE = isLocal && window.location.port !== '3000' 
  ? 'http://localhost:3000/api' 
  : `${window.location.origin}/api`;

// ── Helpers ───────────────────────────────────────────────────
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

const THEME_KEY = 'traceup_theme';
const THEME_SWITCH_MS = 420;

function resolveTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme, persist = true, animate = false) {
  const root = document.documentElement;
  const setTheme = () => {
    root.setAttribute('data-theme', theme);
    if (persist) localStorage.setItem(THEME_KEY, theme);
  };

  if (!animate) {
    setTheme();
    return;
  }

  if (typeof document.startViewTransition === 'function') {
    document.startViewTransition(() => setTheme());
    return;
  }

  root.classList.add('theme-transitioning');
  requestAnimationFrame(() => setTheme());
  window.setTimeout(() => root.classList.remove('theme-transitioning'), THEME_SWITCH_MS + 70);
}

function initThemeToggle() {
  const initialTheme = resolveTheme();
  applyTheme(initialTheme, false);

  if ($('#themeToggle')) return;

  const btn = document.createElement('button');
  btn.id = 'themeToggle';
  btn.type = 'button';
  btn.className = 'theme-toggle-btn';

  const setLabel = () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.textContent = dark ? '☀ Light' : '🌙 Dark';
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    btn.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
  };

  const navHost = $('.nav-links');
  const landingHost = $('.landing-top-actions');
  const authCard = $('.auth-card');

  if (navHost) {
    navHost.appendChild(btn);
  } else if (landingHost) {
    landingHost.appendChild(btn);
  } else if (authCard) {
    btn.classList.add('theme-toggle-fab');
    authCard.appendChild(btn);
  } else {
    btn.classList.add('theme-toggle-floating');
    document.body.appendChild(btn);
  }

  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next, true, true);
    setLabel();
  });

  // Follow OS preference only when user hasn't explicitly chosen a theme.
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = (event) => {
    if (localStorage.getItem(THEME_KEY)) return;
    applyTheme(event.matches ? 'dark' : 'light', false, true);
    setLabel();
  };
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', onSystemChange);
  } else if (typeof mql.addListener === 'function') {
    mql.addListener(onSystemChange);
  }

  setLabel();
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
function resolveCurrentPage() {
  let page = location.pathname.split('/').pop() || 'index.html';
  if (/^\/chat\/[0-9a-f-]+$/i.test(location.pathname)) page = 'chat.html';
  if (location.pathname === '/admin/chats') page = 'admin-chats.html';
  return page;
}

function setActiveNav() {
  const page = resolveCurrentPage();
  $$('.nav-link[data-page]').forEach(l => l.classList.toggle('active', l.dataset.page === page));

  // Show/hide admin nav link based on role
  const adminLink = $('.nav-link[data-page="admin.html"]');
  if (adminLink) adminLink.style.display = Auth.isAdmin() ? '' : 'none';

  // Update avatar initials
  const user = Auth.getUser();
  $$('.avatar').forEach(av => {
    if (user && user.name) {
      const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
      av.textContent = initials;
      av.title = user.name;
    }
  });
}

function initMobileQuickNav() {
  const page = resolveCurrentPage();
  const isMobile = window.matchMedia('(max-width: 900px)').matches;
  const supportsQuickNavPage = !['index.html', 'login.html'].includes(page);
  const shouldShow = isMobile && Auth.isLoggedIn() && supportsQuickNavPage && !!$('.navbar');
  const existing = $('#mobileQuickNav');

  if (!shouldShow) {
    existing?.remove();
    document.body.classList.remove('has-mobile-nav');
    return;
  }

  const links = [
    { href: '/dashboard.html', page: 'dashboard.html', icon: '🏠', label: 'Home' },
    { href: '/chat.html', page: 'chat.html', icon: '💬', label: 'Chats' },
    { href: '/report-lost.html', page: 'report-lost.html', icon: '📍', label: 'Lost' },
    { href: '/report-found.html', page: 'report-found.html', icon: '✅', label: 'Found' },
  ];
  if (Auth.isAdmin()) {
    links.push({ href: '/admin.html', page: 'admin.html', icon: '🛡', label: 'Admin' });
  }

  const nav = document.createElement('nav');
  nav.id = 'mobileQuickNav';
  nav.className = 'mobile-quick-nav';
  nav.setAttribute('aria-label', 'Mobile quick navigation');
  nav.innerHTML = links.map((link) => {
    const active = page === link.page || (page === 'admin-chats.html' && link.page === 'admin.html');
    return `
      <a href="${link.href}" class="mobile-quick-link ${active ? 'active' : ''}" data-page="${link.page}">
        <span class="icon" aria-hidden="true">${link.icon}</span>
        <span class="label">${link.label}</span>
      </a>
    `;
  }).join('');

  existing?.remove();
  document.body.appendChild(nav);
  document.body.classList.add('has-mobile-nav');

  if (!window.__traceupMobileQuickNavBound) {
    window.__traceupMobileQuickNavBound = true;
    window.addEventListener('resize', debounce(initMobileQuickNav, 120), { passive: true });
  }
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

  const forgotBlock = $('#forgotBlock');

  // Already logged in → go to dashboard
  if (Auth.isLoggedIn()) { location.href = 'dashboard.html'; return; }

  // Toggle panels
  const showPanel = (show, ...hide) => {
    hide.forEach(h => h?.classList.add('hidden'));
    show?.classList.remove('hidden');
    show.style.animation = 'fadeUp .35s ease both';
  };
  $('#switchToSignup')?.addEventListener('click', e => { e.preventDefault(); showPanel(signupBlock, loginBlock, forgotBlock); });
  $('#switchToLogin')?.addEventListener('click',  e => { e.preventDefault(); showPanel(loginBlock, signupBlock, forgotBlock); });

  // Handle "Role" selection if we need dynamic fields later (currently just sends the value)

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

  $('#btnSignup')?.addEventListener('click', async () => {
    const name              = $('#signupName')?.value.trim();
    const email             = $('#signupEmail')?.value.trim();
    const password          = $('#signupPass')?.value;
    const role              = $('#signupRole')?.value;
    const department        = $('#signupDept')?.value.trim() || '';
    const security_question = $('#signupSecurityQuestion')?.value;
    const security_answer   = $('#signupSecurityAnswer')?.value.trim();

    if (!name || !email || !password || !security_question || !security_answer) { 
      toast('Please fill in all required fields.', 'error'); 
      return; 
    }
    if (password.length < 6) { toast('Password must be at least 6 characters.', 'error'); return; }

    const btn = $('#btnSignup');
    btn.textContent = 'Creating account…';
    btn.disabled    = true;

    const res = await api('POST', '/auth/register', { 
      name, email, password, role, department, security_question, security_answer 
    });
    btn.textContent = 'Create account →';
    btn.disabled    = false;

    if (!res?.ok) {
      const msg = res?.errors?.[0]?.msg || res?.error || 'Registration failed.';
      toast(msg, 'error');
      return;
    }
    Auth.setToken(res.data.token);
    Auth.setUser(res.data.user);
    toast('Account created! Welcome to TraceUp.', 'success', 1800);
    setTimeout(() => location.href = 'dashboard.html', 1100);
  });

  // Allow Enter key to submit login
  $$('#loginBlock input').forEach(inp => {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnLogin')?.click(); });
  });

  // ── Forgot password panel toggling ──────────────────────────

  $('#openForgotPassword')?.addEventListener('click', e => {
    e.preventDefault();
    // Reset forgot form state when opening
    $('#forgotStep1')?.classList.remove('hidden');
    $('#forgotStep2')?.classList.add('hidden');
    showPanel(forgotBlock, loginBlock, signupBlock);
  });
  $('#backToLogin')?.addEventListener('click', e => {
    e.preventDefault();
    // Reset forgot form state when going back
    $('#forgotStep1')?.classList.remove('hidden');
    $('#forgotStep2')?.classList.add('hidden');
    showPanel(loginBlock, forgotBlock, signupBlock);
  });

  // ── Forgot password flow ───────────────────────────────────
  let resetEmail = null;

  // Step 1: Request Security Question
  $('#btnForgotNext')?.addEventListener('click', async () => {
    const email = $('#forgotEmail')?.value.trim();
    if (!email) { toast('Please enter your email address.', 'error'); return; }

    const btn = $('#btnForgotNext');
    btn.textContent = 'Checking…';
    btn.disabled    = true;

    // Call the new GET endpoint
    const res = await api('GET', `/auth/security-question/${encodeURIComponent(email)}`);

    btn.textContent = 'Next →';
    btn.disabled    = false;

    if (!res?.ok) {
      toast(res?.error || 'Account not found or no security question set.', 'error', 3000);
      return;
    }

    resetEmail = email;
    $('#forgotStep1').classList.add('hidden');
    $('#forgotStep2').classList.remove('hidden');
    $('#forgotSubtitle').textContent = 'Answer your security question to reset.';
    $('#displaySecurityQuestion').textContent = res.data.question;
  });

  // Allow Enter key to submit step 1
  $('#forgotEmail')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') $('#btnForgotNext')?.click();
  });

  // Step 2: Answer & Reset Password
  $('#btnResetPassword')?.addEventListener('click', async () => {
    const security_answer = $('#forgotSecurityAnswer')?.value.trim();
    const new_password    = $('#forgotNewPass')?.value;

    if (!security_answer) { toast('Please provide the security answer.', 'error'); return; }
    if (!new_password || new_password.length < 6) {
      toast('New password must be at least 6 characters.', 'error');
      return;
    }

    const btn = $('#btnResetPassword');
    btn.textContent = 'Resetting…';
    btn.disabled    = true;

    const res = await api('POST', '/auth/reset-password-security', {
      email: resetEmail,
      security_answer,
      new_password
    });

    btn.textContent = 'Reset password →';
    btn.disabled    = false;

    if (!res?.ok) {
      toast(res?.error || 'Failed to reset password.', 'error');
      return;
    }

    toast('Password reset successfully! Please log in.', 'success', 3000);

    // Reset form states and go back to login
    $('#forgotEmail').value = '';
    $('#forgotSecurityAnswer').value = '';
    $('#forgotNewPass').value = '';
    $('#forgotStep1').classList.remove('hidden');
    $('#forgotStep2').classList.add('hidden');
    $('#forgotSubtitle').textContent = 'Enter your email to retrieve your security question.';
    resetEmail = null;

    showPanel(loginBlock, forgotBlock, signupBlock);
  });

  // Allow Enter key to submit reset password
  $$('#forgotBlock input').forEach(inp => {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnResetPassword')?.click(); });
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

  // ── Item card HTML builder ──────────────────────────────────
  function itemCardHTML(item) {
    const statusCls = { lost: 'badge-lost', found: 'badge-found', claimed: 'badge-claimed', returned: 'badge-returned' }[item.status] || '';
    const imgSrc = item.image_url || `https://picsum.photos/seed/${item.id}/400/300`;
    const dateStr = item.date_lost
      ? new Date(item.date_lost).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';

    return `
      <div class="item-card-wrapper">
        <a href="item-details.html?id=${item.id}" class="item-card">
          <div class="item-card-img">
            <img src="${imgSrc}" alt="${escapeHtml(item.title)}" onerror="this.src='https://picsum.photos/seed/${item.id}/400/300'" loading="lazy">
            <span class="badge ${statusCls}"><span class="badge-dot"></span>${capitalize(item.status)}</span>
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

  // ── Load Items (Lost/Found/My Items) ───────────────────────
  async function loadItems(type, targetId, extraParams = {}) {
    const container = $(`#${targetId}`);
    if (!container) return;

    container.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--ink-3);">Loading…</div>';

    let endpoint = '/items';
    if (extraParams.my_items) {
      endpoint = '/items/my';
      delete extraParams.my_items;
    }

    const params = new URLSearchParams({ ...extraParams });
    if (type) params.append('type', type);
    params.append('limit', 12);

    const res = await api('GET', `${endpoint}?${params.toString()}`);
    if (!res?.ok || !res.data?.length) {
      container.innerHTML = `<div style="grid-column:1/-1;" class="empty-state"><div class="empty-icon">📭</div><p class="empty-msg">No ${type || 'items'} found.</p></div>`;
      return;
    }

    container.innerHTML = res.data.map(itemCardHTML).join('');
  }

  // ── Tabs ───────────────────────────────────────────────────
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === btn.dataset.tab));
      
      // Load specific tab data if not already loaded (basic lazy load check)
      if (btn.dataset.tab === 'tab-myitems' && $('#grid-myitems').innerHTML.includes('Loading')) {
        loadItems(null, 'grid-myitems', { my_items: true });
      } else if (btn.dataset.tab === 'tab-myclaims' && $('#list-myclaims').innerHTML.includes('Loading')) {
        loadMyClaims();
      }
    });
  });

  // ── Load My Claims ─────────────────────────────────────────
  async function loadMyClaims() {
    const container = $('#list-myclaims');
    if (!container) return;
    
    const res = await api('GET', '/claims/user');
    if (!res?.ok || !res.data?.length) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--ink-3);">You haven\'t made any claims yet.</div>';
      return;
    }

    container.innerHTML = res.data.map(claim => {
      const statusCls = { pending:'badge-claimed', approved:'badge-found', rejected:'badge-lost' }[claim.status] || 'badge-neutral';
      const dateStr = claim.created_at ? new Date(claim.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '';
      const chatAction = claim.conversation_id
        ? `<a href="/chat/${claim.conversation_id}" class="btn btn-teal btn-sm">Open Chat</a>`
        : '';
      
      return `
        <div class="my-claim-row">
          <img
            src="${claim.item_image || `https://picsum.photos/seed/${claim.item_id}/60/45`}"
            alt=""
            class="my-claim-thumb"
            onerror="this.src='https://picsum.photos/seed/${claim.item_id}/60/45'"
          >
          <div class="my-claim-main">
            <div class="my-claim-title">${escapeHtml(claim.item_title || 'Unknown Item')}</div>
            <div class="my-claim-date">Claimed on ${dateStr}</div>
          </div>
          <span class="badge ${statusCls}"><span class="badge-dot"></span>${capitalize(claim.status)}</span>
          <div class="my-claim-actions">
            ${chatAction}
            <a href="item-details.html?id=${claim.item_id}" class="btn btn-ghost btn-sm">View Item</a>
          </div>
        </div>
      `;
    }).join('');
  }

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
      // Also refresh My Items if it's the active tab
      if ($('.tab-btn[data-tab="tab-myitems"]').classList.contains('active')) {
        loadItems(null, 'grid-myitems', { my_items: true, ...(status ? { status } : {}) });
      }
    });
  });

  // ── Live search ────────────────────────────────────────────
  const searchInput = $('#globalSearch');
  searchInput?.addEventListener('input', debounce(e => {
    const q = e.target.value.trim();
    loadItems('lost',  'grid-lost',  q ? { q } : {});
    loadItems('found', 'grid-found', q ? { q } : {});
    if ($('.tab-btn[data-tab="tab-myitems"]').classList.contains('active')) {
        loadItems(null, 'grid-myitems', { my_items: true, ...(q ? { q } : {}) });
      }
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
  const dateField = $('[name="dateLost"], [name="dateFound"]', form);
  if (dateField) dateField.max = new Date().toISOString().slice(0, 10);

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
  document.title = `${item.title} — TraceUp`;

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

  // ── Sidebar status + title ────────────────────────────────
  const statusSidebar = $('#detailStatusSidebar');
  if (statusSidebar) {
    const cls = { lost:'badge-lost', found:'badge-found', claimed:'badge-claimed', returned:'badge-returned' }[item.status] || '';
    statusSidebar.className = `badge ${cls}`;
    statusSidebar.innerHTML = `<span class="badge-dot"></span>Status: ${capitalize(item.status)}`;
  }
  const titleSidebar = $('#detailTitleSidebar');
  if (titleSidebar) titleSidebar.textContent = item.title;

  // ── Category badge ────────────────────────────────────────
  const catBadge = $('#detailCategoryBadge');
  if (catBadge) catBadge.textContent = item.category || '';

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

    const res = await api('POST', '/claims', { item_id: itemId, message, contact });
    btn.textContent = 'Submit Claim';
    btn.disabled    = false;

    if (!res?.ok && !(res?.status === 409 && res?.data?.conversation_id)) {
      const msg = res?.errors?.[0]?.msg || res?.error || 'Failed to submit claim.';
      toast(msg, 'error');
      return;
    }

    const conversationId = res?.data?.conversation_id || null;
    const chatUrl = res?.data?.chat_url || (conversationId ? `/chat/${conversationId}` : null);

    closeModal('claimModal');
    toast("Claim submitted! Opening private chat…", 'success', 1800);

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

    if (chatUrl) {
      setTimeout(() => { location.href = chatUrl; }, 550);
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
          <a href="item-details.html?id=${i.id}" class="similar-item-link">
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

  // ── Admin tab switching ────────────────────────────────────
  $$('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.admin-tab-panel').forEach(p => p.classList.toggle('active', p.id === btn.dataset.adminTab));
    });
  });

  // ── Load stats ─────────────────────────────────────────────
  async function loadAdminStats() {
    const res = await api('GET', '/admin/stats');
    if (!res?.ok) return;
    const s = res.data.items;
    const total = (s.lost || 0) + (s.found || 0) + (s.claimed || 0) + (s.returned || 0);
    const el = id => $(`#${id}`);
    if (el('stat-total'))    el('stat-total').textContent = total;
    if (el('stat-lost'))     el('stat-lost').textContent = s.lost ?? 0;
    if (el('stat-found'))    el('stat-found').textContent = s.found ?? 0;
    if (el('stat-claimed'))  el('stat-claimed').textContent = s.claimed ?? 0;
    if (el('stat-returned')) el('stat-returned').textContent = s.returned ?? 0;
  }

  // ── Build table row ────────────────────────────────────────
  function buildRow(item) {
    const imgSrc    = item.image_url || `https://picsum.photos/seed/${item.id}/48/36`;
    const statusCls = { lost:'badge-lost', found:'badge-found', claimed:'badge-claimed', returned:'badge-returned' }[item.status] || '';
    const dateStr   = item.date_lost ? new Date(item.date_lost).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—';
    const hasClaims = (item.pending_claims || 0) > 0;

    const actions = item.status !== 'returned'
      ? `<button class="btn btn-outline btn-sm btn-view-claims" data-id="${item.id}" data-title="${escapeHtml(item.title)}">👁 Claims</button>
         <a href="item-details.html?id=${item.id}" class="btn btn-ghost btn-sm">View</a>
         <button class="btn btn-danger btn-sm btn-delete-item" data-id="${item.id}">🗑 Delete</button>`
      : `<span class="text-sm text-muted fw-500">Resolved</span>
         <a href="item-details.html?id=${item.id}" class="btn btn-ghost btn-sm">View</a>
         <button class="btn btn-danger btn-sm btn-delete-item" data-id="${item.id}">🗑 Delete</button>`;

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
          <span class="claims-count ${hasClaims ? 'high' : ''}">${item.pending_claims || 0}</span>
        </td>
        <td class="action-cell"><div class="td-actions" style="gap:6px;">${actions}</div></td>
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

    const countEl = $('#adminItemCount');
    if (countEl) countEl.textContent = `Showing ${res.data.length} of ${res.meta?.total || res.data.length} items`;
  }

  // ── Build claim card HTML ──────────────────────────────────
  function buildClaimCard(claim, showItemPreview = false) {
    const initials = (claim.claimant_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const statusCls = { pending:'badge-claimed', approved:'badge-found', rejected:'badge-lost' }[claim.status] || 'badge-neutral';
    const dateStr = claim.created_at ? new Date(claim.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '';

    const actions = claim.status === 'pending' ? `
      <div class="claim-card-actions">
        <button class="btn btn-success btn-sm btn-approve-claim" data-claim-id="${claim.id}">✓ Approve</button>
        <button class="btn btn-danger btn-sm btn-reject-claim" data-claim-id="${claim.id}">✕ Reject</button>
      </div>` : '';

    const itemPreview = showItemPreview && claim.item_title ? `
      <div class="claim-item-preview">
        <img src="${claim.item_image || `https://picsum.photos/seed/${claim.item_id}/48/36`}" alt="" onerror="this.src='https://picsum.photos/seed/${claim.item_id}/48/36'">
        <div>
          <div class="td-name">${escapeHtml(claim.item_title)}</div>
          <div class="td-sub">${escapeHtml(claim.item_category || '')}</div>
        </div>
        <a href="item-details.html?id=${claim.item_id}" class="btn btn-ghost btn-sm" style="margin-left:auto;">View →</a>
      </div>` : '';

    return `
      <div class="claim-card" data-claim-id="${claim.id}" data-status="${claim.status}">
        ${itemPreview}
        <div class="claim-card-header">
          <div class="claim-card-user">
            <div class="claim-card-avatar">${initials}</div>
            <div>
              <div class="claim-card-name">${escapeHtml(claim.claimant_name || 'Unknown')}</div>
              <div class="claim-card-email">${escapeHtml(claim.claimant_email || '')}</div>
            </div>
          </div>
          <span class="badge ${statusCls}"><span class="badge-dot"></span>${capitalize(claim.status)}</span>
        </div>
        <div class="claim-card-meta">
          ${claim.claimant_department ? `<span>🏢 ${escapeHtml(claim.claimant_department)}</span>` : ''}
          ${claim.claimant_phone || claim.contact ? `<span>📞 ${escapeHtml(claim.contact || claim.claimant_phone)}</span>` : ''}
          ${dateStr ? `<span>📅 ${dateStr}</span>` : ''}
        </div>
        <div class="claim-card-message">"${escapeHtml(claim.message)}"</div>
        ${actions}
      </div>`;
  }

  // ── Load claims for Claims tab ─────────────────────────────
  async function loadAdminClaims(statusFilter = 'all') {
    const container = $('#adminClaimsList');
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--ink-3);">Loading claims…</div>';

    const res = await api('GET', '/admin/claims');
    if (!res?.ok || !res.data?.length) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--ink-3);">No claims found.</div>';
      return;
    }

    let claims = res.data;
    if (statusFilter !== 'all') {
      claims = claims.filter(c => c.status === statusFilter);
    }

    if (!claims.length) {
      container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--ink-3);">No ${statusFilter} claims found.</div>`;
      return;
    }

    container.innerHTML = claims.map(c => buildClaimCard(c, true)).join('');
    const countEl = $('#adminClaimCount');
    if (countEl) countEl.textContent = `Showing ${claims.length} claim${claims.length !== 1 ? 's' : ''}`;
  }

  // ── Load users ─────────────────────────────────────────────
  async function loadUsers() {
    const tbody = $('#usersTable')?.querySelector('tbody');
    if (!tbody) return;

    const res = await api('GET', '/admin/users');
    if (!res?.ok || !res.data?.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--ink-3);">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(u => {
      const roleClass = u.role === 'admin' ? 'background:#FEF3C7;color:#92400E;' : 'background:var(--teal-lt);color:var(--teal-dk);';
      const joinDate = u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—';
      return `
        <tr>
          <td><div class="td-name">${escapeHtml(u.name)}</div></td>
          <td class="text-sm">${escapeHtml(u.email)}</td>
          <td><span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;${roleClass}">${capitalize(u.role)}</span></td>
          <td class="text-sm text-muted">${escapeHtml(u.department || '—')}</td>
          <td class="text-sm text-muted">${escapeHtml(u.phone || '—')}</td>
          <td class="text-sm text-muted">${joinDate}</td>
        </tr>`;
    }).join('');

    const countEl = $('#adminUserCount');
    if (countEl) countEl.textContent = `${res.data.length} user${res.data.length !== 1 ? 's' : ''} registered`;
  }

  // ── View claims for a specific item (modal) ───────────────
  async function openClaimsForItem(itemId, itemTitle) {
    const body = $('#claimsModalBody');
    const title = $('#claimsModalTitle');
    if (title) title.textContent = `Claims for: ${itemTitle}`;
    body.innerHTML = '<p class="text-muted" style="text-align:center;padding:20px;">Loading claims…</p>';
    openModal('claimsDetailModal');

    const res = await api('GET', `/claims/item/${itemId}`);
    if (!res?.ok || !res.data?.length) {
      body.innerHTML = '<p class="text-muted" style="text-align:center;padding:20px;">No claims found for this item.</p>';
      return;
    }

    body.innerHTML = res.data.map(c => buildClaimCard(c, false)).join('');
  }

  // ── Event delegation: Approve/Reject from claim cards ──────
  document.addEventListener('click', async e => {
    const viewClaimsBtn = e.target.closest('.btn-view-claims');
    if (viewClaimsBtn) {
      openClaimsForItem(viewClaimsBtn.dataset.id, viewClaimsBtn.dataset.title);
      return;
    }

    const deleteBtn = e.target.closest('.btn-delete-item');
    if (deleteBtn) {
      if (!confirm('Are you sure you want to delete this item? This cannot be undone.')) return;
      const itemId = deleteBtn.dataset.id;
      deleteBtn.textContent = '…';
      deleteBtn.disabled = true;

      const res = await api('DELETE', `/admin/items/${itemId}`);
      if (!res?.ok) {
        toast(res?.error || 'Failed to delete item.', 'error');
        deleteBtn.textContent = '🗑 Delete';
        deleteBtn.disabled = false;
        return;
      }

      toast('Item deleted successfully.', 'success');
      loadAdminStats();
      loadAdminItems();
      return;
    }

    const approveBtn = e.target.closest('.btn-approve-claim');
    if (approveBtn) {
      const claimId = approveBtn.dataset.claimId;
      approveBtn.textContent = '…';
      approveBtn.disabled = true;

      const res = await api('PUT', `/admin/claims/${claimId}/approve`);
      if (!res?.ok) {
        toast(res?.error || 'Failed to approve.', 'error');
        approveBtn.textContent = '✓ Approve';
        approveBtn.disabled = false;
        return;
      }

      toast('Claim approved — item marked as Returned.', 'success');
      const card = approveBtn.closest('.claim-card');
      if (card) {
        const badge = card.querySelector('.claim-card-header .badge');
        if (badge) { badge.className = 'badge badge-found'; badge.innerHTML = '<span class="badge-dot"></span>Approved'; }
        card.querySelector('.claim-card-actions')?.remove();
      }
      loadAdminStats();
      loadAdminItems();
      return;
    }

    const rejectBtn = e.target.closest('.btn-reject-claim');
    if (rejectBtn) {
      const claimId = rejectBtn.dataset.claimId;
      rejectBtn.textContent = '…';
      rejectBtn.disabled = true;

      const res = await api('PUT', `/admin/claims/${claimId}/reject`);
      if (!res?.ok) {
        toast(res?.error || 'Failed to reject.', 'error');
        rejectBtn.textContent = '✕ Reject';
        rejectBtn.disabled = false;
        return;
      }

      toast('Claim rejected.', 'info');
      const card = rejectBtn.closest('.claim-card');
      if (card) {
        const badge = card.querySelector('.claim-card-header .badge');
        if (badge) { badge.className = 'badge badge-lost'; badge.innerHTML = '<span class="badge-dot"></span>Rejected'; }
        card.querySelector('.claim-card-actions')?.remove();
      }
      loadAdminStats();
      loadAdminItems();
      return;
    }
  });

  // ── Filter chips (items) ──────────────────────────────────
  $$('.admin-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('.admin-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const filter = chip.dataset.filter;
      loadAdminItems(filter && filter !== 'all' ? { status: filter } : {});
    });
  });

  // ── Filter chips (claims) ─────────────────────────────────
  $$('.claim-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('.claim-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      loadAdminClaims(chip.dataset.filter);
    });
  });

  // ── Admin search ───────────────────────────────────────────
  $('#adminSearch')?.addEventListener('input', debounce(e => {
    const q = e.target.value.trim();
    loadAdminItems(q ? { q } : {});
  }, 280));

  // ── Initial load ───────────────────────────────────────────
  await Promise.all([loadAdminStats(), loadAdminItems(), loadAdminClaims(), loadUsers()]);
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

// Shared footer content across all pages
function initFooter() {
  const footers = $$('.site-footer');
  if (!footers.length) return;

  const githubRepo = 'https://github.com/krishnasikarwar7/traceup-web';
  const issueUrl = `${githubRepo}/issues`;
  const contactEmail = 'sikarwarkrishna177@gmail.com';

  const footerHtml = `
    <div class="footer-brand">TraceUp</div>
    <p class="footer-tagline">Reuniting lost belongings across campus communities.</p>
    <div class="footer-links">
      <a href="${githubRepo}" target="_blank" rel="noopener noreferrer">GitHub</a>
      <span aria-hidden="true">•</span>
      <a href="${issueUrl}" target="_blank" rel="noopener noreferrer">Report Issue</a>
      <span aria-hidden="true">•</span>
      <a href="mailto:${contactEmail}">Contact</a>
    </div>
    <p class="footer-copy">© 2026 TraceUp — Built by Krishna</p>
  `;

  footers.forEach((footer) => {
    footer.innerHTML = footerHtml;
  });
}

// Live animated particle backdrop used on landing/auth pages
function initLiveBackgrounds() {
  const hosts = $$('.live-particles');
  if (!hosts.length) return;
  const isLivePage =
    document.body.classList.contains('landing-page') ||
    document.body.classList.contains('auth-page');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const allowLiveMotion = isLivePage;

  if (allowLiveMotion) {
    document.documentElement.classList.add('allow-live-motion');
  }

  if (reduceMotion && !allowLiveMotion) return;

  hosts.forEach((host) => {
    if (host.dataset.liveInit === '1') return;
    host.dataset.liveInit = '1';

    const hwThreads = Number(navigator.hardwareConcurrency || 8);
    const deviceMem = Number(navigator.deviceMemory || 8);
    const lowPowerDevice = hwThreads <= 4 || deviceMem <= 4;

    const requested = Number(host.dataset.count) || 30;
    const cap = Math.min(Math.max(requested, 14), 56);
    const baseCount = window.innerWidth < 700 ? Math.max(12, Math.floor(cap * 0.55)) : cap;
    const count = lowPowerDevice ? Math.max(10, Math.floor(baseCount * 0.68)) : baseCount;
    const speedScale = lowPowerDevice ? 0.74 : 1;

    const particles = [];
    let width = 0;
    let height = 0;
    let lastFrameMs = 0;

    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'live-particle';
      host.appendChild(el);
      particles.push({
        el,
        x: 0,
        y: 0,
        vx: (Math.random() * 0.6 + 0.18) * speedScale * (Math.random() < 0.5 ? -1 : 1),
        vy: (Math.random() * 0.5 + 0.12) * speedScale * (Math.random() < 0.5 ? -1 : 1),
        size: Math.random() * 6 + 4,
        phase: Math.random() * Math.PI * 2,
        twinkle: Math.random() * 0.9 + 0.35
      });
    }

    const layout = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(320, rect.width);
      height = Math.max(280, rect.height);
      particles.forEach((p) => {
        p.x = Math.random() * width;
        p.y = Math.random() * height;
        p.el.style.width = `${p.size}px`;
        p.el.style.height = `${p.size}px`;
      });
    };

    layout();
    window.addEventListener('resize', debounce(layout, 120), { passive: true });

    const drift = (timeMs) => {
      if (document.hidden) {
        requestAnimationFrame(drift);
        return;
      }
      if (lowPowerDevice && timeMs - lastFrameMs < 28) {
        requestAnimationFrame(drift);
        return;
      }
      lastFrameMs = timeMs;

      const t = timeMs * 0.001;
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -14 || p.x > width + 14) p.vx *= -1;
        if (p.y < -14 || p.y > height + 14) p.vy *= -1;

        const twinkle = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin((t + p.phase) * p.twinkle));
        p.el.style.opacity = String(0.12 + twinkle * 0.7);
        p.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      });

      requestAnimationFrame(drift);
    };

    requestAnimationFrame(drift);
  });
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
  initThemeToggle();
  initFooter();
  setActiveNav();
  initMobileQuickNav();
  initAuth();
  initDashboard();
  initReportForm();
  initItemDetails();
  initAdmin();
  initFileUploads();
  initLiveBackgrounds();
});
