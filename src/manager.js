// src/manager.js
import Docker from 'dockerode';
import fs from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';
import Gamedig from 'gamedig';

export class WatchManager {
  constructor(opts){
    this.dataDir = opts.dataDir;
    this.configPath = opts.configPath;
    this.docker = new Docker({ socketPath: process.env.DOCKER_SOCK || '/var/run/docker.sock' });
    this.watchers = new Map(); // id -> state
    this.config = { watchers: [] };
    this.listeners = new Set();
  }

  async load(){
    try {
      const raw = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(raw);
      if (!Array.isArray(this.config.watchers)) this.config.watchers = [];
    } catch {
      this.config = { watchers: [] };
    }
  }

  async save(){
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
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
      this.emit({ type:'error', msg:`Stop error: ${e.message}`});
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
      return; // do nothing while stopped
    }
    try {
      const result = await Gamedig.query({ type: w.gamedigType, host: w.queryHost, port: Number(w.queryPort) });
      const players = Array.isArray(result.players) ? result.players.length : (typeof result.numplayers==='number'? result.numplayers : 0);
      if (players !== state.lastPlayers){
        this.emit({ type:'info', msg:`[${w.name}] joueurs: ${players}`});
        state.lastPlayers = players;
      }
      if (players === 0){
        state.emptyMinutes += state.intervalSec/60;
        if (state.emptyMinutes >= w.inactivityMinutes){
          this.emit({ type:'info', msg:`[${w.name}] arrêt (inactivité)`});
          await this.stopGracefully(container, w.stopTimeoutSec);
          state.emptyMinutes = 0; state.lastPlayers = -1;
        }
      } else {
        state.emptyMinutes = 0;
      }
    } catch(e){
      // Don't penalize when query fails (server booting or ports closed)
      this.emit({ type:'warn', msg:`[${w.name}] Query indisponible (aucune pénalité)`});
    }
  }

  async startWatcher(id){
    const w = this.config.watchers.find(w=>w.id===id);
    if (!w) throw new Error('Watcher not found');
    if (this.watchers.has(id)) return; // already running
    const intervalSec = Number(w.checkIntervalSec || 60);
    const state = { timer: null, intervalSec, emptyMinutes: 0, lastPlayers: -1 };
    const run = async ()=>{ await this.tickOne(w); };
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
    if (action === 'stop') { await c.stop({ t: 60 }); return { ok:true }; }
    throw new Error('Unsupported action');
  }
}
