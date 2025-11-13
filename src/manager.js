/**
 * Watcher Manager - Orchestrates game server watchers
 *
 * Responsibilities:
 * - Load/save watcher configurations (via storage module)
 * - Manage watcher lifecycle (create, update, delete, start, stop)
 * - Auto-stop servers after inactivity (via watcher-polling module)
 * - Sync watchers from Docker container labels
 * - Publish events via pub/sub for logging
 *
 * Delegates to:
 * - storage.js: Configuration persistence
 * - docker.js: Container operations
 * - watcher-polling.js: Polling and lifecycle
 */

import Docker from 'dockerode';
import path from 'path';
import { nanoid } from 'nanoid';
import * as Storage from './storage.js';
import * as DockerUtil from './docker.js';
import * as WatcherPolling from './watcher-polling.js';

export class WatchManager {
  constructor(opts) {
    const envData = process.env.DATA_DIR ?? process.env.DATA ?? '/data';
    this.dataDir = opts.dataDir ?? envData;
    this.configPath = opts.configPath ?? process.env.CONFIG_PATH ?? path.join(this.dataDir, 'config.json');
    this.docker = new Docker({ socketPath: process.env.DOCKER_SOCK ?? '/var/run/docker.sock' });

    // Runtime state
    this.watchers = new Map();      // id -> { timer, intervalSec, emptyMinutes, lastPlayers, busy }
    this.config = { watchers: [] }; // Persisted configuration
    this.listeners = new Set();     // Pub/sub for events (logs)
    this.ipCache = new Map();       // Docker container IP cache
    this.ipCacheTTL = 300;          // IP cache TTL in seconds
    this.labelPrefix = process.env.LABEL_PREFIX ?? 'autostop.';
    this.rescanTimer = null;        // Scheduled Docker label rescan
  }

  // ==========================================================================
  // CONFIGURATION MANAGEMENT
  // ==========================================================================

  /**
   * Load watchers configuration from disk via storage module.
   */
  async load() {
    this.config = await Storage.loadConfig(this.configPath);
  }

  /**
   * Persist configuration to disk via storage module.
   */
  async save() {
    await Storage.saveConfig(this.configPath, this.config);
  }

  // ==========================================================================
  // PUB/SUB FOR EVENTS
  // ==========================================================================

  /**
   * Subscribe to manager events (logs).
   * Returns unsubscribe function.
   */
  subscribe(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /**
   * Emit an event to all subscribers.
   * Event: { type: 'info'|'warn'|'error', msg: string }
   */
  emit(event) {
    for (const cb of this.listeners) {
      cb(event);
    }
  }

  // ==========================================================================
  // WATCHER CRUD OPERATIONS
  // ==========================================================================

  /**
   * List all watchers with derived "running" flag.
   */
  list() {
    return this.config.watchers.map((w) => ({
      ...w,
      running: this.watchers.has(w.id)
    }));
  }

  /**
   * Validate and normalize watcher payload.
   * - isUpdate=false: All required fields must be present
   * - isUpdate=true: Only validate fields being changed
   */
  validate(input, isUpdate = false) {
    const required = ['name', 'targetContainer', 'gamedigType'];

    for (const k of required) {
      if (!(k in input) && !isUpdate) {
        throw new Error(`Missing field: ${k}`);
      }
    }

    // Type-specific field validation
    const gamedigType = input.gamedigType;
    if (gamedigType && gamedigType !== 'satisfactory') {
      if (!('queryHost' in input) && !isUpdate) {
        throw new Error('Missing field: queryHost');
      }
      if (!('queryPort' in input) && !isUpdate) {
        throw new Error('Missing field: queryPort');
      }
    }

    const defaults = {
      inactivityMinutes: 10,
      checkIntervalSec: 60,
      stopTimeoutSec: 60,
      autostart: true
    };
    return { id: input.id ?? nanoid(8), ...defaults, ...input };
  }

  /**
   * Create a new watcher and optionally auto-start it.
   */
  async create(input) {
    const w = this.validate(input);
    this.config.watchers.push(w);
    await this.save();
    if (w.autostart) {
      try {
        await this.startWatcher(w.id);
      } catch {
        // Ignore autostart errors during creation
      }
    }
    return w;
  }

  /**
   * Update a watcher and restart it if running.
   */
  async update(id, patch) {
    const idx = this.config.watchers.findIndex((w) => w.id === id);
    if (idx === -1) {
      throw new Error('Watcher not found');
    }

    this.validate(patch, true);

    const w = { ...this.config.watchers[idx], ...patch, id };
    this.config.watchers[idx] = w;
    await this.save();

    if (this.watchers.has(id)) {
      await this.stopWatcher(id);
      await this.startWatcher(id);
    } else if (w.autostart) {
      await this.startWatcher(id);
    }
    return w;
  }

  /**
   * Remove a watcher and stop it if running.
   */
  async remove(id) {
    await this.stopWatcher(id).catch(() => {});
    this.config.watchers = this.config.watchers.filter((w) => w.id !== id);
    await this.save();
  }

  /**
   * Start all auto-start watchers on boot.
   */
  async autostart() {
    for (const w of this.config.watchers) {
      if (w.autostart) {
        await this.startWatcher(w.id).catch(() => {});
      }
    }
  }

  // ==========================================================================
  // DOCKER INTERACTION
  // ==========================================================================

  /**
   * Get a Docker container by name or ID (delegates to docker module).
   */
  async getContainer(ref) {
    return DockerUtil.getContainer(this.docker, ref);
  }

  /**
   * Check if a container is running (delegates to docker module).
   */
  async isRunning(container) {
    return DockerUtil.isRunning(container);
  }

  /**
   * Gracefully stop a container (delegates to docker module).
   */
  async stopGracefully(container, stopTimeoutSec) {
    return DockerUtil.stopGracefully(container, stopTimeoutSec, (e) => this.emit(e));
  }

  /**
   * Resolve container IP with caching (delegates to docker module).
   */
  async resolveContainerIPWithCache(containerName) {
    return DockerUtil.resolveContainerIPWithCache(
      this.docker,
      containerName,
      this.ipCache,
      this.ipCacheTTL,
      (e) => this.emit(e)
    );
  }

  /**
   * List Docker containers (delegates to docker module).
   */
  async listDockerContainers() {
    return DockerUtil.listDockerContainers(this.docker);
  }

  /**
   * Perform container action (delegates to docker module).
   */
  async containerAction(idOrName, action) {
    return DockerUtil.containerAction(this.docker, idOrName, action);
  }

  // ==========================================================================
  // WATCHER POLLING & LIFECYCLE
  // ==========================================================================

  /**
   * Single poll iteration (delegates to watcher-polling module).
   */
  async tickOne(w) {
    const container = await this.getContainer(w.targetContainer);
    return WatcherPolling.tickOne(
      w,
      container,
      this.watchers,
      this.docker,
      (name) => this.resolveContainerIPWithCache(name),
      (c, timeout, emit) => this.stopGracefully(c, timeout),
      (e) => this.emit(e)
    );
  }

  /**
   * Start periodic polling (delegates to watcher-polling module).
   */
  async startWatcher(id) {
    const w = this.config.watchers.find((x) => x.id === id);
    if (!w) {
      throw new Error('Watcher not found');
    }

    return WatcherPolling.startWatcher(
      w,
      this.watchers,
      this.docker,
      (docker, ref) => this.getContainer(ref),
      (name) => this.resolveContainerIPWithCache(name),
      (c, timeout) => this.stopGracefully(c, timeout),
      (e) => this.emit(e)
    );
  }

  /**
   * Stop periodic polling (delegates to watcher-polling module).
   */
  async stopWatcher(id) {
    return WatcherPolling.stopWatcher(id, this.watchers);
  }

  /**
   * Stop all watchers on shutdown (delegates to watcher-polling module).
   */
  async stopAllWatchers() {
    return WatcherPolling.stopAllWatchers(this.watchers);
  }

  // ==========================================================================
  // DOCKER LABELS SYNC
  // ==========================================================================

  /**
   * Sync watchers from Docker container labels.
   * Automatically creates/updates watchers based on labels.
   */
  async syncFromDockerLabels() {
    const prefix = this.labelPrefix;
    if (!prefix) {
      return;
    }

    const containers = await this.listDockerContainers();
    let changed = false;

    for (const c of containers) {
      const L = c.labels ?? {};
      const enabledRaw = L[`${prefix}enabled`];

      // Skip if not enabled
      if (enabledRaw && !/^(1|true|yes)$/i.test(String(enabledRaw))) {
        continue;
      }
      if (!enabledRaw) {
        continue;
      }

      const id = (L[`${prefix}id`] ?? c.name).replace(/[^a-zA-Z0-9._-]/g, '-');
      const name = L[`${prefix}name`] ?? c.name;
      const gamedigType = L[`${prefix}gamedig_type`];
      const autostart = /^(1|true|yes)$/i.test(String(L[`${prefix}autostart`] ?? 'true'));
      const inactivityMinutes = Number(L[`${prefix}inactivity_min`] ?? 10);
      const checkIntervalSec = Number(L[`${prefix}interval_sec`] ?? 60);
      const stopTimeoutSec = Number(L[`${prefix}stop_timeout_sec`] ?? 60);

      if (!gamedigType) {
        this.emit({
          type: 'warn',
          msg: `[labels] ${c.name}: missing gamedig_type label`
        });
        continue;
      }

      let payload;

      if (gamedigType === 'satisfactory') {
        // Satisfactory-specific configuration
        const host = L[`${prefix}query_host`] ?? c.name;
        const port = Number(L[`${prefix}query_port`] ?? 7777);
        const apiToken = L[`${prefix}api_token`];

        payload = {
          id,
          name,
          targetContainer: c.name,
          gamedigType,
          host,
          port,
          apiToken,
          inactivityMinutes,
          checkIntervalSec,
          stopTimeoutSec,
          autostart
        };
      } else {
        // Standard GameDig configuration
        const queryHost = L[`${prefix}query_host`] ?? c.name;
        const queryPort = Number(L[`${prefix}query_port`]);

        if (!queryHost || !queryPort) {
          this.emit({
            type: 'warn',
            msg: `[labels] ${c.name}: incomplete labels (query_host/query_port)`
          });
          continue;
        }

        payload = {
          id,
          name,
          targetContainer: c.name,
          gamedigType,
          queryHost,
          queryPort,
          inactivityMinutes,
          checkIntervalSec,
          stopTimeoutSec,
          autostart
        };
      }

      const idx = this.config.watchers.findIndex((w) => w.id === id);
      if (idx === -1) {
        try {
          this.config.watchers.push(payload);
          changed = true;
          this.emit({ type: 'info', msg: `[labels] watcher created: ${name}` });
        } catch (err) {
          this.emit({ type: 'error', msg: `[labels] create failed: ${err.message}` });
        }
      } else {
        this.config.watchers[idx] = { ...this.config.watchers[idx], ...payload };
        changed = true;
        this.emit({ type: 'info', msg: `[labels] watcher updated: ${name}` });
      }
    }

    if (changed) {
      await this.save();
      for (const w of this.config.watchers) {
        if (w.autostart && !this.watchers.has(w.id)) {
          try {
            await this.startWatcher(w.id);
          } catch {
            // Ignore startup errors
          }
        }
      }
    }
  }

  /**
   * Schedule periodic Docker label rescan.
   */
  scheduleRescan(sec) {
    const iv = Number(sec ?? process.env.RESCAN_INTERVAL_SEC ?? 0);
    if (!iv) {
      return;
    }
    if (this.rescanTimer) {
      clearInterval(this.rescanTimer);
    }
    this.rescanTimer = setInterval(
      () => this.syncFromDockerLabels().catch(() => {}),
      iv * 1000
    );
    this.emit({ type: 'info', msg: `[labels] rescan every ${iv}s` });
  }
}
