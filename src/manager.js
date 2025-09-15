import Docker from 'dockerode';
import * as fsp from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';
import Gamedig from 'gamedig';

export class WatchManager {
  constructor(opts){
    const envData = process.env.DATA_DIR || process.env.DATA || '/data';
    this.dataDir = opts.dataDir || envData;
    this.configPath = opts.configPath || process.env.CONFIG_PATH || path.join(this.dataDir, 'config.json');
    this.docker = new Docker({ socketPath: process.env.DOCKER_SOCK || '/var/run/docker.sock' });
    this.watchers = new Map(); // id -> state
    this.config = { watchers: [] };
    this.listeners = new Set();
    this.labelPrefix = process.env.LABEL_PREFIX || 'autostop.';
    this.rescanTimer = null;
  }

  async load(){
    try {
      const raw = await fsp.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(raw);
      if (!Array.isArray(this.config.watchers)) this.config.watchers = [];
      for (const w of this.config.watchers) {
        if (typeof w.autostart !== 'boolean') w.autostart = true;
      }
    } catch {
      this.config = { watchers: [] };
    }
  }

  async save(){
    const dir = path.dirname(this.configPath);
    await fsp.mkdir(dir, { recursive: true });
    const tmp = this.configPath + '.tmp';
    const data = JSON.stringify(this.config, null, 2);
    const fh = await fsp.open(tmp, 'w');
    try {
      await fh.writeFile(data, 'utf8');
      await fh.sync();
    } finally {
      await fh.close();
    }
    await fsp.rename(tmp, this.configPath);
  }

  subscribe(cb){
    this.listeners.add(cb);
    return ()=>this.listeners.delete(cb);
  }

  emit(event){
    for (const cb of this.listeners) cb(event);
  }

  list(){
    return this.config.watchers.map(w=>({ ...w, running: this.watchers.has(w.id) }));
  }

  validate(input){
    const required = ['name','targetContainer','queryHost','queryPort','gamedigType'];
    for (const k of required){
      if (!(k in input)) throw new Error(`Missing field: ${k}`);
    }
    const def = { inactivityMinutes: 10, checkIntervalSec: 60, stopTimeoutSec: 60, autostart: true };
    return { id: input.id || nanoid(8), ...def, ...input };
  }

  async create(input){
    const w = this.validate(input);
    this.config.watchers.push(w);
    await this.save();
    if (w.autostart) {
      try { await this.startWatcher(w.id); } catch {}
    }
    return w;
  }

  async update(id, patch){
    const idx = this.config.watchers.findIndex(w=>w.id===id);
    if (idx === -1) throw new Error('Watcher not found');
    const w = { ...this.config.watchers[idx], ...patch, id };
    this.config.watchers[idx] = w;
    await this.save();
    if (this.watchers.has(id)){
      await this.stopWatcher(id);
      await this.startWatcher(id);
    } else if (w.autostart) {
      await this.startWatcher(id);
    }
    return w;
  }

  async remove(id){
    await this.stopWatcher(id).catch(()=>{});
    this.config.watchers = this.config.watchers.filter(w=>w.id!==id);
    await this.save();
  }

  async autostart(){
    for (const w of this.config.watchers){
      if (w.autostart) await this.startWatcher(w.id);
    }
  }

  getContainer(ref){
    const c = this.docker.getContainer(ref);
    return c.inspect().then(()=>c).catch(()=>null);
  }

  async isRunning(container){
    const info = await container.inspect();
    return info?.State?.Running === true;
  }

  async stopGracefully(container, stopTimeoutSec){
    try {
      await container.stop({ t: stopTimeoutSec });
    } catch(e){
      this.emit({ type:'error', msg:`Stop error: ${e.message}` });
    }
  }

  async testQuery({ type, host, port }){
    const state = await Gamedig.query({ type, host, port: Number(port) });
    const count = Array.isArray(state.players) ? state.players.length : (typeof state.numplayers==='number' ? state.numplayers : 0);
    return { ok:true, players: count, name: state.name || '' };
  }

  async tickOne(w) {
    const container = await this.getContainer(w.targetContainer);
    if (!container){
      this.emit({ type:'warn', msg:`[${w.name}] Container ${w.targetContainer} introuvable` });
      return;
    }
    const running = await this.isRunning(container);
    const state = this.watchers.get(w.id);
    if (!running){
      state.emptyMinutes = 0; state.lastPlayers = -1;
      return; // ne fait rien si le conteneur est arrêté
    }
    try {
      const result = await Gamedig.query({ type: w.gamedigType, host: w.queryHost, port: Number(w.queryPort) });
      const players = Array.isArray(result.players) ? result.players.length : (typeof result.numplayers==='number'? result.numplayers : 0);
      if (players !== state.lastPlayers){
        this.emit({ type:'info', msg:`[${w.name}] joueurs: ${players}` });
        state.lastPlayers = players;
      }
      if (players === 0){
        state.emptyMinutes += state.intervalSec/60;
        if (state.emptyMinutes >= w.inactivityMinutes){
          this.emit({ type:'info', msg:`[${w.name}] arrêt (inactivité)` });
          await this.stopGracefully(container, w.stopTimeoutSec);
          state.emptyMinutes = 0; state.lastPlayers = -1;
        }
      } else {
        state.emptyMinutes = 0;
      }
    } catch(e){
      this.emit({ type:'warn', msg:`[${w.name}] Query indisponible (aucune pénalité)` });
    }
  }

  async startWatcher(id){
    const w = this.config.watchers.find(w=>w.id===id);
    if (!w) throw new Error('Watcher not found');
    if (this.watchers.has(id)) return; // déjà en marche
    const intervalSec = Number(w.checkIntervalSec || 60);
    const state = { timer: null, intervalSec, emptyMinutes: 0, lastPlayers: -1, busy: false };
    const run = async ()=>{
      if (state.busy) return;
      state.busy = true;
      try { await this.tickOne(w); }
      finally { state.busy = false; }
    };
    state.timer = setInterval(run, intervalSec*1000);
    this.watchers.set(id, state);
    this.emit({ type:'info', msg:`[${w.name}] watcher démarré (toutes ${intervalSec}s)`});
    await run();
  }

  async stopWatcher(id){
    const state = this.watchers.get(id);
    if (!state) return;
    clearInterval(state.timer);
    this.watchers.delete(id);
  }

  async stopAllWatchers(){
    for (const id of [...this.watchers.keys()]) {
      await this.stopWatcher(id);
    }
  }

  async listDockerContainers(){
    const all = await this.docker.listContainers({ all: true });
    return all.map(c=>({
      id: c.Id,
      name: (c.Names && c.Names[0] ? c.Names[0].replace(/^\//,'') : c.Id.substring(0,12)),
      image: c.Image,
      state: c.State,
      status: c.Status,
      labels: c.Labels || {}
    }));
  }

  async containerAction(idOrName, action){
    const c = await this.getContainer(idOrName);
    if (!c) throw new Error('Container not found');
    if (action === 'start') { await c.start(); return { ok:true }; }
    if (action === 'stop')  { await c.stop({ t: 60 }); return { ok:true }; }
    throw new Error('Unsupported action');
  }

  async syncFromDockerLabels(){
    const prefix = this.labelPrefix;
    if (!prefix) return;
    const containers = await this.listDockerContainers();
    let changed = false;
    for (const c of containers){
      const L = c.labels || {};
      const enabledRaw = L[`${prefix}enabled`];
      if