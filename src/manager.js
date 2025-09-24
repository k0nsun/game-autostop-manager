import Docker from 'dockerode';
import * as fsp from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';
import Gamedig from 'gamedig';

export class WatchManager {
  constructor(opts) {
    const envData = process.env.DATA_DIR ?? process.env.DATA ?? '/data';
    this.dataDir = opts.dataDir ?? envData;
    this.configPath = opts.configPath ?? process.env.CONFIG_PATH ?? path.join(this.dataDir, 'config.json');

    this.docker = new Docker({ socketPath: process.env.DOCKER_SOCK ?? '/var/run/docker.sock' });

    this.watchers = new Map(); // id -> runtime state
    this.config = { watchers: [] };
    this.listeners = new Set();
    this.ipCache = new Map();
        this.ipCacheTTL = 300; // seconds
        this.labelPrefix = process.env.LABEL_PREFIX ?? 'autostop.';
    this.rescanTimer = null;
  }

  // Load watchers configuration from disk
  async load() {
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

  // Persist configuration atomically to avoid partial writes
  async save() {
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

  // Simple pub/sub for server-sent events (SSE)
  subscribe(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  emit(event) {
    for (const cb of this.listeners) cb(event);
  }

  // List watchers with a derived "running" flag
  list() {
    return this.config.watchers.map(w => ({ ...w, running: this.watchers.has(w.id) }));
  }

  // Validate and normalize payload for create/update
  validate(input) {
    const required = ['name','targetContainer','queryHost','queryPort','gamedigType'];
    for (const k of required) {
      if (!(k in input)) throw new Error(`Missing field: ${k}`);
    }
    const def = { inactivityMinutes: 10, checkIntervalSec: 60, stopTimeoutSec: 60, autostart: true };
    return { id: input.id ?? nanoid(8), ...def, ...input };
  }

  // Create watcher and optionally autostart it
  async create(input) {
    const w = this.validate(input);
    this.config.watchers.push(w);
    await this.save();
    if (w.autostart) {
      try { await this.startWatcher(w.id); } catch {}
    }
    return w;
  }

  // Update watcher; if running, restart it with new settings
  async update(id, patch) {
    const idx = this.config.watchers.findIndex(w => w.id===id);
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

  // Remove watcher and stop it if running
  async remove(id) {
    await this.stopWatcher(id).catch(()=>{});
    this.config.watchers = this.config.watchers.filter(w => w.id!==id);
    await this.save();
  }

  // Start all autostart watchers on boot
  async autostart() {
    for (const w of this.config.watchers){
      if (w.autostart) await this.startWatcher(w.id);
    }
  }

  // Resolve a container reference to a Docker object or return null if not found
  getContainer(ref) {
    const c = this.docker.getContainer(ref);
    return c.inspect().then(()=>c).catch(()=>null);
  }

  // Check if a container is running
  async isRunning(container){
    const info = await container.inspect();
    return info?.State?.Running === true;
  }

  // Attempt a graceful stop with timeout
  async stopGracefully(container, stopTimeoutSec){
    try {
      await container.stop({ t: stopTimeoutSec });
    } catch(e){
      this.emit({ type:'error', msg:`Stop error: ${e.message}` });
    }
  }

  // Test query endpoint helper (used by API /api/test-query)
  async testQuery({ type, host, port }){
    const state = await Gamedig.query({ type, host, port: Number(port) });
    const count = Array.isArray(state.players) ? state.players.length : (typeof state.numplayers==='number' ? state.numplayers : 0);
    return { ok:true, players: count, name: state.name ?? '' };
  }

  
  async resolveContainerIPWithCache(containerName) {
    const now = Date.now() / 1000;
    const cached = this.ipCache.get(containerName);
    if (cached && (now - cached.timestamp < this.ipCacheTTL)) {
      return cached.ip;
    }
    try {
      const container = await this.getContainer(containerName);
      if (!container) return null;
      const info = await container.inspect();
      const networks = info.NetworkSettings.Networks;
      const ip = Object.values(networks)[0]?.IPAddress;
      if (ip) {
        this.ipCache.set(containerName, { ip, timestamp: now });
      }
      return ip || null;
    } catch (err) {
      this.emit({ type: 'warn', msg: `[resolveIP] ${containerName}: ${err.message}` });
      return null;
    }
  }

// Single tick for one watcher: query players and enforce inactivity policy
  async tickOne(w) {
    const container = await this.getContainer(w.targetContainer);
    if (!container){
      this.emit({ type:'warn', msg:`[${w.name}] Container ${w.targetContainer} not found` });
      return;
    }
    const running = await this.isRunning(container);
    const state = this.watchers.get(w.id);
    if (!running){
      // Reset counters if target is stopped; do nothing else
      state.emptyMinutes = 0; state.lastPlayers = -1;
      return;
    }
    try {
      const ip = await this.resolveContainerIPWithCache(w.targetContainer);
      if (!ip) {
        this.emit({ type: 'warn', msg: `[${w.name}] IP not resolved for container ${w.targetContainer}` });
        return;
      }
      const result = await Gamedig.query({ type: w.gamedigType, host: ip, port: Number(w.queryPort) });
      const players = Array.isArray(result.players) ? result.players.length : (typeof result.numplayers==='number'? result.numplayers : 0);

      if (players !== state.lastPlayers){
        this.emit({ type:'info', msg:`[${w.name}] players: ${players}` });
        state.lastPlayers = players;
      }

      if (players === 0){
        state.emptyMinutes += state.intervalSec/60;
        if (state.emptyMinutes >= w.inactivityMinutes){
          this.emit({ type:'info', msg:`[${w.name}] stopping (inactivity)` });
          await this.stopGracefully(container, w.stopTimeoutSec);
          state.emptyMinutes = 0; state.lastPlayers = -1;
        }
      } else {
        state.emptyMinutes = 0;
      }
    } catch(e){
      // When query fails, we do not penalize (keeps emptyMinutes unchanged)
      this.emit({ type:'warn', msg:`[${w.name}] query unavailable (no penalty)` });
    }
  }

  // Start periodic checks for a watcher
  async startWatcher(id){
    const w = this.config.watchers.find(w=>w.id===id);
    if (!w) throw new Error('Watcher not found');
    if (this.watchers.has(id)) return; // already running

    const intervalSec = Number(w.checkIntervalSec ?? 60);
    const state = { timer: null, intervalSec, emptyMinutes: 0, lastPlayers: -1, busy: false };

    const run = async () => {
      if (state.busy) return;
      state.busy = true;
      try { await this.tickOne(w); }
      finally { state.busy = false; }
    };

    state.timer = setInterval(run, intervalSec*1000);
    this.watchers.set(id, state);
    this.emit({ type:'info', msg:`[${w.name}] watcher started (every ${intervalSec}s)`});
    await run();
  }

  // Stop periodic checks for a watcher
  async stopWatcher(id){
    const state = this.watchers.get(id);
    if (!state) return;
    clearInterval(state.timer);
    this.watchers.delete(id);
  }

  // Stop all watchers (used on shutdown)
  async stopAllWatchers(){
    for (const id of [...this.watchers.keys()]) {
      await this.stopWatcher(id);
    }
  }

  // List all Docker containers with basic metadata
  async listDockerContainers(){
    const all = await this.docker.listContainers({ all: true });
    return all.map(c=>({
      id: c.Id,
      name: (c.Names && c.Names[0] ? c.Names[0].replace(/^\//,'') : c.Id.substring(0,12)),
      image: c.Image,
      state: c.State,
      status: c.Status,
      labels: c.LabelS ?? c.Labels ?? {}
    }));
  }

  // Start/Stop a container by id or name
  async containerAction(idOrName, action){
    const c = await this.getContainer(idOrName);
    if (!c) throw new Error('Container not found');
    if (action === 'start') { await c.start(); return { ok:true }; }
    if (action === 'stop')  { await c.stop({ t: 60 }); return { ok:true }; }
    throw new Error('Unsupported action');
  }

  // Seed/refresh watchers from Docker labels (optional feature)
  async syncFromDockerLabels(){
    const prefix = this.labelPrefix;
    if (!prefix) return;

    const containers = await this.listDockerContainers();
    let changed = false;

    for (const c of containers){
      const L = c.labels ?? {};
      const enabledRaw = L[`${prefix}enabled`];
      if (enabledRaw && !/^(1|true|yes)$/i.test(String(enabledRaw))) continue;
      if (!enabledRaw) continue;

      const id = (L[`${prefix}id`] ?? c.name).replace(/[^a-zA-Z0-9._-]/g,'-');
      const name = L[`${prefix}name`] ?? c.name;
      const gamedigType = L[`${prefix}gamedig_type`];
      const queryHost = L[`${prefix}query_host`] ?? c.name;
      const queryPort = Number(L[`${prefix}query_port`]);
      const inactivityMinutes = Number(L[`${prefix}inactivity_min`] ?? 10);
      const checkIntervalSec = Number(L[`${prefix}interval_sec`] ?? 60);
      const stopTimeoutSec = Number(L[`${prefix}stop_timeout_sec`] ?? 60);
      const autostart = /^(1|true|yes)$/i.test(String(L[`${prefix}autostart`] ?? 'true'));

      if (!gamedigType || !queryHost || !queryPort) {
        this.emit({ type:'warn', msg:`[labels] ${c.name}: incomplete labels (gamedig_type/query_host/query_port)`});
        continue;
      }

      const payload = {
        id, name,
        targetContainer: c.name,
        gamedigType, queryHost, queryPort,
        inactivityMinutes, checkIntervalSec, stopTimeoutSec,
        autostart
      };

      const idx = this.config.watchers.findIndex(w=>w.id===id);
      if (idx === -1){
        try {
          this.config.watchers.push(payload);
          changed = true;
          this.emit({ type:'info', msg:`[labels] watcher created: ${name}` });
        } catch(e){
          this.emit({ type:'error', msg:`[labels] create failed: ${e.message}` });
        }
      } else {
        this.config.watchers[idx] = { ...this.config.watchers[idx], ...payload };
        changed = true;
        this.emit({ type:'info', msg:`[labels] watcher updated: ${name}` });
      }
    }

    if (changed) {
      await this.save();
      for (const w of this.config.watchers) {
        if (w.autostart && !this.watchers.has(w.id)) {
          try { await this.startWatcher(w.id); } catch {}
        }
      }
    }
  }

  // Optional periodic rescan from labels
  scheduleRescan(sec){
    const iv = Number(sec ?? process.env.RESCAN_INTERVAL_SEC ?? 0);
    if (!iv) return;
    if (this.rescanTimer) clearInterval(this.rescanTimer);
    this.rescanTimer = setInterval(()=>this.syncFromDockerLabels().catch(()=>{}), iv*1000);
    this.emit({ type:'info', msg:`[labels] rescan every ${iv}s`});
  }
}
