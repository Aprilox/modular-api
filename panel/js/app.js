/**
 * Modular API - Panel Admin JavaScript
 */

// API Base URL
const API_URL = window.location.origin;

// State
let token = localStorage.getItem('token');
let currentSection = 'dashboard';
let ideEditor = null;

// ============================================
// UTILITIES
// ============================================

async function api(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include'
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || data.error || 'Une erreur est survenue');
  }
  
  return data;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-message">${message}</span>
    <button class="toast-close">&times;</button>
  `;
  
  container.appendChild(toast);
  
  toast.querySelector('.toast-close').onclick = () => toast.remove();
  
  setTimeout(() => toast.remove(), 5000);
}

function formatDate(date) {
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  if (seconds < 60) return 'À l\'instant';
  if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)} h`;
  return formatDate(date);
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function updateCodeHelp(language) {
  const helpEl = document.getElementById('code-help');
  const helps = {
    javascript: `<strong>Variables:</strong> request, params, query, body, headers<br>
                 <strong>Fonctions:</strong> json(data, status), respond(data, status, headers)`,
    python: `<strong>Variables:</strong> request, params, query, body, headers<br>
             <strong>Fonctions:</strong> json_response(data, status), respond(data, status, headers)`,
    php: `<strong>Variables:</strong> $request, $params, $query, $body, $headers<br>
          <strong>Fonctions:</strong> json($data, $status), respond($data, $status, $headers)`,
    ruby: `<strong>Variables:</strong> request, params, query, body, headers<br>
           <strong>Fonctions:</strong> json(data, status), respond(data, status, headers)`,
    go: `<strong>Variables:</strong> request, params, query, body, headers (map[string]interface{})<br>
         <strong>Fonctions:</strong> jsonResp(data, status), respond(data, status, headers)`,
    perl: `<strong>Variables:</strong> $request, $params, $query, $body, $headers<br>
           <strong>Fonctions:</strong> json_resp($data, $status), respond($data, $status, $headers)`,
    bash: `<strong>Variables d'env:</strong> REQUEST_METHOD, REQUEST_PATH, REQUEST_QUERY, REQUEST_BODY<br>
           <strong>Sortie:</strong> echo ou Write-Output pour retourner du texte/JSON`
  };
  helpEl.innerHTML = helps[language] || helps.javascript;
}

// ============================================
// AUTHENTICATION
// ============================================

async function checkAuth() {
  if (!token) {
    showLoginScreen();
    return false;
  }
  
  try {
    await api('/auth/verify');
    showDashboard();
    return true;
  } catch (e) {
    token = null;
    localStorage.removeItem('token');
    showLoginScreen();
    return false;
  }
}

function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('dashboard').classList.add('hidden');
}

function showDashboard() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  loadDashboardData();
}

async function login(password) {
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    
    token = data.token;
    localStorage.setItem('token', token);
    showDashboard();
    showToast('Connexion réussie', 'success');
  } catch (e) {
    document.getElementById('login-error').textContent = e.message;
    document.getElementById('login-error').classList.remove('hidden');
  }
}

async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch (e) {}
  
  token = null;
  localStorage.removeItem('token');
  showLoginScreen();
  showToast('Déconnexion réussie', 'info');
}

function openSettingsModal() {
  document.getElementById('settings-modal').classList.remove('hidden');
  document.getElementById('password-form').reset();
}

async function changePassword(currentPassword, newPassword) {
  try {
    await api('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    
    showToast('Mot de passe modifié avec succès', 'success');
    document.getElementById('settings-modal').classList.add('hidden');
    document.getElementById('password-form').reset();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ============================================
// IDE EDITOR
// ============================================

function getCodeMirrorMode(language) {
  const modes = {
    javascript: 'javascript',
    python: 'python',
    php: 'php',
    ruby: 'ruby',
    go: 'go',
    perl: 'perl',
    bash: 'shell'
  };
  return modes[language] || 'javascript';
}

function openIDE() {
  const modal = document.getElementById('ide-modal');
  const language = document.getElementById('route-language').value;
  const code = document.getElementById('route-code').value;
  
  // Update language badge
  document.getElementById('ide-language-badge').textContent = language;
  
  // Update help text
  const helps = {
    javascript: `<strong>Variables:</strong> request, params, query, body, headers | <strong>Fonctions:</strong> json(data, status), respond(data, status, headers)`,
    python: `<strong>Variables:</strong> request, params, query, body, headers | <strong>Fonctions:</strong> json_response(data, status), respond(data, status, headers)`,
    php: `<strong>Variables:</strong> $request, $params, $query, $body, $headers | <strong>Fonctions:</strong> json($data, $status), respond($data, $status, $headers)`,
    ruby: `<strong>Variables:</strong> request, params, query, body, headers | <strong>Fonctions:</strong> json(data, status), respond(data, status, headers)`,
    go: `<strong>Variables:</strong> request, params, query, body, headers | <strong>Fonctions:</strong> jsonResp(data, status), respond(data, status, headers)`,
    perl: `<strong>Variables:</strong> $request, $params, $query, $body, $headers | <strong>Fonctions:</strong> json_resp($data, $status), respond($data, $status, $headers)`,
    bash: `<strong>Variables d'env:</strong> REQUEST_METHOD, REQUEST_PATH, REQUEST_QUERY, REQUEST_BODY | <strong>Sortie:</strong> echo / Write-Output`
  };
  document.getElementById('ide-help').innerHTML = helps[language] || helps.javascript;
  
  // Initialize or update CodeMirror
  if (!ideEditor) {
    ideEditor = CodeMirror.fromTextArea(document.getElementById('ide-editor'), {
      mode: getCodeMirrorMode(language),
      theme: 'dracula',
      lineNumbers: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: false,
      lineWrapping: true
    });
  } else {
    ideEditor.setOption('mode', getCodeMirrorMode(language));
  }
  
  ideEditor.setValue(code);
  modal.classList.remove('hidden');
  
  // Refresh after modal is visible
  setTimeout(() => {
    ideEditor.refresh();
    ideEditor.focus();
  }, 100);
}

function applyCodeFromIDE() {
  if (ideEditor) {
    document.getElementById('route-code').value = ideEditor.getValue();
  }
  document.getElementById('ide-modal').classList.add('hidden');
  showToast('Code appliqué', 'success');
}

// ============================================
// NAVIGATION
// ============================================

function switchSection(section) {
  currentSection = section;
  
  // Update nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === section);
  });
  
  // Update sections
  document.querySelectorAll('.section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `section-${section}`);
  });
  
  // Load data
  switch (section) {
    case 'dashboard':
      loadDashboardData();
      break;
    case 'routes':
      loadRoutes();
      break;
    case 'keys':
      loadKeys();
      break;
    case 'logs':
      loadLogs();
      break;
  }
}

// ============================================
// DASHBOARD
// ============================================

async function loadDashboardData() {
  try {
    const data = await api('/admin/stats');
    
    document.getElementById('stat-routes').textContent = data.stats.routes;
    document.getElementById('stat-keys').textContent = data.stats.apiKeys;
    document.getElementById('stat-requests').textContent = data.stats.requests24h;
    document.getElementById('stat-response').innerHTML = `${data.stats.avgResponseTime}<small>ms</small>`;
    
    renderRecentLogs(data.recentLogs.slice(0, 10));
  } catch (e) {
    showToast('Erreur lors du chargement des statistiques', 'error');
  }
}

function renderRecentLogs(logs) {
  const container = document.getElementById('recent-logs');
  
  if (!logs.length) {
    container.innerHTML = '<p class="empty-state">Aucune requête enregistrée</p>';
    return;
  }
  
  container.innerHTML = logs.map(log => `
    <div class="log-item">
      <div class="log-status ${log.statusCode < 400 ? 'success' : log.statusCode < 500 ? 'warning' : 'error'}"></div>
      <div class="log-info">
        <div class="log-path">
          <span class="method-badge ${log.method.toLowerCase()}">${log.method}</span>
          ${log.path}
        </div>
        <div class="log-details">
          ${log.statusCode} · ${log.responseTime}ms · ${log.ip}
        </div>
      </div>
      <div class="log-time">${formatTimeAgo(log.createdAt)}</div>
    </div>
  `).join('');
}

// ============================================
// ROUTES
// ============================================

let routes = [];

async function loadRoutes() {
  try {
    const data = await api('/admin/routes');
    routes = data.routes;
    renderRoutes();
  } catch (e) {
    showToast('Erreur lors du chargement des routes', 'error');
  }
}

function renderRoutes() {
  const container = document.getElementById('routes-list');
  
  if (!routes.length) {
    container.innerHTML = '<p class="empty-state">Aucune route créée. Cliquez sur "Nouvelle route" pour commencer.</p>';
    return;
  }
  
  container.innerHTML = routes.map(route => `
    <div class="route-card" data-id="${route.id}">
      <div class="route-card-header">
        <div class="route-info">
          <h4>
            <span class="method-badge ${route.method.toLowerCase()}">${route.method}</span>
            ${route.name}
          </h4>
          <div class="route-path">/api${route.path}</div>
        </div>
        <div class="route-status ${route.enabled ? '' : 'disabled'}"></div>
      </div>
      <div class="route-card-body">
        <div class="route-meta">
          <span class="route-meta-item">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633z" clip-rule="evenodd"/></svg>
            ${route.language}
          </span>
          <span class="route-meta-item">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>
            ${route.authType === 'none' ? 'Public' : 'Sécurisé'}
          </span>
          ${route.rateLimitEnabled ? `
            <span class="route-meta-item">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
              ${route.rateLimitRequests}/${route.rateLimitWindow}s
            </span>
          ` : ''}
        </div>
      </div>
      <div class="route-card-footer">
        <button class="btn btn-sm btn-secondary" onclick="editRoute('${route.id}')">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
          Modifier
        </button>
        <button class="btn btn-sm btn-danger" onclick="deleteRoute('${route.id}')">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
          Supprimer
        </button>
      </div>
    </div>
  `).join('');
}

function openRouteModal(route = null) {
  const modal = document.getElementById('route-modal');
  const form = document.getElementById('route-form');
  const title = document.getElementById('route-modal-title');
  
  form.reset();
  
  if (route) {
    title.textContent = 'Modifier la route';
    document.getElementById('route-id').value = route.id;
    document.getElementById('route-name').value = route.name;
    document.getElementById('route-method').value = route.method;
    document.getElementById('route-path').value = route.path;
    document.getElementById('route-description').value = route.description || '';
    document.getElementById('route-language').value = route.language;
    document.getElementById('route-auth').value = route.authType;
    document.getElementById('route-code').value = route.code;
    document.getElementById('route-ratelimit').checked = route.rateLimitEnabled;
    document.getElementById('route-ratelimit-requests').value = route.rateLimitRequests;
    document.getElementById('route-ratelimit-window').value = route.rateLimitWindow;
    document.getElementById('route-ratelimit-by').value = route.rateLimitBy;
    document.getElementById('route-enabled').checked = route.enabled;
    
    document.getElementById('ratelimit-config').classList.toggle('hidden', !route.rateLimitEnabled);
    updateCodeHelp(route.language);
  } else {
    title.textContent = 'Nouvelle route';
    document.getElementById('route-id').value = '';
    document.getElementById('route-language').value = 'javascript';
    document.getElementById('route-code').value = `json({ message: "Hello World!" });`;
    updateCodeHelp('javascript');
  }
  
  modal.classList.remove('hidden');
}

function editRoute(id) {
  const route = routes.find(r => r.id === id);
  if (route) openRouteModal(route);
}

async function saveRoute(formData) {
  const id = formData.get('id');
  const data = {
    name: formData.get('name'),
    method: formData.get('method'),
    path: formData.get('path'),
    description: formData.get('description'),
    language: formData.get('language'),
    authType: formData.get('authType'),
    code: formData.get('code'),
    rateLimitEnabled: formData.get('rateLimitEnabled') === 'on',
    rateLimitRequests: parseInt(formData.get('rateLimitRequests')) || 100,
    rateLimitWindow: parseInt(formData.get('rateLimitWindow')) || 60,
    rateLimitBy: formData.get('rateLimitBy'),
    enabled: formData.get('enabled') === 'on'
  };
  
  try {
    if (id) {
      await api(`/admin/routes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      showToast('Route modifiée avec succès', 'success');
    } else {
      await api('/admin/routes', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      showToast('Route créée avec succès', 'success');
    }
    
    document.getElementById('route-modal').classList.add('hidden');
    loadRoutes();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deleteRoute(id) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer cette route ?')) return;
  
  try {
    await api(`/admin/routes/${id}`, { method: 'DELETE' });
    showToast('Route supprimée', 'success');
    loadRoutes();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ============================================
// API KEYS
// ============================================

let keys = [];

async function loadKeys() {
  try {
    const data = await api('/admin/keys');
    keys = data.keys;
    renderKeys();
  } catch (e) {
    showToast('Erreur lors du chargement des clés API', 'error');
  }
}

async function renderKeys() {
  const container = document.getElementById('keys-list');
  
  if (!keys.length) {
    container.innerHTML = '<p class="empty-state">Aucune clé API créée. Cliquez sur "Nouvelle clé" pour commencer.</p>';
    return;
  }
  
  // Load routes to display names
  let routesMap = {};
  try {
    const data = await api('/admin/routes');
    data.routes.forEach(r => {
      routesMap[r.id] = r;
    });
  } catch (e) {}
  
  container.innerHTML = keys.map(key => {
    // Build permissions display
    let permissionsHtml = '';
    if (key.permissions === '*') {
      permissionsHtml = '<span class="key-badge">Toutes les routes</span>';
    } else {
      const routeIds = key.permissions.split(',').map(p => p.trim());
      const routeTags = routeIds.map(id => {
        const route = routesMap[id];
        if (route) {
          return `<span class="key-permission-tag">
            <span class="method-badge ${route.method.toLowerCase()}">${route.method}</span>
            ${route.path}
          </span>`;
        }
        return '';
      }).filter(Boolean).join('');
      permissionsHtml = routeTags || '<span class="key-badge">Aucune route</span>';
    }
    
    // Auth method display
    const authMethod = key.authMethod || 'header';
    let authMethodLabel = {
      header: 'X-API-Key',
      bearer: 'Bearer',
      query: '?api_key',
      custom: key.customHeader || 'Custom'
    }[authMethod];
    
    return `
    <div class="key-card" data-id="${key.id}">
      <div class="key-card-header">
        <span class="key-name">
          ${key.name}
          <span class="key-badge ${key.enabled ? 'active' : 'inactive'}">${key.enabled ? 'Active' : 'Inactive'}</span>
        </span>
        <span class="key-auth-method">${authMethodLabel}</span>
      </div>
      <div class="key-value">
        <code>${key.key}</code>
        <button onclick="copyToClipboard('${key.key}')" title="Copier">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg>
        </button>
      </div>
      <div class="key-permissions-list">
        ${permissionsHtml}
      </div>
      <div class="key-meta">
        <span class="key-badge">${formatNumber(key.totalRequests || 0)} requêtes</span>
        ${key.quotaEnabled ? `<span class="key-badge">Quota: ${key.quotaUsed}/${key.quotaLimit}</span>` : ''}
      </div>
      <div class="key-card-footer">
        <button class="btn btn-sm btn-secondary" onclick="editKey('${key.id}')">Modifier</button>
        <button class="btn btn-sm btn-secondary" onclick="regenerateKey('${key.id}')">Régénérer</button>
        <button class="btn btn-sm btn-danger" onclick="deleteKey('${key.id}')">Supprimer</button>
      </div>
    </div>
  `}).join('');
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  showToast('Clé copiée dans le presse-papier', 'success');
}

async function openKeyModal(key = null) {
  const modal = document.getElementById('key-modal');
  const form = document.getElementById('key-form');
  const title = document.getElementById('key-modal-title');
  
  form.reset();
  
  // Load routes for permissions
  await loadRoutesForPermissions();
  
  if (key) {
    title.textContent = 'Modifier la clé API';
    document.getElementById('key-id').value = key.id;
    document.getElementById('key-name').value = key.name;
    document.getElementById('key-auth-method').value = key.authMethod || 'header';
    document.getElementById('key-custom-header').value = key.customHeader || '';
    document.getElementById('key-permissions').value = key.permissions;
    document.getElementById('custom-header-config').classList.toggle('hidden', (key.authMethod || 'header') !== 'custom');
    document.getElementById('key-quota').checked = key.quotaEnabled;
    document.getElementById('key-quota-limit').value = key.quotaLimit;
    document.getElementById('key-quota-period').value = key.quotaPeriod;
    document.getElementById('key-enabled').checked = key.enabled;
    
    document.getElementById('quota-config').classList.toggle('hidden', !key.quotaEnabled);
    
    // Set permissions checkboxes
    const isAll = key.permissions === '*';
    document.getElementById('key-permissions-all').checked = isAll;
    document.getElementById('routes-permissions-list').classList.toggle('hidden', isAll);
    
    if (!isAll) {
      const permittedRoutes = key.permissions.split(',').map(p => p.trim());
      document.querySelectorAll('.route-permission-checkbox').forEach(cb => {
        cb.checked = permittedRoutes.includes(cb.value);
      });
    }
    
    updateAuthMethodHelp(key.authMethod || 'header');
  } else {
    title.textContent = 'Nouvelle clé API';
    document.getElementById('key-id').value = '';
    document.getElementById('key-auth-method').value = 'header';
    document.getElementById('key-permissions-all').checked = true;
    document.getElementById('routes-permissions-list').classList.add('hidden');
    updateAuthMethodHelp('header');
  }
  
  modal.classList.remove('hidden');
}

function updateAuthMethodHelp(method, customHeader = '') {
  const helpEl = document.getElementById('auth-method-help');
  const keyValue = document.getElementById('key-id').value ? 
    (keys.find(k => k.id === document.getElementById('key-id').value)?.key || 'votre_clé') : 
    'votre_clé';
  
  const headerName = customHeader || document.getElementById('key-custom-header')?.value || 'X-Custom-Key';
  
  const helps = {
    header: `<code>X-API-Key: ${keyValue}</code>`,
    bearer: `<code>Authorization: Bearer ${keyValue}</code>`,
    query: `<code>?api_key=${keyValue}</code>`,
    custom: `<code>${headerName}: ${keyValue}</code>`
  };
  helpEl.innerHTML = helps[method] || helps.header;
  
  // Show/hide custom header input
  const customConfig = document.getElementById('custom-header-config');
  if (customConfig) {
    customConfig.classList.toggle('hidden', method !== 'custom');
  }
}

async function loadRoutesForPermissions() {
  const container = document.getElementById('routes-permissions-list');
  
  try {
    const data = await api('/admin/routes');
    
    if (!data.routes.length) {
      container.innerHTML = '<p class="empty-state">Aucune route disponible</p>';
      return;
    }
    
    container.innerHTML = data.routes.map(route => `
      <label class="checkbox-label">
        <input type="checkbox" class="route-permission-checkbox" value="${route.id}">
        <span class="route-permission-item">
          <span class="method-badge ${route.method.toLowerCase()}">${route.method}</span>
          <span class="route-path">/api${route.path}</span>
          <span style="color: var(--gray-400);">- ${route.name}</span>
        </span>
      </label>
    `).join('');
    
    // Add change listeners to update hidden input
    container.querySelectorAll('.route-permission-checkbox').forEach(cb => {
      cb.addEventListener('change', updatePermissionsValue);
    });
  } catch (e) {
    container.innerHTML = '<p class="empty-state">Erreur de chargement</p>';
  }
}

function updatePermissionsValue() {
  const allChecked = document.getElementById('key-permissions-all').checked;
  
  if (allChecked) {
    document.getElementById('key-permissions').value = '*';
  } else {
    const selected = Array.from(document.querySelectorAll('.route-permission-checkbox:checked'))
      .map(cb => cb.value);
    document.getElementById('key-permissions').value = selected.length ? selected.join(',') : '*';
  }
}

function editKey(id) {
  const key = keys.find(k => k.id === id);
  if (key) openKeyModal(key);
}

async function saveKey(formData) {
  const id = formData.get('id');
  const authMethod = formData.get('authMethod') || 'header';
  const data = {
    name: formData.get('name'),
    authMethod: authMethod,
    customHeader: authMethod === 'custom' ? formData.get('customHeader') : null,
    permissions: formData.get('permissions') || '*',
    quotaEnabled: formData.get('quotaEnabled') === 'on',
    quotaLimit: parseInt(formData.get('quotaLimit')) || 10000,
    quotaPeriod: formData.get('quotaPeriod'),
    enabled: formData.get('enabled') === 'on'
  };
  
  try {
    if (id) {
      await api(`/admin/keys/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      showToast('Clé API modifiée avec succès', 'success');
    } else {
      const result = await api('/admin/keys', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      showToast(`Clé créée: ${result.apiKey.key}`, 'success');
    }
    
    document.getElementById('key-modal').classList.add('hidden');
    loadKeys();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function regenerateKey(id) {
  if (!confirm('Êtes-vous sûr de vouloir régénérer cette clé ? L\'ancienne clé ne fonctionnera plus.')) return;
  
  try {
    const result = await api(`/admin/keys/${id}/regenerate`, { 
      method: 'POST',
      body: JSON.stringify({})
    });
    showToast(`Nouvelle clé: ${result.apiKey.key}`, 'success');
    loadKeys();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deleteKey(id) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer cette clé API ?')) return;
  
  try {
    await api(`/admin/keys/${id}`, { method: 'DELETE' });
    showToast('Clé API supprimée', 'success');
    loadKeys();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ============================================
// LOGS
// ============================================

async function loadLogs() {
  try {
    const data = await api('/admin/logs?limit=100');
    renderLogsTable(data.logs);
  } catch (e) {
    showToast('Erreur lors du chargement des logs', 'error');
  }
}

function renderLogsTable(logs) {
  const container = document.getElementById('all-logs');
  
  if (!logs.length) {
    container.innerHTML = '<p class="empty-state">Aucun log enregistré</p>';
    return;
  }
  
  container.innerHTML = `
    <table class="logs-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Méthode</th>
          <th>Path</th>
          <th>Status</th>
          <th>Temps</th>
          <th>IP</th>
        </tr>
      </thead>
      <tbody>
        ${logs.map(log => `
          <tr>
            <td>${formatDate(log.createdAt)}</td>
            <td><span class="method-badge ${log.method.toLowerCase()}">${log.method}</span></td>
            <td style="font-family: monospace; font-size: 0.85rem;">${log.path}</td>
            <td><span style="color: ${log.statusCode < 400 ? 'var(--success)' : 'var(--danger)'}">${log.statusCode}</span></td>
            <td>${log.responseTime}ms</td>
            <td>${log.ip}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function clearLogs() {
  if (!confirm('Êtes-vous sûr de vouloir supprimer tous les logs ?')) return;
  
  try {
    await api('/admin/logs', { method: 'DELETE' });
    showToast('Logs supprimés', 'success');
    loadLogs();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Check auth on load
  checkAuth();
  
  // Login form
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const password = document.getElementById('password').value;
    login(password);
  });
  
  // Logout
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('logout-btn-modal').addEventListener('click', logout);
  
  // Settings
  document.getElementById('settings-btn').addEventListener('click', openSettingsModal);
  
  // Password change form
  document.getElementById('password-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;
    
    if (newPassword !== confirmPassword) {
      showToast('Les mots de passe ne correspondent pas', 'error');
      return;
    }
    
    if (newPassword.length < 8) {
      showToast('Le mot de passe doit contenir au moins 8 caractères', 'error');
      return;
    }
    
    changePassword(currentPassword, newPassword);
  });
  
  // IDE
  document.getElementById('btn-open-ide').addEventListener('click', openIDE);
  document.getElementById('btn-apply-code').addEventListener('click', applyCodeFromIDE);
  
  // Navigation
  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchSection(item.dataset.section);
    });
  });
  
  // New route button
  document.getElementById('btn-new-route').addEventListener('click', () => openRouteModal());
  
  // New key button
  document.getElementById('btn-new-key').addEventListener('click', () => openKeyModal());
  
  // Clear logs button
  document.getElementById('btn-clear-logs').addEventListener('click', clearLogs);
  
  // Route form
  document.getElementById('route-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveRoute(new FormData(e.target));
  });
  
  // Key form
  document.getElementById('key-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveKey(new FormData(e.target));
  });
  
  // Rate limit toggle
  document.getElementById('route-ratelimit').addEventListener('change', (e) => {
    document.getElementById('ratelimit-config').classList.toggle('hidden', !e.target.checked);
  });
  
  // Language change - update help text
  document.getElementById('route-language').addEventListener('change', (e) => {
    updateCodeHelp(e.target.value);
  });
  
  // Quota toggle
  document.getElementById('key-quota').addEventListener('change', (e) => {
    document.getElementById('quota-config').classList.toggle('hidden', !e.target.checked);
  });
  
  // Permissions toggle
  document.getElementById('key-permissions-all').addEventListener('change', (e) => {
    document.getElementById('routes-permissions-list').classList.toggle('hidden', e.target.checked);
    updatePermissionsValue();
  });
  
  // Auth method change
  document.getElementById('key-auth-method').addEventListener('change', (e) => {
    updateAuthMethodHelp(e.target.value);
  });
  
  // Custom header input change
  document.getElementById('key-custom-header').addEventListener('input', (e) => {
    updateAuthMethodHelp('custom', e.target.value);
  });
  
  // Modal close buttons
  document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').classList.add('hidden');
    });
  });
  
  // Modal overlay click to close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', () => {
      overlay.closest('.modal').classList.add('hidden');
    });
  });
});

