
  /* =============================== STATE =============================== */

  const STATE = {
    token: localStorage.getItem('od_token') || null,
    user: null,
    tools: [],
    categoryFilter: null,
    searchTerm: '',
    settingsView: 'users',
    users: [],
    adminTools: [],
    permOriginal: new Set(),
    permCurrent: new Set(),
    permData: null
  };

  const CATEGORY_PALETTE = ['#2F4B8F', '#1F7A4D', '#B5750A', '#C53A3A', '#6D4AA8', '#0E7C86'];

  /* =============================== SERVER BRIDGE =============================== */

 const API_URL = 'https://script.google.com/macros/s/AKfycbxlUHa4eD-eRiW0RCyGbMYKCEbnE7JsNQdYf1jLKncMPcQ3tzYPkXVv5_9-OdrGvwK_vA/exec';
 const INVITE_TOKEN = new URLSearchParams(window.location.search).get('invite');

async function runServer(fn, ...args) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ fn, args })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

  /* =============================== INIT =============================== */

  window.addEventListener('DOMContentLoaded', init);

async function init() {
  initTheme();
  bindStaticEvents();
  if (INVITE_TOKEN) { startInviteFlow(); return; }
  if (STATE.token) {
      try {
        const data = await runServer('getDashboardData', STATE.token);
        applyDashboardData(data);
        showApp();
      } catch (err) {
        localStorage.removeItem('od_token');
        showLogin();
      }
    } else {
      showLogin();
    }
  }

  function applyDashboardData(data) {
    STATE.user = data.user;
    STATE.tools = data.tools;
  }

  function showLogin() {
    document.getElementById('loginView').hidden = false;
    document.getElementById('appView').hidden = true;
  }

  function showApp() {
    document.getElementById('loginView').hidden = true;
    document.getElementById('appView').hidden = false;
    document.getElementById('userChipName').textContent = STATE.user.fullName || STATE.user.username;
    document.getElementById('userAvatar').textContent = initials(STATE.user.fullName || STATE.user.username);
    document.getElementById('settingsNavBtn').hidden = !STATE.user.isSettingsAdmin;
    showHomeSection();
    renderSidebarNav();
    renderCategoryChips();
    renderHomeTable();
  }

  function initials(name) {
    return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  }

  /* =============================== THEME =============================== */

  function initTheme() {
    const saved = localStorage.getItem('od_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcons(saved);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('od_theme', next);
    updateThemeIcons(next);
  }

  function updateThemeIcons(mode) {
    const icon = mode === 'dark' ? '☀️' : '🌙';
    const a = document.getElementById('themeToggle');
    const b = document.getElementById('loginThemeToggle');
    if (a) a.textContent = icon;
    if (b) b.textContent = icon;
  }

  /* =============================== STATIC EVENTS =============================== */

  function bindStaticEvents() {
    document.getElementById('inviteForm').addEventListener('submit', onInviteSubmit);
    document.getElementById('inviteToLoginBtn').addEventListener('click', () => leaveInviteView());
    document.getElementById('loginThemeToggle').addEventListener('click', toggleTheme);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    document.getElementById('loginForm').addEventListener('submit', onLoginSubmit);
    document.getElementById('forgotPasswordLink').addEventListener('click', openForgotPasswordModal);

    document.getElementById('userChipBtn').addEventListener('click', () => {
      document.getElementById('userDropdown').hidden = !document.getElementById('userDropdown').hidden;
    });
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('userDropdown');
      if (!menu.hidden && !e.target.closest('.user-menu')) menu.hidden = true;
    });
    document.getElementById('logoutBtn').addEventListener('click', onLogout);
    document.getElementById('changePasswordBtn').addEventListener('click', openChangePasswordModal);

    document.getElementById('toolSearch').addEventListener('input', (e) => {
      STATE.searchTerm = e.target.value.trim().toLowerCase();
      renderHomeTable();
    });

    document.getElementById('settingsNavBtn').addEventListener('click', showSettingsSection);

    document.getElementById('menuBtn').addEventListener('click', () => {
      document.getElementById('sidebar').classList.add('open');
      document.getElementById('sidebarScrim').style.display = 'block';
    });
    document.getElementById('sidebarScrim').addEventListener('click', closeMobileSidebar);

    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'modalOverlay') closeModal();
    });

    document.getElementById('settingsTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.tab');
      if (!btn) return;
      setSettingsTab(btn.dataset.tab);
    });

    document.getElementById('addUserBtn').addEventListener('click', () => openUserModal(null));
    document.getElementById('addToolBtn').addEventListener('click', () => openToolModal(null));
    document.getElementById('savePermissionsBtn').addEventListener('click', onSavePermissions);

    document.getElementById('backToToolsBtn').addEventListener('click', showHomeSection);
  }

  function closeMobileSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarScrim').style.display = 'none';
  }

/* =============================== INVITE FLOW =============================== */

async function startInviteFlow() {
  document.getElementById('loginView').hidden = true;
  document.getElementById('appView').hidden = true;
  document.getElementById('inviteView').hidden = false;
  try {
    const info = await runServer('getInviteInfo', INVITE_TOKEN);
    document.getElementById('inviteLoading').hidden = true;
    if (!info.valid) { showInviteInvalid(info.message); return; }
    document.getElementById('inviteGreeting').textContent = 'Welcome, ' + (info.fullName || info.username) + '!';
    document.getElementById('inviteUsername').textContent = info.username;
    document.getElementById('inviteForm').hidden = false;
    document.getElementById('invitePassword').focus();
  } catch (err) {
    document.getElementById('inviteLoading').hidden = true;
    showInviteInvalid(errMsg(err));
  }
}

function showInviteInvalid(msg) {
  document.getElementById('inviteInvalidMsg').textContent = msg;
  document.getElementById('inviteInvalid').hidden = false;
}

function leaveInviteView(prefillUsername) {
  window.history.replaceState({}, '', window.location.pathname); // strip ?invite=...
  document.getElementById('inviteView').hidden = true;
  showLogin();
  if (prefillUsername) document.getElementById('loginUsername').value = prefillUsername;
}

async function onInviteSubmit(e) {
  e.preventDefault();
  const pw = document.getElementById('invitePassword').value;
  const pw2 = document.getElementById('invitePassword2').value;
  const errBox = document.getElementById('inviteError');
  const btn = document.getElementById('inviteBtn');
  errBox.hidden = true;
  if (pw.length < 8) { errBox.textContent = 'Password must be at least 8 characters.'; errBox.hidden = false; return; }
  if (pw !== pw2) { errBox.textContent = 'Passwords do not match.'; errBox.hidden = false; return; }
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const res = await runServer('completeInvite', INVITE_TOKEN, pw);
    if (!res.success) { errBox.textContent = res.message; errBox.hidden = false; return; }
    leaveInviteView(res.username);
    showToast('Password set. Sign in to continue.');
  } catch (err) {
    errBox.textContent = errMsg(err);
    errBox.hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = 'Set password & continue';
  }
}

  /* =============================== LOGIN / LOGOUT =============================== */

  async function onLoginSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');
    const errBox = document.getElementById('loginError');
    errBox.hidden = true;
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      const res = await runServer('login', username, password);
      if (!res.success) {
        errBox.textContent = res.message;
        errBox.hidden = false;
        return;
      }
      STATE.token = res.token;
      localStorage.setItem('od_token', res.token);
      const data = await runServer('getDashboardData', STATE.token);
      applyDashboardData(data);
      document.getElementById('loginForm').reset();
      showApp();
    } catch (err) {
      errBox.textContent = errMsg(err);
      errBox.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  }

  async function onLogout() {
    try { await runServer('logout', STATE.token); } catch (e) {}
    localStorage.removeItem('od_token');
    STATE.token = null; STATE.user = null; STATE.tools = [];
    showLogin();
  }

  /* =============================== HOME / TOOLS TABLE =============================== */

  function showHomeSection() {
    document.getElementById('pageTitle').textContent = STATE.categoryFilter || 'All tools';
    document.getElementById('homeSection').hidden = false;
    document.getElementById('settingsSection').hidden = true;
    document.getElementById('toolFrameSection').hidden = true;
    closeMobileSidebar();
  }

  function categoryColor(category) {
    const cats = [...new Set(STATE.tools.map(t => t.category || 'Other'))];
    const idx = Math.max(0, cats.indexOf(category));
    return CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length];
  }

  function renderSidebarNav() {
    const nav = document.getElementById('sideNav');
    const categories = [...new Set(STATE.tools.map(t => t.category || 'Other'))];
    let html = `<button class="nav-item ${!STATE.categoryFilter ? 'active' : ''}" data-cat="">
      <span class="nav-icon">▦</span><span>All tools</span></button>`;
    categories.forEach(cat => {
      html += `<button class="nav-item ${STATE.categoryFilter === cat ? 'active' : ''}" data-cat="${escapeHtml(cat)}">
        <span class="nav-icon" style="color:${categoryColor(cat)}">●</span><span>${escapeHtml(cat)}</span></button>`;
    });
    nav.innerHTML = html;
    nav.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.categoryFilter = btn.dataset.cat || null;
        showHomeSection();
        renderSidebarNav();
        renderCategoryChips();
        renderHomeTable();
      });
    });
  }

  function renderCategoryChips() {
    const wrap = document.getElementById('categoryChips');
    const categories = [...new Set(STATE.tools.map(t => t.category || 'Other'))];
    let html = `<button class="chip ${!STATE.categoryFilter ? 'active' : ''}" data-cat="">All</button>`;
    categories.forEach(cat => {
      html += `<button class="chip ${STATE.categoryFilter === cat ? 'active' : ''}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`;
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        STATE.categoryFilter = chip.dataset.cat || null;
        renderSidebarNav();
        renderCategoryChips();
        renderHomeTable();
        document.getElementById('pageTitle').textContent = STATE.categoryFilter || 'All tools';
      });
    });
  }

  function renderHomeTable() {
    const body = document.getElementById('toolsTableBody');
    const empty = document.getElementById('toolsEmpty');
    let list = STATE.tools;
    if (STATE.categoryFilter) list = list.filter(t => (t.category || 'Other') === STATE.categoryFilter);
    if (STATE.searchTerm) {
      list = list.filter(t =>
        (t.name || '').toLowerCase().includes(STATE.searchTerm) ||
        (t.description || '').toLowerCase().includes(STATE.searchTerm));
    }
    if (!list.length) {
      body.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    body.innerHTML = list.map(t => `
      <tr>
        <td>
          <div class="tool-cell">
            <div class="tool-icon">${t.icon || '🔧'}</div>
            <div class="tool-name">${escapeHtml(t.name)}</div>
          </div>
        </td>
        <td><span class="badge" style="background:${hexToSoft(categoryColor(t.category))};color:${categoryColor(t.category)}">
          <span class="badge-dot" style="background:${categoryColor(t.category)}"></span>${escapeHtml(t.category || 'Other')}
        </span></td>
        <td class="tool-desc-cell">${escapeHtml(t.description || '')}</td>
        <td class="col-action">
          ${t.openMode === 'embed'
            ? `<button class="btn btn-sm" data-embed="${t.id}">Open ↗</button>`
            : `<a class="btn btn-sm" href="${escapeAttr(t.url)}" target="_blank" rel="noopener">Open ↗</a>`}
        </td>
      </tr>
    `).join('');
    body.querySelectorAll('[data-embed]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = STATE.tools.find(x => x.id === btn.dataset.embed);
        if (tool) openToolEmbedded(tool);
      });
    });
  }

  function hexToSoft(hex) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},0.12)`;
  }

  /* =============================== EMBEDDED TOOL VIEW =============================== */

  const iframeCache = {};

  function openToolEmbedded(tool) {
    document.getElementById('homeSection').hidden = true;
    document.getElementById('settingsSection').hidden = true;
    document.getElementById('toolFrameSection').hidden = false;
    document.getElementById('pageTitle').textContent = tool.name;
    document.getElementById('frameToolTitle').textContent = tool.name;
    document.getElementById('frameOpenNewTab').href = tool.url;

    const container = document.getElementById('iframeContainer');
    Array.from(container.children).forEach(el => { el.style.display = 'none'; });

    let frame = iframeCache[tool.id];
    if (!frame) {
      frame = document.createElement('iframe');
      frame.className = 'tool-iframe';
      frame.title = tool.name;
      frame.src = tool.url;
      container.appendChild(frame);
      iframeCache[tool.id] = frame;
    }
    frame.style.display = 'block';
    closeMobileSidebar();
  }

  /* =============================== SETTINGS SHELL =============================== */

  async function showSettingsSection() {
    document.getElementById('pageTitle').textContent = 'Settings';
    document.getElementById('homeSection').hidden = true;
    document.getElementById('settingsSection').hidden = false;
    document.getElementById('toolFrameSection').hidden = true;
    closeMobileSidebar();
    await loadUsers();
  }

  function setSettingsTab(tab) {
    STATE.settingsView = tab;
    document.querySelectorAll('#settingsTabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('panel-users').hidden = tab !== 'users';
    document.getElementById('panel-tools').hidden = tab !== 'tools';
    document.getElementById('panel-permissions').hidden = tab !== 'permissions';
    if (tab === 'users') loadUsers();
    if (tab === 'tools') loadAdminTools();
    if (tab === 'permissions') loadPermMatrix();
  }

  /* =============================== SETTINGS: USERS =============================== */

  async function loadUsers() {
    try {
      STATE.users = await runServer('adminGetUsers', STATE.token);
      renderUsersTable();
    } catch (err) { showToast(errMsg(err), 'error'); }
  }

  function renderUsersTable() {
    const body = document.getElementById('usersTableBody');
    body.innerHTML = STATE.users.map(u => `
      <tr>
        <td>${escapeHtml(u.fullName)}</td>
        <td>${escapeHtml(u.username)}</td>
        <td>${escapeHtml(u.role || '')}</td>
        <td>${u.isSettingsAdmin ? '<span class="badge" style="background:var(--accent-soft);color:var(--accent)">Yes</span>' : '—'}</td>
        <td><span class="pw-reveal" data-pw="${escapeAttr(u.currentPassword || '')}" title="Click to reveal">••••••••</span></td>
        <td>${formatDate(u.passwordChangedAt)}</td>
        <td><span class="status-dot ${u.active ? 'on' : 'off'}"></span>${u.active ? 'Active' : 'Inactive'}</td>
        <td class="col-action">
          <div class="row-actions">
            <button class="btn btn-sm" data-invite="${u.id}">Resend invite</button>
            <button class="btn btn-sm" data-edit="${u.id}">Edit</button>
            <button class="btn btn-sm btn-danger" data-del="${u.id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
    body.querySelectorAll('.pw-reveal').forEach(el => {
      el.addEventListener('click', () => {
        const hidden = el.textContent === '••••••••';
        el.textContent = hidden ? (el.dataset.pw || '(not set)') : '••••••••';
      });
    });
    body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openUserModal(STATE.users.find(u => u.id === b.dataset.edit))));
    body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => confirmDeleteUser(b.dataset.del)));
        body.querySelectorAll('[data-invite]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await runServer('adminResendInvite', STATE.token, b.dataset.invite);
        showToast('Invite sent.');
      } catch (err) { showToast(errMsg(err), 'error'); }
      finally { b.disabled = false; }
    }));
  }

  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function openUserModal(user) {
    const isEdit = !!user;
    openModal(isEdit ? 'Edit user' : 'Add user', `
      <label class="field-label">Full name</label>
      <input class="input" id="f_fullName" value="${escapeAttr(user?.fullName || '')}">
      <label class="field-label">Username</label>
      <input class="input" id="f_username" value="${escapeAttr(user?.username || '')}">
            <label class="field-label">Email ${isEdit ? '' : '<span style="font-weight:400;">(the invite is sent here)</span>'}</label>
      <input class="input" id="f_email" type="email" value="${escapeAttr(user?.email || '')}" placeholder="name@company.com">
      <label class="field-label">Role (e.g. Dispatcher, Finance, Manager)</label>
      <input class="input" id="f_role" value="${escapeAttr(user?.role || '')}">
      ${isEdit ? `
        <label class="field-label">New password (leave blank to keep current)</label>
        <input class="input" id="f_password" type="text" placeholder="••••••••">`
      : `<div class="field-hint" style="margin-top:14px;">We'll email an invite so they can choose their own password.</div>`}
      <div class="checkbox-row"><input type="checkbox" id="f_settingsAdmin" ${user?.isSettingsAdmin ? 'checked' : ''}>
        <label for="f_settingsAdmin">Can access Settings (full admin)</label></div>
      ${isEdit ? `<div class="checkbox-row"><input type="checkbox" id="f_active" ${user?.active ? 'checked' : ''}>
        <label for="f_active">Active (can sign in)</label></div>` : ''}
      <div id="f_error" class="form-error" hidden></div>
    `, [
      { label: 'Cancel', cls: 'btn', onClick: closeModal },
      { label: isEdit ? 'Save changes' : 'Add user', cls: 'btn btn-primary', onClick: () => saveUserFromModal(user) }
    ]);
  }

  async function saveUserFromModal(existing) {
    const data = {
      id: existing ? existing.id : null,
      fullName: document.getElementById('f_fullName').value.trim(),
      username: document.getElementById('f_username').value.trim(),
      email: document.getElementById('f_email').value.trim(),
      role: document.getElementById('f_role').value.trim(),
      password: document.getElementById('f_password') ? document.getElementById('f_password').value : '',
      isSettingsAdmin: document.getElementById('f_settingsAdmin').checked,
      active: existing ? document.getElementById('f_active').checked : true
    };
    const errBox = document.getElementById('f_error');
    if (!existing && !data.email) {
      errBox.textContent = 'An email address is required to send the invite.';
      errBox.hidden = false;
      return;
    }
    try {
      const res = await runServer('adminSaveUser', STATE.token, data);
      closeModal();
      if (!existing && res && res.emailSent === false) showToast(res.message, 'error');
      else showToast(existing ? 'User updated.' : 'User added. Invite email sent.');
      loadUsers();
    } catch (err) {
      errBox.textContent = errMsg(err);
      errBox.hidden = false;
    }
  }

  function confirmDeleteUser(id) {
    const user = STATE.users.find(u => u.id === id);
    openModal('Delete user', `<p>Delete <strong>${escapeHtml(user.fullName)}</strong>? They will immediately lose access to the dashboard.</p>`, [
      { label: 'Cancel', cls: 'btn', onClick: closeModal },
      { label: 'Delete', cls: 'btn btn-danger', onClick: async () => {
        try {
          await runServer('adminDeleteUser', STATE.token, id);
          closeModal();
          showToast('User deleted.');
          loadUsers();
        } catch (err) { showToast(errMsg(err), 'error'); }
      } }
    ]);
  }

  /* =============================== SETTINGS: TOOLS =============================== */

  async function loadAdminTools() {
    try {
      STATE.adminTools = await runServer('adminGetTools', STATE.token);
      renderToolsAdminTable();
    } catch (err) { showToast(errMsg(err), 'error'); }
  }

  function renderToolsAdminTable() {
    const body = document.getElementById('toolsAdminTableBody');
    body.innerHTML = STATE.adminTools.map(t => `
      <tr>
        <td><div class="tool-cell"><div class="tool-icon">${t.icon || '🔧'}</div><div class="tool-name">${escapeHtml(t.name)}</div></div></td>
        <td>${escapeHtml(t.category || '')}</td>
        <td style="max-width:220px; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(t.url || '')}</td>
        <td>${t.openMode === 'embed' ? 'In dashboard' : 'New tab'}</td>
        <td><span class="status-dot ${t.active ? 'on' : 'off'}"></span>${t.active ? 'Active' : 'Hidden'}</td>
        <td class="col-action">
          <div class="row-actions">
            <button class="btn btn-sm" data-edit="${t.id}">Edit</button>
            <button class="btn btn-sm btn-danger" data-del="${t.id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
    body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openToolModal(STATE.adminTools.find(t => t.id === b.dataset.edit))));
    body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => confirmDeleteTool(b.dataset.del)));
  }

  function openToolModal(tool) {
    const isEdit = !!tool;
    openModal(isEdit ? 'Edit tool' : 'Add tool', `
      <label class="field-label">Name</label>
      <input class="input" id="f_name" value="${escapeAttr(tool?.name || '')}">
      <label class="field-label">Description</label>
      <input class="input" id="f_description" value="${escapeAttr(tool?.description || '')}">
      <label class="field-label">Link (URL to the spreadsheet or web app)</label>
      <input class="input" id="f_url" value="${escapeAttr(tool?.url || '')}" placeholder="https://...">
      <label class="field-label">Category</label>
      <input class="input" id="f_category" value="${escapeAttr(tool?.category || '')}" placeholder="e.g. Finance, Operations, Attendance">
      <label class="field-label">Icon (single emoji)</label>
      <input class="input" id="f_icon" value="${escapeAttr(tool?.icon || '')}" placeholder="📊" maxlength="2">
      <label class="field-label">How should this open?</label>
      <select class="input" id="f_openMode">
        <option value="tab" ${!tool || tool.openMode !== 'embed' ? 'selected' : ''}>New tab (safest — works with everything)</option>
        <option value="embed" ${tool?.openMode === 'embed' ? 'selected' : ''}>Inside the dashboard (only if the tool allows embedding)</option>
      </select>
      ${isEdit ? `<div class="checkbox-row"><input type="checkbox" id="f_active" ${tool?.active ? 'checked' : ''}>
        <label for="f_active">Visible on the dashboard</label></div>` : ''}
      <div id="f_error" class="form-error" hidden></div>
    `, [
      { label: 'Cancel', cls: 'btn', onClick: closeModal },
      { label: isEdit ? 'Save changes' : 'Add tool', cls: 'btn btn-primary', onClick: () => saveToolFromModal(tool) }
    ]);
  }

  async function saveToolFromModal(existing) {
    const data = {
      id: existing ? existing.id : null,
      name: document.getElementById('f_name').value.trim(),
      description: document.getElementById('f_description').value.trim(),
      url: document.getElementById('f_url').value.trim(),
      category: document.getElementById('f_category').value.trim() || 'Other',
      icon: document.getElementById('f_icon').value.trim() || '🔧',
      colorTag: '',
      openMode: document.getElementById('f_openMode').value,
      active: existing ? document.getElementById('f_active').checked : true,
      sortOrder: existing ? existing.sortOrder : 0
    };
    const errBox = document.getElementById('f_error');
    if (!data.name || !data.url) {
      errBox.textContent = 'Name and link are required.';
      errBox.hidden = false;
      return;
    }
    try {
      await runServer('adminSaveTool', STATE.token, data);
      closeModal();
      showToast(existing ? 'Tool updated.' : 'Tool added.');
      loadAdminTools();
    } catch (err) {
      errBox.textContent = errMsg(err);
      errBox.hidden = false;
    }
  }

  function confirmDeleteTool(id) {
    const tool = STATE.adminTools.find(t => t.id === id);
    openModal('Delete tool', `<p>Delete <strong>${escapeHtml(tool.name)}</strong>? This also removes everyone's access to it.</p>`, [
      { label: 'Cancel', cls: 'btn', onClick: closeModal },
      { label: 'Delete', cls: 'btn btn-danger', onClick: async () => {
        try {
          await runServer('adminDeleteTool', STATE.token, id);
          closeModal();
          showToast('Tool deleted.');
          loadAdminTools();
        } catch (err) { showToast(errMsg(err), 'error'); }
      } }
    ]);
  }

  /* =============================== SETTINGS: PERMISSIONS =============================== */

  async function loadPermMatrix() {
    try {
      STATE.permData = await runServer('adminGetPermissionsData', STATE.token);
      renderPermMatrix();
    } catch (err) { showToast(errMsg(err), 'error'); }
  }

  function renderPermMatrix() {
    const { users, tools, perms } = STATE.permData;
    const grantSet = new Set(perms.map(p => p.userId + '::' + p.toolId));
    STATE.permOriginal = grantSet;
    STATE.permCurrent = new Set(grantSet);

    const table = document.getElementById('permMatrixTable');
    if (!users.length || !tools.length) {
      table.innerHTML = '';
      document.querySelector('#panel-permissions .table-card').insertAdjacentHTML('beforeend', '');
      table.parentElement.innerHTML = '<div class="empty-state"><div class="empty-emoji">🔒</div><div class="empty-title">Add users and tools first</div><div class="empty-sub">The permission matrix appears once you have at least one of each.</div></div>';
      return;
    }

    let thead = '<thead><tr><th class="matrix-corner">Tool</th>';
    users.forEach(u => thead += `<th class="matrix-user-head">${escapeHtml(u.fullName || u.username)}</th>`);
    thead += '</tr></thead>';

    let tbody = '<tbody>';
    tools.forEach(t => {
      tbody += `<tr><td class="matrix-tool-name">${escapeHtml(t.name)}<span class="matrix-cat">${escapeHtml(t.category || '')}</span></td>`;
      users.forEach(u => {
        const key = u.id + '::' + t.id;
        const checked = grantSet.has(key) || u.isSettingsAdmin;
        const disabled = u.isSettingsAdmin;
        tbody += `<td class="matrix-cell"><input type="checkbox" data-key="${key}" ${checked ? 'checked' : ''} ${disabled ? 'disabled title="Admins always have full access"' : ''}></td>`;
      });
      tbody += '</tr>';
    });
    tbody += '</tbody>';
    table.innerHTML = thead + tbody;

    table.querySelectorAll('input[type=checkbox]:not([disabled])').forEach(cb => {
      cb.addEventListener('change', () => {
        const key = cb.dataset.key;
        if (cb.checked) STATE.permCurrent.add(key); else STATE.permCurrent.delete(key);
      });
    });
  }

  async function onSavePermissions() {
    const add = [], remove = [];
    STATE.permCurrent.forEach(key => { if (!STATE.permOriginal.has(key)) add.push(keyToGrant(key)); });
    STATE.permOriginal.forEach(key => { if (!STATE.permCurrent.has(key)) remove.push(keyToGrant(key)); });
    if (!add.length && !remove.length) { showToast('No changes to save.'); return; }
    try {
      await runServer('adminSavePermissions', STATE.token, add, remove);
      showToast('Permissions updated.');
      await loadPermMatrix();
    } catch (err) { showToast(errMsg(err), 'error'); }
  }

  function keyToGrant(key) {
    const [userId, toolId] = key.split('::');
    return { userId, toolId };
  }

  /* =============================== CHANGE PASSWORD =============================== */

  function openChangePasswordModal() {
    document.getElementById('userDropdown').hidden = true;
    openModal('Change password', `
      <label class="field-label">Current password</label>
      <input class="input" id="f_current" type="password">
      <label class="field-label">New password (min. 8 characters)</label>
      <input class="input" id="f_new" type="password">
      <div id="f_error" class="form-error" hidden></div>
    `, [
      { label: 'Cancel', cls: 'btn', onClick: closeModal },
      { label: 'Update password', cls: 'btn btn-primary', onClick: submitChangePassword }
    ]);
  }

  async function submitChangePassword() {
    const current = document.getElementById('f_current').value;
    const next = document.getElementById('f_new').value;
    const errBox = document.getElementById('f_error');
    try {
      const res = await runServer('changeMyPassword', STATE.token, current, next);
      if (!res.success) {
        errBox.textContent = res.message;
        errBox.hidden = false;
        return;
      }
      closeModal();
      showToast('Password updated.');
    } catch (err) {
      errBox.textContent = errMsg(err);
      errBox.hidden = false;
    }
  }

  /* =============================== FORGOT PASSWORD =============================== */

  function openForgotPasswordModal() {
    openModal('Reset your password', `
      <label class="field-label">Username or email</label>
      <input class="input" id="fp_identifier" placeholder="you@company.com or username">
      <div class="field-hint" style="margin-top:10px;">We'll email a 6-digit code to the address on file for that account. Codes expire after 15 minutes.</div>
      <div id="fp_error" class="form-error" hidden></div>
    `, [
      { label: 'Cancel', cls: 'btn', onClick: closeModal },
      { label: 'Send code', cls: 'btn btn-primary', onClick: submitForgotPasswordRequest }
    ]);
  }

  async function submitForgotPasswordRequest() {
    const identifier = document.getElementById('fp_identifier').value.trim();
    const errBox = document.getElementById('fp_error');
    if (!identifier) {
      errBox.textContent = 'Enter your username or email.';
      errBox.hidden = false;
      return;
    }
    try {
      const res = await runServer('requestPasswordReset', identifier);
      openResetCodeModal(identifier);
      showToast(res.message);
    } catch (err) {
      errBox.textContent = errMsg(err);
      errBox.hidden = false;
    }
  }

  function openResetCodeModal(identifier) {
    openModal('Enter your reset code', `
      <div class="field-hint">Sent to the email on file for <strong>${escapeHtml(identifier)}</strong>, if that account exists.</div>
      <label class="field-label">6-digit code</label>
      <input class="input" id="fp_code" maxlength="6" inputmode="numeric" placeholder="123456">
      <label class="field-label">New password (min. 8 characters)</label>
      <input class="input" id="fp_newpw" type="password">
      <div id="fp2_error" class="form-error" hidden></div>
    `, [
      { label: 'Back', cls: 'btn', onClick: openForgotPasswordModal },
      { label: 'Reset password', cls: 'btn btn-primary', onClick: () => submitResetWithCode(identifier) }
    ]);
  }

  async function submitResetWithCode(identifier) {
    const code = document.getElementById('fp_code').value.trim();
    const newPw = document.getElementById('fp_newpw').value;
    const errBox = document.getElementById('fp2_error');
    try {
      const res = await runServer('resetPasswordWithCode', identifier, code, newPw);
      if (!res.success) {
        errBox.textContent = res.message;
        errBox.hidden = false;
        return;
      }
      closeModal();
      showToast('Password updated — you can sign in now.');
    } catch (err) {
      errBox.textContent = errMsg(err);
      errBox.hidden = false;
    }
  }

  /* =============================== MODAL / TOAST HELPERS =============================== */

  function openModal(title, bodyHtml, buttons) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    const footer = document.getElementById('modalFooter');
    footer.innerHTML = '';
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.className = b.cls;
      btn.textContent = b.label;
      btn.addEventListener('click', b.onClick);
      footer.appendChild(btn);
    });
    document.getElementById('modalOverlay').hidden = false;
  }

  function closeModal() {
    document.getElementById('modalOverlay').hidden = true;
  }

  let toastTimer = null;
  function showToast(message, type) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeAttr(str) { return escapeHtml(str); }

