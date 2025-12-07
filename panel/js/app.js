/**
 * Modular API - Panel Admin JavaScript
 */

// API Base URL
const API_URL = window.location.origin;

// Nettoyer l'URL de tout paramètre sensible au chargement
(function cleanURL() {
  if (window.location.search || window.location.hash) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
})();

// Empêcher le retour arrière vers une page authentifiée après déconnexion
window.addEventListener('pageshow', function(event) {
  if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
    // Page chargée depuis le cache (bouton retour)
    if (!localStorage.getItem('token')) {
      window.location.reload();
    }
  }
});

// State
let token = localStorage.getItem('token');
let currentSection = 'dashboard';
let ideEditor = null;

// ============================================
// UTILITIES
// ============================================

async function api(endpoint, options = {}) {
  const headers = {
    ...options.headers
  };
  
  // Ajouter Content-Type seulement si on a un body
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  
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
             <strong>Fonctions:</strong> json_response(data, status), respond(data, status, headers)`
  };
  helpEl.innerHTML = helps[language] || helps.javascript;
}

// ============================================
// AUTHENTICATION
// ============================================

async function checkAuth() {
  // D'abord vérifier si l'application est configurée
  try {
    const status = await fetch(`${API_URL}/auth/status`).then(r => r.json());
    
    if (status.needsSetup) {
      showSetupScreen();
      return false;
    }
  } catch (e) {
    console.error('Erreur vérification status:', e);
  }
  
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

function showSetupScreen() {
  document.getElementById('setup-screen').classList.remove('hidden');
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('dashboard').classList.add('hidden');
}

function showLoginScreen() {
  document.getElementById('setup-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('dashboard').classList.add('hidden');
}

function showDashboard() {
  document.getElementById('setup-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  loadDashboardData();
  // Vérifier les dépendances manquantes en arrière-plan
  checkMissingDependencies();
}

async function login(password) {
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    
    token = data.token;
    localStorage.setItem('token', token);
    
    // Nettoyer le champ mot de passe
    document.getElementById('password').value = '';
    document.getElementById('login-error').classList.add('hidden');
    
    showDashboard();
    showToast('Connexion réussie', 'success');
  } catch (e) {
    // Nettoyer le champ mot de passe en cas d'erreur aussi
    document.getElementById('password').value = '';
    document.getElementById('login-error').textContent = e.message;
    document.getElementById('login-error').classList.remove('hidden');
  }
}

async function logout() {
  try {
    await api('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
  } catch (e) {}
  
  // Supprimer toutes les données de session
  token = null;
  localStorage.removeItem('token');
  sessionStorage.clear();
  
  // Supprimer les cookies côté client
  document.cookie.split(";").forEach(c => {
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
  
  // Fermer tous les modals ouverts
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.add('hidden');
  });
  
  // Remplacer l'historique pour empêcher le retour arrière
  window.history.replaceState(null, '', '/panel/');
  
  showLoginScreen();
  showToast('Déconnexion réussie', 'info');
  
  // Recharger la page pour nettoyer complètement l'état
  setTimeout(() => {
    window.location.reload();
  }, 500);
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
    bash: 'shell'
  };
  return modes[language] || 'javascript';
}

function openIDE() {
  const modal = document.getElementById('ide-modal');
  const language = document.getElementById('route-language').value;
  const code = document.getElementById('route-code').value;
  
  // Update language select
  document.getElementById('ide-language-select').value = language;
  
  // Update help text
  updateIDEHelp(language);
  
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

function updateIDEHelp(language) {
  const helps = {
    javascript: `<strong>Variables:</strong> request, params, query, body, headers | <strong>Fonctions:</strong> json(data, status), respond(data, status, headers)`,
    python: `<strong>Variables:</strong> request, params, query, body, headers | <strong>Fonctions:</strong> json_response(data, status), respond(data, status, headers)`
  };
  document.getElementById('ide-help').innerHTML = helps[language] || helps.javascript;
}

function changeIDELanguage(language) {
  // Update CodeMirror mode
  if (ideEditor) {
    ideEditor.setOption('mode', getCodeMirrorMode(language));
  }
  
  // Update help text
  updateIDEHelp(language);
  
  // Sync with route form
  document.getElementById('route-language').value = language;
  updateCodeHelp(language);
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
    case 'dependencies':
      loadDependencies();
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
    
    // Stats du cache
    if (data.stats.cache && data.stats.cache.hitRate) {
      const hitRate = data.stats.cache.hitRate.replace('%', '');
      document.getElementById('stat-cache').innerHTML = `${hitRate}<small>%</small>`;
    } else {
      document.getElementById('stat-cache').innerHTML = `0<small>%</small>`;
    }
    
    renderRecentLogs(data.recentLogs.slice(0, 10));
  } catch (e) {
    showToast('Erreur lors du chargement des statistiques', 'error');
  }
}

let recentLogs = [];

function renderRecentLogs(logs) {
  const container = document.getElementById('recent-logs');
  recentLogs = logs;
  
  if (!logs.length) {
    container.innerHTML = '<p class="empty-state">Aucune requête enregistrée</p>';
    return;
  }
  
  container.innerHTML = logs.map(log => `
    <div class="log-item" onclick="showLogDetailFromRecent('${log.id}')">
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

function showLogDetailFromRecent(logId) {
  const log = recentLogs.find(l => l.id === logId);
  if (!log) return;
  
  // Fill in the details
  document.getElementById('log-detail-method').innerHTML = `<span class="method-badge ${log.method.toLowerCase()}">${log.method}</span>`;
  document.getElementById('log-detail-path').textContent = log.path;
  document.getElementById('log-detail-ip').textContent = log.ip || '-';
  document.getElementById('log-detail-useragent').textContent = log.userAgent || '-';
  document.getElementById('log-detail-date').textContent = formatDate(log.createdAt);
  
  document.getElementById('log-detail-status').innerHTML = `<span style="color: ${log.statusCode < 400 ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">${log.statusCode}</span>`;
  document.getElementById('log-detail-time').textContent = `${log.responseTime}ms`;
  document.getElementById('log-detail-route').textContent = log.route ? `${log.route.name} (${log.route.path})` : '-';
  document.getElementById('log-detail-apikey').innerHTML = log.apiKey ? '<span style="color: var(--success);">Oui</span>' : '<span style="color: var(--gray-400);">Non</span>';
  
  // Format headers JSON
  try {
    const headers = log.requestHeaders ? JSON.parse(log.requestHeaders) : null;
    document.getElementById('log-detail-headers').textContent = headers ? JSON.stringify(headers, null, 2) : '-';
  } catch (e) {
    document.getElementById('log-detail-headers').textContent = log.requestHeaders || '-';
  }
  
  // Format body JSON
  try {
    const body = log.requestBody ? JSON.parse(log.requestBody) : null;
    document.getElementById('log-detail-body').textContent = body ? JSON.stringify(body, null, 2) : '-';
  } catch (e) {
    document.getElementById('log-detail-body').textContent = log.requestBody || '-';
  }
  
  // Afficher l'erreur si présente
  const errorSection = document.getElementById('log-detail-error-section');
  if (log.errorMessage) {
    errorSection.style.display = 'block';
    document.getElementById('log-detail-error').textContent = log.errorMessage;
  } else {
    errorSection.style.display = 'none';
  }
  
  // Show modal
  document.getElementById('log-detail-modal').classList.remove('hidden');
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
    
    // Variables d'environnement
    const hasEnvVars = route.envVars && route.envVars !== '{}';
    document.getElementById('route-envvars-toggle').checked = hasEnvVars;
    document.getElementById('route-envvars').value = route.envVars || '';
    document.getElementById('envvars-config').classList.toggle('hidden', !hasEnvVars);
    
    document.getElementById('ratelimit-config').classList.toggle('hidden', !route.rateLimitEnabled);
    updateCodeHelp(route.language);
  } else {
    title.textContent = 'Nouvelle route';
    document.getElementById('route-id').value = '';
    document.getElementById('route-language').value = 'javascript';
    document.getElementById('route-code').value = `json({ message: "Hello World!" });`;
    document.getElementById('route-envvars-toggle').checked = false;
    document.getElementById('route-envvars').value = '';
    document.getElementById('envvars-config').classList.add('hidden');
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
  
  // Récupérer et valider les envVars
  let envVars = null;
  const envVarsToggle = document.getElementById('route-envvars-toggle').checked;
  if (envVarsToggle) {
    const envVarsRaw = document.getElementById('route-envvars').value.trim();
    if (envVarsRaw) {
      try {
        JSON.parse(envVarsRaw); // Valider le JSON
        envVars = envVarsRaw;
      } catch (e) {
        showToast('Variables d\'environnement: JSON invalide', 'error');
        return;
      }
    }
  }
  
  const data = {
    name: formData.get('name'),
    method: formData.get('method'),
    path: formData.get('path'),
    description: formData.get('description'),
    language: formData.get('language'),
    authType: formData.get('authType'),
    code: formData.get('code'),
    envVars: envVars,
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
    
    // Mettre à jour les dépendances après sauvegarde d'une route
    await updateDependencyUsage();
    checkMissingDependencies();
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
    
    // Mettre à jour les dépendances après suppression
    await updateDependencyUsage();
    checkMissingDependencies();
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
          <code class="key-hidden">${key.key}</code>
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

let allLogs = [];

async function loadLogs() {
  try {
    const data = await api('/admin/logs?limit=100');
    allLogs = data.logs;
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
          <tr data-log-id="${log.id}" onclick="showLogDetail('${log.id}')" class="${log.errorMessage ? 'has-error' : ''}">
            <td>${formatDate(log.createdAt)}</td>
            <td><span class="method-badge ${log.method.toLowerCase()}">${log.method}</span></td>
            <td style="font-family: monospace; font-size: 0.85rem;">${log.path}</td>
            <td>
              <span style="color: ${log.statusCode < 400 ? 'var(--success)' : 'var(--danger)'}">${log.statusCode}</span>
              ${log.errorMessage ? '<span class="error-indicator" title="Voir l\'erreur">⚠️</span>' : ''}
            </td>
            <td>${log.responseTime}ms</td>
            <td>${log.ip}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function showLogDetail(logId) {
  const log = allLogs.find(l => l.id === logId);
  if (!log) return;
  
  // Fill in the details
  document.getElementById('log-detail-method').innerHTML = `<span class="method-badge ${log.method.toLowerCase()}">${log.method}</span>`;
  document.getElementById('log-detail-path').textContent = log.path;
  document.getElementById('log-detail-ip').textContent = log.ip || '-';
  document.getElementById('log-detail-useragent').textContent = log.userAgent || '-';
  document.getElementById('log-detail-date').textContent = formatDate(log.createdAt);
  
  document.getElementById('log-detail-status').innerHTML = `<span style="color: ${log.statusCode < 400 ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">${log.statusCode}</span>`;
  document.getElementById('log-detail-time').textContent = `${log.responseTime}ms`;
  document.getElementById('log-detail-route').textContent = log.route ? `${log.route.name} (${log.route.path})` : '-';
  document.getElementById('log-detail-apikey').innerHTML = log.apiKey ? '<span style="color: var(--success);">Oui</span>' : '<span style="color: var(--gray-400);">Non</span>';
  
  // Format headers JSON
  try {
    const headers = log.requestHeaders ? JSON.parse(log.requestHeaders) : null;
    document.getElementById('log-detail-headers').textContent = headers ? JSON.stringify(headers, null, 2) : '-';
  } catch (e) {
    document.getElementById('log-detail-headers').textContent = log.requestHeaders || '-';
  }
  
  // Format body JSON
  try {
    const body = log.requestBody ? JSON.parse(log.requestBody) : null;
    document.getElementById('log-detail-body').textContent = body ? JSON.stringify(body, null, 2) : '-';
  } catch (e) {
    document.getElementById('log-detail-body').textContent = log.requestBody || '-';
  }
  
  // Afficher l'erreur si présente
  const errorSection = document.getElementById('log-detail-error-section');
  if (log.errorMessage) {
    errorSection.style.display = 'block';
    document.getElementById('log-detail-error').textContent = log.errorMessage;
  } else {
    errorSection.style.display = 'none';
  }
  
  // Show modal
  document.getElementById('log-detail-modal').classList.remove('hidden');
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
// DEPENDENCIES
// ============================================

let dependencies = [];
let depFilter = 'all';

let missingDepsCount = 0;

async function loadDependencies() {
  try {
    // D'abord mettre à jour les usedBy
    await updateDependencyUsage();
    
    const data = await api('/admin/dependencies');
    dependencies = data.dependencies;
    renderDependencies();
  } catch (e) {
    showToast('Erreur lors du chargement des dépendances', 'error');
  }
}

async function checkMissingDependencies() {
  try {
    const routesData = await api('/admin/routes');
    let allMissing = [];
    
    for (const route of routesData.routes) {
      if (route.language === 'javascript' || route.language === 'python') {
        const result = await api('/admin/dependencies/detect', {
          method: 'POST',
          body: JSON.stringify({ code: route.code, language: route.language })
        });
        
        const missing = result.packages.filter(p => !p.installed);
        missing.forEach(m => {
          if (!allMissing.find(x => x.name === m.name)) {
            allMissing.push({ ...m, route: route.name, language: route.language });
          }
        });
      }
    }
    
    missingDepsCount = allMissing.length;
    updateDepsBadge();
    
    // Afficher/cacher le bouton "Installer les manquantes"
    const btnInstallAll = document.getElementById('btn-install-all-missing');
    if (btnInstallAll) {
      btnInstallAll.style.display = allMissing.length > 0 ? 'inline-flex' : 'none';
    }
    
    return allMissing;
  } catch (e) {
    console.error('Erreur vérification dépendances:', e);
    return [];
  }
}

// Fonction pour ajouter une ligne au log d'installation
function addInstallLog(message, type = '') {
  const logContent = document.getElementById('install-log-content');
  if (!logContent) return;
  
  const line = document.createElement('div');
  line.className = `install-log-line ${type}`;
  line.innerHTML = message;
  logContent.appendChild(line);
  
  // Scroll vers le bas
  logContent.scrollTop = logContent.scrollHeight;
}

// Installer toutes les dépendances manquantes
async function installAllMissingDeps() {
  // Afficher le panel de log immédiatement
  const logPanel = document.getElementById('install-log-panel');
  const logContent = document.getElementById('install-log-content');
  const logStatus = document.getElementById('install-log-status');
  const logTitle = document.querySelector('.install-log-title');
  
  logPanel.classList.remove('hidden');
  logContent.innerHTML = '';
  logTitle.classList.remove('done');
  logStatus.textContent = 'Analyse des dépendances manquantes...';
  
  addInstallLog('🔍 Scan des routes pour détecter les dépendances...', 'info');
  
  // Récupérer toutes les routes
  let routesData;
  try {
    routesData = await api('/admin/routes');
  } catch (e) {
    addInstallLog('✗ Erreur lors de la récupération des routes', 'error');
    logTitle.classList.add('done');
    logStatus.textContent = 'Erreur';
    return;
  }
  
  // Détecter toutes les dépendances manquantes
  let allMissing = [];
  
  for (const route of routesData.routes) {
    if (route.language === 'javascript' || route.language === 'python') {
      try {
        const result = await api('/admin/dependencies/detect', {
          method: 'POST',
          body: JSON.stringify({ code: route.code, language: route.language })
        });
        
        const missing = result.packages.filter(p => !p.installed);
        missing.forEach(m => {
          if (!allMissing.find(x => x.name === m.name && x.language === route.language)) {
            allMissing.push({ name: m.name, language: route.language, route: route.name });
          }
        });
      } catch (e) {
        addInstallLog(`⚠ Erreur analyse route "${route.name}"`, 'error');
      }
    }
  }
  
  if (allMissing.length === 0) {
    addInstallLog('✓ Aucune dépendance manquante !', 'success');
    logTitle.classList.add('done');
    logStatus.textContent = 'Aucune dépendance manquante';
    return;
  }
  
  addInstallLog(`📦 ${allMissing.length} dépendance(s) à installer`, 'info');
  logStatus.textContent = `Installation de ${allMissing.length} dépendance(s)...`;
  
  let installed = 0;
  let errors = 0;
  
  for (const dep of allMissing) {
    addInstallLog(`⏳ Installation de <span class="pkg-name">${dep.name}</span> (${dep.language})...`, 'info');
    
    try {
      await api('/admin/dependencies', {
        method: 'POST',
        body: JSON.stringify({ name: dep.name, language: dep.language })
      });
      
      addInstallLog(`✓ <span class="pkg-name">${dep.name}</span> installé avec succès`, 'success');
      installed++;
    } catch (err) {
      addInstallLog(`✗ <span class="pkg-name">${dep.name}</span> - ${err.message}`, 'error');
      errors++;
    }
  }
  
  logTitle.classList.add('done');
  logStatus.textContent = `Terminé: ${installed} installé(s), ${errors} erreur(s)`;
  
  // Recharger les dépendances
  await loadDependencies();
  
  if (installed > 0) {
    showToast(`${installed} dépendance(s) installée(s) avec succès`, 'success');
  }
}

function updateDepsBadge() {
  const navItem = document.querySelector('.nav-item[data-section="dependencies"]');
  let badge = navItem.querySelector('.nav-badge');
  
  if (missingDepsCount > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'nav-badge';
      navItem.appendChild(badge);
    }
    badge.textContent = missingDepsCount;
    badge.title = `${missingDepsCount} dépendance(s) manquante(s)`;
  } else if (badge) {
    badge.remove();
  }
}

async function renderDependencies() {
  const container = document.getElementById('deps-list');
  
  // Vérifier les dépendances manquantes
  const missing = await checkMissingDependencies();
  
  let filtered = dependencies;
  if (depFilter !== 'all') {
    filtered = dependencies.filter(d => d.language === depFilter);
  }
  
  let html = '';
  
  // Afficher les dépendances manquantes en premier
  const filteredMissing = depFilter === 'all' ? missing : missing.filter(m => m.language === depFilter);
  if (filteredMissing.length > 0) {
    html += `<div class="missing-deps-section">
      <h4 class="missing-deps-title">
        <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
        Dépendances manquantes (${filteredMissing.length})
      </h4>
      <div class="missing-deps-grid">
        ${filteredMissing.map(m => `
          <div class="dep-card missing">
            <div class="dep-card-header">
              <span class="dep-name">
                ${m.name}
                <span class="dep-lang-badge ${m.language}">${m.language === 'javascript' ? 'JS' : 'PY'}</span>
              </span>
            </div>
            <div class="dep-meta">
              <div class="dep-meta-item" style="color: var(--danger);">
                ❌ Requis par la route "${m.route}"
              </div>
            </div>
            <div class="dep-card-footer">
              <button class="btn btn-sm btn-primary" onclick="quickInstallDep('${m.name}', '${m.language}', this)">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                Installer
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
  }
  
  // Dépendances installées
  if (filtered.length > 0) {
    html += filtered.map(dep => `
      <div class="dep-card" data-id="${dep.id}">
        <div class="dep-card-header">
          <span class="dep-name">
            ${dep.name}
            <span class="dep-lang-badge ${dep.language}">${dep.language === 'javascript' ? 'JS' : 'PY'}</span>
          </span>
        </div>
        <div class="dep-meta">
          <div class="dep-meta-item">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
            Installé le ${formatDate(dep.installedAt)}
          </div>
        </div>
        <div class="dep-used-by">
          ${dep.usedByCount > 0 
            ? `Utilisé par ${dep.usedByCount} route(s): ${dep.usedByRoutes.map(r => `<span class="route-tag">${r.path}</span>`).join('')}` 
            : '<span style="color: var(--warning);">⚠️ Non utilisé</span>'}
        </div>
        <div class="dep-card-footer">
          <button class="btn btn-sm btn-danger" onclick="uninstallDependency('${dep.id}', '${dep.name}', this)">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
            Désinstaller
          </button>
        </div>
      </div>
    `).join('');
  }
  
  if (!html) {
    html = '<p class="empty-state">Aucune dépendance installée</p>';
  }
  
  container.innerHTML = html;
}

async function quickInstallDep(name, language, btn) {
  // Afficher le loading sur le bouton
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Installation...`;
  }
  
  showToast(`Installation de ${name}...`, 'info');
  
  try {
    await api('/admin/dependencies', {
      method: 'POST',
      body: JSON.stringify({ name, language })
    });
    
    showToast(`${name} installé avec succès ! Mise à jour...`, 'success');
    
    // Mettre à jour les usedBy en analysant toutes les routes
    await updateDependencyUsage();
    
    // Recharger les dépendances depuis le serveur
    const data = await api('/admin/dependencies');
    dependencies = data.dependencies;
    
    // Re-render
    await renderDependencies();
  } catch (e) {
    showToast(`Erreur: ${e.message}`, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg> Installer`;
    }
  }
}

async function updateDependencyUsage() {
  try {
    const result = await api('/admin/dependencies/update-usage', { 
      method: 'POST',
      body: JSON.stringify({})
    });
    return result;
  } catch (e) {
    console.error('Erreur mise à jour usage:', e);
    throw e;
  }
}

function openDepModal() {
  document.getElementById('dep-modal').classList.remove('hidden');
  document.getElementById('dep-form').reset();
}

async function installDependency(formData) {
  const name = formData.get('name').trim();
  const language = formData.get('language');
  
  if (!name) {
    showToast('Veuillez entrer un nom de package', 'error');
    return;
  }
  
  // Récupérer le bouton submit et afficher le loading
  const btn = document.querySelector('button[form="dep-form"]');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Installation...`;
  
  showToast(`Installation de ${name}...`, 'info');
  
  try {
    await api('/admin/dependencies', {
      method: 'POST',
      body: JSON.stringify({ name, language })
    });
    
    showToast(`${name} installé ! Mise à jour des liens...`, 'success');
    
    // Mettre à jour les usedBy en analysant toutes les routes
    await updateDependencyUsage();
    
    document.getElementById('dep-modal').classList.add('hidden');
    
    // Recharger les dépendances depuis le serveur
    const data = await api('/admin/dependencies');
    dependencies = data.dependencies;
    await renderDependencies();
    
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  } catch (e) {
    showToast(`Erreur: ${e.message}`, 'error');
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

async function uninstallDependency(id, name, btn) {
  if (!confirm(`Êtes-vous sûr de vouloir désinstaller ${name} ?`)) return;
  
  // Afficher le loading sur le bouton
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner spinner-danger"></span> Suppression...`;
  }
  
  showToast(`Désinstallation de ${name}...`, 'info');
  
  try {
    await api(`/admin/dependencies/${id}`, { method: 'DELETE' });
    showToast(`${name} désinstallé`, 'success');
    loadDependencies();
  } catch (e) {
    // Proposer de forcer la suppression
    if (confirm(`Erreur lors de la désinstallation: ${e.message}\n\nVoulez-vous forcer la suppression de la base de données ?\n(Le package restera peut-être installé sur le système)`)) {
      try {
        await api(`/admin/dependencies/${id}/db-only`, { method: 'DELETE' });
        showToast(`${name} supprimé de la base`, 'success');
        loadDependencies();
      } catch (e2) {
        showToast(`Erreur: ${e2.message}`, 'error');
      }
    }
    
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg> Désinstaller`;
    }
  }
}

async function cleanUnusedDependencies() {
  if (!confirm('Désinstaller toutes les dépendances non utilisées ?')) return;
  
  showToast('Nettoyage en cours...', 'info');
  
  try {
    const result = await api('/admin/dependencies/clean', { 
      method: 'POST',
      body: JSON.stringify({})
    });
    
    if (result.removed.length > 0) {
      showToast(`${result.removed.length} dépendance(s) supprimée(s)`, 'success');
    } else {
      showToast('Aucune dépendance à nettoyer', 'info');
    }
    
    loadDependencies();
  } catch (e) {
    showToast(`Erreur: ${e.message}`, 'error');
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Check auth on load
  checkAuth();
  
  // Setup form
  document.getElementById('setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('setup-password').value;
    const passwordConfirm = document.getElementById('setup-password-confirm').value;
    
    const errorEl = document.getElementById('setup-error');
    
    if (password !== passwordConfirm) {
      errorEl.textContent = 'Les mots de passe ne correspondent pas';
      errorEl.classList.remove('hidden');
      return;
    }
    
    if (password.length < 8) {
      errorEl.textContent = 'Le mot de passe doit contenir au moins 8 caractères';
      errorEl.classList.remove('hidden');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showToast('Configuration terminée ! Connectez-vous maintenant.', 'success');
        showLoginScreen();
      } else {
        errorEl.textContent = data.message || 'Erreur lors de la configuration';
        errorEl.classList.remove('hidden');
      }
    } catch (err) {
      errorEl.textContent = 'Erreur de connexion au serveur';
      errorEl.classList.remove('hidden');
    }
  });
  
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
  
  // Export configuration
  document.getElementById('btn-export-config').addEventListener('click', async () => {
    try {
      showToast('Export en cours...', 'info');
      const data = await api('/admin/export');
      
      // Télécharger le fichier
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `modular-api-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast('Configuration exportée avec succès', 'success');
    } catch (e) {
      showToast('Erreur lors de l\'export: ' + e.message, 'error');
    }
  });
  
  // Import configuration
  document.getElementById('btn-import-config').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });
  
  // Variable pour stocker les données d'import en attente
  let pendingImportData = null;
  
  document.getElementById('import-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Stocker les données pour l'import
      pendingImportData = data;
      
      // Fermer le modal des paramètres
      document.getElementById('settings-modal').classList.add('hidden');
      
      // Afficher les infos dans la modal
      document.getElementById('import-file-name').textContent = file.name;
      document.getElementById('import-routes-count').textContent = data.routes?.length || 0;
      document.getElementById('import-keys-count').textContent = data.apiKeys?.length || 0;
      document.getElementById('import-deps-count').textContent = data.dependencies?.length || 0;
      
      // Ouvrir la modal d'import
      document.getElementById('import-modal').classList.remove('hidden');
      
    } catch (err) {
      showToast('Erreur: fichier JSON invalide', 'error');
    }
    
    // Réinitialiser l'input
    e.target.value = '';
  });
  
  // Bouton Fusionner
  document.getElementById('btn-import-merge').addEventListener('click', async () => {
    if (!pendingImportData) return;
    await executeImport('merge');
  });
  
  // Bouton Écraser
  document.getElementById('btn-import-replace').addEventListener('click', async () => {
    if (!pendingImportData) return;
    
    // Confirmation supplémentaire pour l'écrasement
    if (!confirm('⚠️ ATTENTION: Ceci va supprimer toutes vos routes et clés API existantes. Continuer ?')) {
      return;
    }
    
    await executeImport('replace');
  });
  
  async function executeImport(mode) {
    document.getElementById('import-modal').classList.add('hidden');
    showToast('Import en cours...', 'info');
    
    try {
      const result = await api('/admin/import', {
        method: 'POST',
        body: JSON.stringify({ ...pendingImportData, mode })
      });
      
      showToast(`Import terminé: ${result.results.routes.created} routes créées, ${result.results.apiKeys.created} clés créées`, 'success');
      
      // Recharger les données
      loadDashboardData();
      loadRoutes();
      loadKeys();
      
      // Si des dépendances ont été importées, proposer de les installer
      if (pendingImportData.dependencies && pendingImportData.dependencies.length > 0) {
        // Aller à la section dépendances et lancer l'installation
        switchSection('dependencies');
        await installImportedDependencies(pendingImportData.dependencies);
      }
      
    } catch (err) {
      showToast('Erreur lors de l\'import: ' + err.message, 'error');
    }
    
    pendingImportData = null;
  }
  
  // Installation des dépendances importées avec log visuel
  async function installImportedDependencies(deps) {
    const logPanel = document.getElementById('install-log-panel');
    const logContent = document.getElementById('install-log-content');
    const logStatus = document.getElementById('install-log-status');
    const logTitle = document.querySelector('.install-log-title');
    
    // Afficher le panel
    logPanel.classList.remove('hidden');
    logContent.innerHTML = '';
    logTitle.classList.remove('done');
    logStatus.textContent = `Installation de ${deps.length} dépendance(s)...`;
    
    let installed = 0;
    let errors = 0;
    
    for (const dep of deps) {
      // Ajouter une ligne de log
      addInstallLog(`Installation de <span class="pkg-name">${dep.name}</span> (${dep.language})...`, 'info');
      
      try {
        await api('/admin/dependencies', {
          method: 'POST',
          body: JSON.stringify({ name: dep.name, language: dep.language })
        });
        
        addInstallLog(`✓ <span class="pkg-name">${dep.name}</span> installé avec succès`, 'success');
        installed++;
      } catch (err) {
        addInstallLog(`✗ <span class="pkg-name">${dep.name}</span> - ${err.message}`, 'error');
        errors++;
      }
    }
    
    // Fin de l'installation
    logTitle.classList.add('done');
    logStatus.textContent = `Terminé: ${installed} installé(s), ${errors} erreur(s)`;
    
    // Recharger les dépendances
    await loadDependencies();
  }
  
  // Fermer le panel de log
  document.getElementById('btn-close-install-log').addEventListener('click', () => {
    document.getElementById('install-log-panel').classList.add('hidden');
  });
  
  // IDE
  document.getElementById('btn-open-ide').addEventListener('click', openIDE);
  document.getElementById('btn-apply-code').addEventListener('click', applyCodeFromIDE);
  document.getElementById('ide-language-select').addEventListener('change', (e) => {
    changeIDELanguage(e.target.value);
  });
  
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
  
  // Dependencies
  document.getElementById('btn-new-dep').addEventListener('click', openDepModal);
  document.getElementById('btn-clean-deps').addEventListener('click', cleanUnusedDependencies);
  document.getElementById('btn-install-all-missing').addEventListener('click', installAllMissingDeps);
  
  document.getElementById('dep-form').addEventListener('submit', (e) => {
    e.preventDefault();
    installDependency(new FormData(e.target));
  });
  
  // Dependency filters
  document.querySelectorAll('.dep-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dep-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      depFilter = btn.dataset.filter;
      renderDependencies();
    });
  });
  
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
  
  // Env vars toggle
  document.getElementById('route-envvars-toggle').addEventListener('change', (e) => {
    document.getElementById('envvars-config').classList.toggle('hidden', !e.target.checked);
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

