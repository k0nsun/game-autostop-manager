/**
 * Game Auto-Stop Manager - Web UI
 *
 * Pure JavaScript (ES2015+), no frameworks
 * - REST API client with Bearer token authentication
 * - Real-time logs via Server-Sent Events (SSE)
 * - Dynamic form field management based on game type
 */

(() => {
  'use strict';

  // ============================================================================
  // CONSTANTS & CONFIG
  // ============================================================================

  const CONFIG = {
    STORAGE_KEY: 'autostop.adminToken',
    API_BASE: '/api',
    GAME_TYPE_SATISFACTORY: 'satisfactory',
    SSE_RETRY_MS: 3000
  };

  const DEFAULT_VALUES = {
    inactivityMinutes: 10,
    checkIntervalSec: 60,
    stopTimeoutSec: 60,
    port: 7777
  };

  // ============================================================================
  // STATE & DOM UTILITIES
  // ============================================================================

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    token: '',
    sseAbort: null,
    watchers: [],
    editingId: null
  };

  // ============================================================================
  // TOKEN MANAGEMENT
  // ============================================================================

  function loadToken() {
    state.token = localStorage.getItem(CONFIG.STORAGE_KEY) || '';
    $('#adminToken').value = state.token;
  }

  function saveToken() {
    state.token = $('#adminToken').value.trim();
    if (state.token) {
      localStorage.setItem(CONFIG.STORAGE_KEY, state.token);
    } else {
      localStorage.removeItem(CONFIG.STORAGE_KEY);
    }
    restartEvents();
  }

  function buildHeaders(extra = {}) {
    const headers = { 'Content-Type': 'application/json', ...extra };
    if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }
    return headers;
  }

  // ============================================================================
  // API CLIENT
  // ============================================================================

  async function apiCall(method, url, body = null) {
    const options = {
      method,
      headers: buildHeaders()
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || `${response.status} ${response.statusText}`);
    }

    if (response.status === 204) {
      return null; // No Content
    }
    return response.json();
  }

  const API = {
    list: () => apiCall('GET', `${CONFIG.API_BASE}/watchers`),
    create: (payload) => apiCall('POST', `${CONFIG.API_BASE}/watchers`, payload),
    update: (id, payload) => apiCall('PUT', `${CONFIG.API_BASE}/watchers/${encodeURIComponent(id)}`, payload),
    remove: (id) => apiCall('DELETE', `${CONFIG.API_BASE}/watchers/${encodeURIComponent(id)}`),
    start: (id) => apiCall('POST', `${CONFIG.API_BASE}/watchers/${encodeURIComponent(id)}/start`),
    stop: (id) => apiCall('POST', `${CONFIG.API_BASE}/watchers/${encodeURIComponent(id)}/stop`)
  };

  // ============================================================================
  // UTILITIES
  // ============================================================================

  function escapeHtml(str) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return String(str ?? '').replace(/[&<>"']/g, (s) => map[s]);
  }

  function findWatcher(id) {
    return state.watchers.find((w) => w.id === id);
  }

  function isSatisfactoryType(gamedigType) {
    return gamedigType === CONFIG.GAME_TYPE_SATISFACTORY;
  }

  // ============================================================================
  // FORM FIELD MANAGEMENT
  // ============================================================================

  function updateFormFields(isEditMode = false) {
    const prefix = isEditMode ? 'edit_' : '';
    const typeField = $(`#${prefix}gamedigType`);
    const gamedigFields = $(`#${prefix}gamedigFields`);
    const satisfactoryFields = $(`#${prefix}satisfactoryFields`);
    const satisfactoryToken = $(`#${prefix}satisfactoryToken`);
    const gamedigType = typeField.value;

    const isSatisfactory = isSatisfactoryType(gamedigType);

    // Toggle visibility
    gamedigFields.style.display = isSatisfactory ? 'none' : '';
    satisfactoryFields.style.display = isSatisfactory ? '' : 'none';
    satisfactoryToken.style.display = isSatisfactory ? '' : 'none';

    // Update required attributes
    const setRequired = (selector, required) => {
      const elem = $(`#${selector}`);
      if (elem) {
        if (required) {
          elem.setAttribute('required', '');
        } else {
          elem.removeAttribute('required');
        }
      }
    };

    if (isSatisfactory) {
      setRequired(`${prefix}queryHost`, false);
      setRequired(`${prefix}queryPort`, false);
      setRequired(`${prefix}host`, true);
      setRequired(`${prefix}port`, true);
    } else {
      setRequired(`${prefix}queryHost`, true);
      setRequired(`${prefix}queryPort`, true);
      setRequired(`${prefix}host`, false);
      setRequired(`${prefix}port`, false);
    }
  }

  function readWatcherForm(formSelector) {
    const root = $(formSelector);
    const get = (id) => {
      const selector = id.startsWith('#') ? id : `#${id}`;
      return $(selector, root);
    };

    const isEditForm = formSelector === '#editForm';
    const prefix = isEditForm ? 'edit_' : '';
    const typeField = get(`#${prefix}gamedigType`);
    const gamedigType = typeField.value;

    const payload = {
      name: get(`#${prefix}name`).value.trim(),
      targetContainer: get(`#${prefix}targetContainer`).value.trim(),
      gamedigType,
      inactivityMinutes: Number(get(`#${prefix}inactivityMinutes`).value),
      checkIntervalSec: Number(get(`#${prefix}checkIntervalSec`).value),
      stopTimeoutSec: Number(get(`#${prefix}stopTimeoutSec`).value),
      autostart: get(`#${prefix}autostart`).checked
    };

    // Add type-specific fields
    if (isSatisfactoryType(gamedigType)) {
      payload.host = get(`#${prefix}host`).value.trim();
      const portVal = get(`#${prefix}port`).value.trim();
      if (portVal) payload.port = Number(portVal);
      const tokenVal = get(`#${prefix}apiToken`).value.trim();
      if (tokenVal) payload.apiToken = tokenVal;
    } else {
      payload.queryHost = get(`#${prefix}queryHost`).value.trim();
      payload.queryPort = Number(get(`#${prefix}queryPort`).value);
    }

    return payload;
  }

  // ============================================================================
  // WATCHER RENDERING & DISPLAY
  // ============================================================================

  function renderWatchers(list) {
    state.watchers = list;
    const tbody = $('#watchersTable tbody');
    tbody.innerHTML = '';

    for (const watcher of list) {
      const isRunning = watcher.running;
      const statusClass = isRunning ? 'ok' : 'stop';
      const statusText = isRunning ? 'Running' : 'Stopped';

      const hostPort = isSatisfactoryType(watcher.gamedigType)
        ? `${escapeHtml(watcher.host)}:${Number(watcher.port)}`
        : `${escapeHtml(watcher.queryHost)}:${Number(watcher.queryPort)}`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(watcher.name)}</strong></td>
        <td><code style="font-size:11px;opacity:0.8">${escapeHtml(watcher.targetContainer)}</code></td>
        <td><code style="font-size:11px;opacity:0.8">${hostPort}</code></td>
        <td><span style="font-size:11px;opacity:0.8">${escapeHtml(watcher.gamedigType)}</span></td>
        <td>${Number(watcher.checkIntervalSec)}s</td>
        <td>${Number(watcher.inactivityMinutes)}m</td>
        <td><span class="status ${statusClass}">${statusText}</span></td>
        <td>
          <div class="inline-actions">
            <button class="icon-btn" data-action="edit" data-id="${watcher.id}" title="Edit watcher">✏️</button>
            <button class="icon-btn" data-action="delete" data-id="${watcher.id}" title="Delete watcher" style="color:var(--danger)">🗑️</button>
            ${isRunning
              ? `<button class="btn btn-danger small" data-action="stop" data-id="${watcher.id}">⏹ Stop</button>`
              : `<button class="btn btn-success small" data-action="start" data-id="${watcher.id}">▶ Start</button>`}
          </div>
        </td>`;
      tbody.appendChild(tr);
    }
  }

  async function refreshWatchers() {
    const list = await API.list();
    renderWatchers(list);
  }

  // ============================================================================
  // MODAL & EDIT OPERATIONS
  // ============================================================================

  function toggleModal(open) {
    const modal = $('#editModal');
    modal.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      setTimeout(() => $('#edit_name').focus(), 0);
    }
  }

  function openEditModal(watcher) {
    if (!watcher) return;

    state.editingId = watcher.id;

    // Fill common fields
    $('#edit_id').value = watcher.id;
    $('#edit_name').value = watcher.name;
    $('#edit_targetContainer').value = watcher.targetContainer;
    $('#edit_gamedigType').value = watcher.gamedigType;

    // Update field visibility
    updateFormFields(true);

    // Fill type-specific fields
    if (isSatisfactoryType(watcher.gamedigType)) {
      $('#edit_host').value = watcher.host || '';
      $('#edit_port').value = watcher.port || DEFAULT_VALUES.port;
      $('#edit_apiToken').value = watcher.apiToken || '';
    } else {
      $('#edit_queryHost').value = watcher.queryHost || '';
      $('#edit_queryPort').value = Number(watcher.queryPort) || 0;
    }

    // Fill common numeric fields
    $('#edit_inactivityMinutes').value = Number(watcher.inactivityMinutes);
    $('#edit_checkIntervalSec').value = Number(watcher.checkIntervalSec);
    $('#edit_stopTimeoutSec').value = Number(watcher.stopTimeoutSec);
    $('#edit_autostart').checked = !!watcher.autostart;

    toggleModal(true);
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  // Token management
  $('#saveTokenBtn').addEventListener('click', saveToken);

  // Form submission - Create
  $('#createForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = readWatcherForm('#createForm');
    try {
      await API.create(payload);
      e.target.reset();
      $('#autostart').checked = true;
      updateFormFields(false);
      await refreshWatchers();
      pushLog('info', `[ui] watcher created: ${payload.name}`);
    } catch (err) {
      pushLog('error', `[ui] ${err.message}`);
      alert(err.message);
    }
  });

  // Form field visibility - Create & Edit
  $('#gamedigType').addEventListener('change', () => updateFormFields(false));
  $('#edit_gamedigType').addEventListener('change', () => updateFormFields(true));

  // Form submission - Edit
  $('#saveEditBtn').addEventListener('click', async () => {
    const id = $('#edit_id').value;
    const payload = readWatcherForm('#editForm');
    try {
      await API.update(id, payload);
      pushLog('info', `[ui] watcher updated: ${payload.name}`);
      await refreshWatchers();
      toggleModal(false);
    } catch (err) {
      pushLog('error', `[ui] ${err.message}`);
      alert(err.message);
    }
  });

  // Modal management
  $('#closeEditBtn').addEventListener('click', () => toggleModal(false));
  $('#cancelEditBtn').addEventListener('click', (e) => {
    e.preventDefault();
    toggleModal(false);
  });
  $('#editModal').addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) {
      toggleModal(false);
    }
  });

  // Table actions
  $('#watchersTable').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');

    try {
      if (action === 'start') {
        await API.start(id);
      } else if (action === 'stop') {
        await API.stop(id);
      } else if (action === 'delete') {
        if (!confirm('Delete this watcher?')) return;
        await API.remove(id);
      } else if (action === 'edit') {
        openEditModal(findWatcher(id));
        return;
      }
      await refreshWatchers();
    } catch (err) {
      pushLog('error', `[ui] ${err.message}`);
      alert(err.message);
    }
  });

  $('#refreshBtn').addEventListener('click', () => {
    refreshWatchers().catch(console.error);
  });

  // Logs
  $('#clearLogBtn').addEventListener('click', () => {
    $('#events').innerHTML = '';
  });

  // ============================================================================
  // SERVER-SENT EVENTS (SSE) - LIVE LOGS
  // ============================================================================

  function restartEvents() {
    if (state.sseAbort) {
      state.sseAbort.abort();
    }
    state.sseAbort = new AbortController();
    startEvents().catch((err) => {
      if (err.name !== 'AbortError') {
        pushLog('error', `[sse] ${err.message}`);
      }
    });
  }

  async function startEvents() {
    try {
      const response = await fetch(`${CONFIG.API_BASE}/events`, {
        headers: buildHeaders(),
        signal: state.sseAbort.signal
      });

      if (!response.ok || !response.body) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split on double newline (SSE message boundary)
        let idx;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          handleSseChunk(chunk);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        pushLog('warn', `[sse] Reconnecting in ${CONFIG.SSE_RETRY_MS}ms...`);
        // Retry after delay
        setTimeout(() => {
          if (!state.sseAbort.signal.aborted) {
            startEvents();
          }
        }, CONFIG.SSE_RETRY_MS);
      }
    }
  }

  function handleSseChunk(chunk) {
    // Ignore SSE comments (e.g., ": ping")
    if (chunk.startsWith(':')) return;

    // Extract "data: ..." lines
    const dataLines = chunk.split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => l.slice(6));

    if (!dataLines.length) return;

    try {
      // Parse JSON payload
      const payload = JSON.parse(dataLines.join('\n'));
      const { type = 'info', msg = '' } = payload || {};
      pushLog(type, msg);

      // Auto-refresh watchers on state changes
      if (/démarré|arrêt|stopping/i.test(msg)) {
        refreshWatchers().catch(() => {});
      }
    } catch {
      // Non-JSON data; print raw
      pushLog('info', chunk);
    }
  }

  // ============================================================================
  // LOGGING
  // ============================================================================

  function pushLog(level, message) {
    const pre = $('#events');
    const time = new Date();
    const hh = String(time.getHours()).padStart(2, '0');
    const mm = String(time.getMinutes()).padStart(2, '0');
    const ss = String(time.getSeconds()).padStart(2, '0');
    
    // Add colored timestamp prefix
    const iconMap = {
      'info': 'ℹ️',
      'warn': '⚠️',
      'error': '❌',
      'debug': '🐛'
    };
    const icon = iconMap[level] || '•';
    const line = `${icon} [${hh}:${mm}:${ss}] ${message}\n`;

    const shouldScroll = $('#autoScroll').checked
      && (pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 12);

    const span = document.createElement('span');
    span.className = level;
    span.textContent = line;
    pre.appendChild(span);

    if (shouldScroll) {
      pre.scrollTop = pre.scrollHeight;
    }
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async function init() {
    // Initial form state
    updateFormFields(false);

    // Load token from storage
    loadToken();

    // Load and render watchers
    try {
      await refreshWatchers();
    } catch (err) {
      pushLog('error', `[init] Failed to load watchers: ${err.message}`);
    }

    // Start SSE stream
    restartEvents();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
