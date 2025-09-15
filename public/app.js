const API = '';
const authHeader = ()=>{
  const token = localStorage.getItem('ADMIN_TOKEN')||'';
  return token ? { 'Authorization': 'Bearer '+token } : {};
};

const elWatchers = document.getElementById('watchers');
const elLog = document.getElementById('log');
const dlg = document.getElementById('dlg');

function formToJson(form){
  const data = Object.fromEntries(new FormData(form).entries());
  data.queryPort = Number(data.queryPort);
  data.inactivityMinutes = Number(data.inactivityMinutes);
  data.checkIntervalSec = Number(data.checkIntervalSec);
  data.stopTimeoutSec = Number(data.stopTimeoutSec);
  data.autostart = form.autostart.checked;
  return data;
}

async function loadWatchers(){
  const res = await fetch(API+'/api/watchers', { headers: { 'Content-Type':'application/json', ...authHeader() }});
  const list = await res.json();
  elWatchers.innerHTML = '';
  for (const w of list){
    const card = document.createElement('details');
    card.innerHTML = `
      <summary><strong>${w.name}</strong> <span class="badge">${w.running? 'watcher ON':'watcher OFF'}</span> <small class="muted">→ ${w.targetContainer}</small></summary>
      <div class="grid">
        <label>Nom <input id="name-${w.id}" value="${w.name}" /></label>
        <label>Conteneur <input id="target-${w.id}" value="${w.targetContainer}" /></label>
        <label>Type <input id="type-${w.id}" value="${w.gamedigType}" /></label>
        <label>Host <input id="host-${w.id}" value="${w.queryHost}" /></label>
        <label>Port <input id="port-${w.id}" type="number" value="${w.queryPort}" /></label>
        <label>Inactivité <input id="ina-${w.id}" type="number" value="${w.inactivityMinutes}" /></label>
        <label>Intervalle <input id="ivl-${w.id}" type="number" value="${w.checkIntervalSec}" /></label>
        <label>Timeout arrêt <input id="tmo-${w.id}" type="number" value="${w.stopTimeoutSec}" /></label>
        <label>Autostart <input id="auto-${w.id}" type="checkbox" ${w.autostart? 'checked':''} /></label>
      </div>
      <div>
        <button data-act="start" data-id="${w.id}">Démarrer watcher</button>
        <button data-act="stop" data-id="${w.id}">Arrêter watcher</button>
        <button data-act="save" data-id="${w.id}">Enregistrer</button>
        <button data-act="delete" data-id="${w.id}" class="secondary">Supprimer</button>
      </div>
    `;
    elWatchers.appendChild(card);
  }
}

async function actionWatcher(id, action){
  await fetch(API+`/api/watchers/${id}/${action}`, { method:'POST', headers: { ...authHeader() }});
  await loadWatchers();
}

async function saveWatcher(id){
  const patch = {
    name: document.getElementById(`name-${id}`).value,
    targetContainer: document.getElementById(`target-${id}`).value,
    gamedigType: document.getElementById(`type-${id}`).value,
    queryHost: document.getElementById(`host-${id}`).value,
    queryPort: Number(document.getElementById(`port-${id}`).value),
    inactivityMinutes: Number(document.getElementById(`ina-${id}`).value),
    checkIntervalSec: Number(document.getElementById(`ivl-${id}`).value),
    stopTimeoutSec: Number(document.getElementById(`tmo-${id}`).value),
    autostart: document.getElementById(`auto-${id}`).checked
  };
  await fetch(API+`/api/watchers/${id}`, { method:'PUT', headers: { 'Content-Type':'application/json', ...authHeader() }, body: JSON.stringify(patch) });
  await loadWatchers();
}

// New watcher form
const formNew = document.getElementById('formNew');
formNew.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const data = formToJson(formNew);
  await fetch(API+'/api/watchers', { method:'POST', headers: { 'Content-Type':'application/json', ...authHeader() }, body: JSON.stringify(data)});
  formNew.reset();
  await loadWatchers();
});

elWatchers.addEventListener('click', async (e)=>{
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  const act = btn.dataset.act;
  if (act==='start' || act==='stop') return actionWatcher(id, act);
  if (act==='save') return saveWatcher(id);
  if (act==='delete') {
    await fetch(API+`/api/watchers/${id}`, { method:'DELETE', headers: { ...authHeader() }});
    await loadWatchers();
  }
});

// Containers list dialog
const btnList = document.getElementById('btnListContainers');
btnList.addEventListener('click', async ()=>{
  const res = await fetch(API+'/api/containers', { headers: { ...authHeader() }});
  const list = await res.json();
  const dock = document.getElementById('dock');
  dock.innerHTML = '<table><thead><tr><th>Nom</th><th>Image</th><th>État</th><th>Actions</th></tr></thead><tbody></tbody></table>';
  const tbody = dock.querySelector('tbody');
  for (const c of list){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${c.name}</td><td>${c.image}</td><td>${c.state}</td><td>
      <button data-id="${c.id}" data-a="start">start</button>
      <button data-id="${c.id}" data-a="stop">stop</button>
    </td>`;
    tbody.appendChild(tr);
  }
  dock.addEventListener('click', async (e)=>{
    const b = e.target.closest('button');
    if (!b) return;
    const res = await fetch(API+`/api/containers/${b.dataset.id}/${b.dataset.a}`, { method:'POST', headers: { ...authHeader() }});
    if (!res.ok) alert('Action échouée');
  }, { once: true });
  dlg.showModal();
});

// Live events
function connectSSE(){
  const es = new EventSource(API+'/api/events', { withCredentials: false });
  es.onmessage = (e)=>{
    try {
      const evt = JSON.parse(e.data);
      const line = `[${new Date().toLocaleTimeString()}] ${evt.msg || JSON.stringify(evt)}\n`;
      elLog.textContent += line;
      elLog.scrollTop = elLog.scrollHeight;
    } catch {}
  };
}

connectSSE();
loadWatchers();
