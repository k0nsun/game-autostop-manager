/*
 * Game Auto‑Stop Manager UI
 * Clean, commented JavaScript (ES2015+), no frameworks.
 * Talks to server.js REST API and consumes SSE with Authorization header support.
 */

(() => {
  'use strict';

  /***
   * DOM helpers
   */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /***
   * Global state kept in memory; does not depend on logs rendering,
   * so the edit modal never closes because of log activity.
   */
  const state = {
    token: '',          // Optional admin token (Authorization: Bearer <token>)
    sseAbort: null,     // AbortController for SSE fetch stream
    watchers: [],       // Last loaded watchers list
    editingId: null     // Watcher ID currently being edited (if any)
  };

  /**
   * Load/save token from localStorage to survive page reloads.
   */
  function loadToken() {
    state.token = localStorage.getItem('autostop.adminToken') || '';
    $('#adminToken').value = state.token;
  }
  function saveToken() {
    state.token = $('#adminToken').value.trim();
    if (state.token) localStorage.setItem('autostop.adminToken', state.token);
    else localStorage.removeItem('autostop.adminToken');
    restartEvents(); // Reconnect SSE with new header
  }

  /**
   * Build headers with optional Authorization.
   */
  function buildHeaders(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    if (state.token) h['Authorization'] = `Bearer ${state.token}`;
    return h;
  }

  /**
   * Small fetch wrapper for JSON APIs with error handling.
   */
  async function api(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: buildHeaders(),
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `${res.status} ${res.statusText}`);
    }
    // 204 No Content
    if (res.status === 204) return null;
    return res.json();
  }

  const API = {
    list: () => api('GET', '/api/watchers'),
    create: (payload) => api('POST', '/api/watchers', payload),
    update: (id, payload) => api('PUT', `/api/watchers/${encodeURIComponent(id)}`, payload),
    remove: (id) => api('DELETE', `/api/watchers/${encodeURIComponent(id)}`),
    start: (id) => api('POST', `/api/watchers/${encodeURIComponent(id)}/start`),
    stop: (id) => api('POST', `/api/watchers/${encodeURIComponent(id)}/stop`)
  };

  /**
   * Render helpers
   */
  function renderWatchers(list) {
    state.watchers = list;
    const tbody = $('#watchersTable tbody');
    tbody.innerHTML = '';

    for (const w of list) {
      const tr = document.createElement('tr');
      const statusClass = w.running ? 'ok' : 'stop';
      const statusText = w.running ? 'Running' : 'Stopped';
      tr.innerHTML = `
        <td>${escapeHtml(w.name)}</td>
        <td>${escapeHtml(w.targetContainer)}</td>
        <td>${escapeHtml(w.queryHost)}:${Number(w.queryPort)}</td>
        <td>${escapeHtml(w.gamedigType)}</td>
        <td>${Number(w.checkIntervalSec)}s</td>
        <td>${Number(w.inactivityMinutes)}m</td>
        <td><span class="status ${statusClass}">${statusText}</span></td>
        <td>
          <div class="inline-actions">
            <button class="btn-secondary icon-btn" data-action="edit" data-id="${w.id}" title="Edit">✏️</button>
            <button class="btn-danger icon-btn" data-action="delete" data-id="${w.id}" title="Delete">🗑️</button>
            ${w.running
              ? `<button class="btn-secondary" data-action="stop" data-id="${w.id}">Stop</button>`
              : `<button class="btn" data-action="start" data-id="${w.id}">Start</button>`}
          </div>
        </td>`;
      tbody.appendChild(tr);
    }
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }

  /**
   * Attach table action handlers (event delegation).
   */
  $('#watchersTable').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');

    try {
      if (action === 'start') await API.start(id);
      else if (action === 'stop') await API.stop(id);
      else if (action === 'delete') {
        if (!confirm('Delete this watcher?')) return;
        await API.remove(id);
      } else if (action === 'edit') {
        openEditModal(findWatcher(id));
        return; // do not refresh list here
      }
      await refreshWatchers();
    } catch (err) {
      pushLog('error', `[ui] ${err.message}`);
      alert(err.message);
    }
  });

  function findWatcher(id) {
    return state.watchers.find(w => w.id === id);
  }

  /**
   * Create form submission handler.
   */
  $('#createForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = readWatcherForm('#createForm');
    try {
      await API.create(payload);
      e.target.reset();
      $('#autostart').checked = true; // default back
      await refreshWatchers();
      pushLog('info', `[ui] watcher created: ${payload.name}`);
    } catch (err) {
      pushLog('error', `[ui] ${err.message}`);
      alert(err.message);
    }
  });

  function readWatcherForm(scopeSel) {
    const root = $(scopeSel);
    const get = (id) => $(id.startsWith('#') ? id : `#${id}`, root);
    return {
      name: get('#name') ? get('#name').value.trim() : get('#edit_name').value.trim(),
      targetContainer: get('#targetContainer') ? get('#targetContainer').value.trim() : get('#edit_targetContainer').value.trim(),
      gamedigType: get('#gamedigType') ? get('#gamedigType').value : get('#edit_gamedigType').value,
      queryHost: get('#queryHost') ? get('#queryHost').value.trim() : get('#edit_queryHost').value.trim(),
      queryPort: Number(get('#queryPort') ? get('#queryPort').value : get('#edit_queryPort').value),
      inactivityMinutes: Number(get('#inactivityMinutes') ? get('#inactivityMinutes').value : get('#edit_inactivityMinutes').value),
      checkIntervalSec: Number(get('#checkIntervalSec') ? get('#checkIntervalSec').value : get('#edit_checkIntervalSec').value),
      stopTimeoutSec: Number(get('#stopTimeoutSec') ? get('#stopTimeoutSec').value : get('#edit_stopTimeoutSec').value),
      autostart: (get('#autostart') ? get('#autostart').checked : get('#edit_autostart').checked)
    };
  }

  /**
   * Watchers refresh
   */
  async function refreshWatchers() {
    const list = await API.list();
    renderWatchers(list);
  }
  $('#refreshBtn').addEventListener('click', () => refreshWatchers().catch(console.error));

  /**
   * Edit modal logic (never tied to logs rendering)
   */
  function openEditModal(w) {
    if (!w) return;
    state.editingId = w.id;
    // Fill form
    $('#edit_id').value = w.id;
    $('#edit_name').value = w.name;
    $('#edit_targetContainer').value = w.targetContainer;
    $('#edit_gamedigType').value = w.gamedigType;
    $('#edit_queryHost').value = w.queryHost;
    $('#edit_queryPort').value = Number(w.queryPort);
    $('#edit_inactivityMinutes').value = Number(w.inactivityMinutes);
    $('#edit_checkIntervalSec').value = Number(w.checkIntervalSec);
    $('#edit_stopTimeoutSec').value = Number(w.stopTimeoutSec);
    $('#edit_autostart').checked = !!w.autostart;

    toggleModal(true);
  }

  function toggleModal(open) {
    const modal = $('#editModal');
    modal.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      // Focus the first input for better UX
      setTimeout(() => $('#edit_name').focus(), 0);
    }
  }

  $('#closeEditBtn').addEventListener('click', () => toggleModal(false));
  $('#cancelEditBtn').addEventListener('click', (e) => { e.preventDefault(); toggleModal(false); });
  $('#editModal').addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) toggleModal(false);
  });

  $('#saveEditBtn').addEventListener('click', async () => {
    const id = $('#edit_id').value;
    const payload = {
      name: $('#edit_name').value.trim(),
      targetContainer: $('#edit_targetContainer').value.trim(),
      gamedigType: $('#edit_gamedigType').value,
      queryHost: $('#edit_queryHost').value.trim(),
      queryPort: Number($('#edit_queryPort').value),
      inactivityMinutes: Number($('#edit_inactivityMinutes').value),
      checkIntervalSec: Number($('#edit_checkIntervalSec').value),
      stopTimeoutSec: Number($('#edit_stopTimeoutSec').value),
      autostart: $('#edit_autostart').checked
    };
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

  /**
   * Logs / SSE stream with Authorization header by using fetch+ReadableStream.
   * This also allows us to keep the edit modal open regardless of log flow.
   */
  function restartEvents() {
    if (state.sseAbort) state.sseAbort.abort();
    state.sseAbort = new AbortController();
    startEvents(state.sseAbort.signal).catch(err => {
      pushLog('error', `[events] ${err.message}`);
    });
  }

  async function startEvents(signal) {
    const res = await fetch('/api/events', { headers: buildHeaders(), signal });
    if (!res.ok || !res.body) throw new Error(`${res.status} ${res.statusText}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const chunk = buffer.slice(0, idx); // one SSE message
        buffer = buffer.slice(idx + 2);
        handleSseChunk(chunk);
      }
    }
  }

  function handleSseChunk(chunk) {
    // Ignore comments (": ping")
    if (chunk.startsWith(':')) return;
    const lines = chunk.split('\n');
    const dataLines = lines.filter(l => l.startsWith('data: ')).map(l => l.slice(6));
    if (!dataLines.length) return;
    try {
      const payload = JSON.parse(dataLines.join('\n'));
      const { type = 'info', msg = '' } = payload || {};
      pushLog(type, msg);
      // Heuristic: if a watcher starts/stops, reload table
      if (/watcher démarré|arrêt \(inactivité\)/i.test(msg)) {
        refreshWatchers().catch(() => {});
      }
    } catch {
      // Non-JSON data; print raw
      pushLog('info', chunk);
    }
  }

  function pushLog(level, message) {
    const pre = $('#events');
    const time = new Date();
    const hh = String(time.getHours()).padStart(2, '0');
    const mm = String(time.getMinutes()).padStart(2, '0');
    const ss = String(time.getSeconds()).padStart(2, '0');
    const line = `[${hh}:${mm}:${ss}] ${message}\n`;

    const shouldStickBottom = $('#autoScroll').checked && (pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 12);
    const span = document.createElement('span');
    span.className = level;
    span.textContent = line;
    pre.append(span);
    if (shouldStickBottom) pre.scrollTop = pre.scrollHeight;
  }

  $('#clearLogBtn').addEventListener('click', () => {
    $('#events').textContent = '';
  });

  // Token save button
  $('#saveTokenBtn').addEventListener('click', saveToken);

  // Initial boot
  (async function init(){
    loadToken();
    await refreshWatchers().catch(err => pushLog('error', `[init] ${err.message}`));
    restartEvents();
  })();
})();
