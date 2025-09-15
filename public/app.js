const API = '';

const authHeader = () => {
  const token = localStorage.getItem('ADMIN_TOKEN') || '';
  return token ? { 'Authorization': 'Bearer ' + token } : {};
};

const elWatchers = document.getElementById('watchers');
const elLog = document.getElementById('log');

function formToJson(form){
  const data = Object.fromEntries(new FormData(form).entries());
  data.queryPort = Number(data.queryPort);
  data.inactivityMinutes = Number(data.inactivityMinutes);
  data.checkIntervalSec = Number(data.checkIntervalSec);
  data.stopTimeoutSec = Number(data.stopTimeoutSec);
  data.autostart = form.autostart.checked;
  return data;
}

function watcherCardHtml(w){
  return `
  <summary><strong>${w.name}</strong> — ${w.running? 'watcher <span style="color:green">ON</span>':'watcher <span style="color:crimson">OFF</span>'} → <code>${w.targetContainer}</code></summary>
  <div class="grid">
    <label>Nom<br><input id="name-${w.id}" value="${w.name}"></label>
    <label>Conteneur<br><input id="target-${w.id}" value="${w.targetContainer}"></label>
    <label>Type<br><input id="type-${w.id}" value="${w.gamedigType}"></label>
    <label>Host<br><input id="host-${w.id}" value="${w.queryHost}"></label>
    <label>Port<br><input id="port-${w.id}" type="number" value="${w.queryPort}"></label>
    <label>Inactivité (min)<br><input id="ina-${w.id}" type="number" value="${w.inactivityMinutes}"></label>
    <label>Intervalle (s)<br><input id="ivl-${w.id}" type="number" value="${w.checkIntervalSec}"></label>
    <label>Timeout arrêt (s)<br><input id="tmo-${w.id}" type="number" value="${w.stopTimeoutSec}"></label>
    <label>Autostart<br><input id="auto-${w.id}" type="checkbox" ${w.autostart?'checked':''}></label>
  </div>
  <div class="actions">
    <button data-id="${w.id}" data-act="start">Démarrer watcher</button>
    <button data-id="${w.id}" data-act="stop">Arrêter watcher</button>
    <button data-id="${w.id}" data-act="save">Enregistrer</button>
    <button data-id="${w.id}" data-act="delete">Supprimer</button>
  </div>`;
}

async function loadWatchers(){
  const res = await fetch(API+'/api/watchers', { headers: { 'Content-Type':'application/json', ...authHeader() }});
  const list = await res.json();
  elWatchers.innerHTML = '';
  for (const w of list){
    const card = document.createElement('details');
    card.innerHTML = watcherCardHtml(w);
    elWatchers.appendChild(card);
  }
}

async function actionWatcher(id, action){
  await fetch(API+`/api/watchers/${id}/${action}`,{ method:'POST', headers: { ...authHeader() }});
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
  await fetch(API+`/api/watchers/${id}`, {
    method:'PUT', headers: { 'Content-Type':'application/json', ...authHeader() }, body: JSON.stringify(patch)
  });
  await loadWatchers();
}

const formNew = document.getElementById('formNew');
if (formNew) {
  formNew.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const data = formToJson(formNew);
    await fetch(API+'/api/watchers', { method:'POST', headers: { 'Content-Type':'application/json', ...authHeader() }, body: JSON.stringify(data)});
    formNew.reset();
    await loadWatchers();
  });
}

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

// SSE + auto-refresh (debounce)
function connectSSE(){
  const es = new EventSource(API+'/api/events', { withCredentials: false });
  let refreshTimer = null;
  es.onmessage = (e)=>{
    try {
      const evt = JSON.parse(e.data);
      const line = `[${new Date().toLocaleTimeString()}] ${evt.msg || JSON.stringify(evt)}
`;
      elLog.textContent += line;
      elLog.scrollTop = elLog.scrollHeight;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(loadWatchers, 500);
    } catch {}
  };
}

connectSSE();
loadWatchers();
