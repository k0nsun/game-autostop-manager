/**
 * Watcher Polling Module - Polling and lifecycle management
 *
 * Handles:
 * - Polling game servers for player count (tickOne)
 * - Managing polling intervals (startWatcher, stopWatcher)
 * - Graceful server shutdown after inactivity
 * - Type-specific queries (GameDig vs Satisfactory HTTPS API)
 */

import Gamedig from 'gamedig';
import { pollSatisfactory } from './providers/satisfactory.js';

/**
 * Poll a single watcher once and update its state.
 *
 * Handles:
 * - Stopping containers if inactivity reached
 * - Type-specific queries (GameDig vs Satisfactory)
 * - Graceful failure on query errors
 *
 * @param {Object} watcher - Watcher config (id, name, gamedigType, ...)
 * @param {Object} container - Docker container object or null
 * @param {Map} watchers - Runtime state map (id -> { timer, emptyMinutes, ... })
 * @param {Object} docker - Dockerode instance
 * @param {Function} resolveContainerIPWithCache - Function to resolve IP
 * @param {Function} stopGracefully - Function to stop container
 * @param {Function} emitEvent - Event emitter function
 * @returns {Promise<void>}
 */
export async function tickOne(
  watcher,
  container,
  watchers,
  docker,
  resolveContainerIPWithCache,
  stopGracefully,
  emitEvent
) {
  if (!container) {
    emitEvent({ type: 'warn', msg: `[${watcher.name}] Container ${watcher.targetContainer} not found` });
    return;
  }

  // Check if container is running
  let isContainerRunning = false;
  try {
    const info = await container.inspect();
    isContainerRunning = info?.State?.Running === true;
  } catch {
    isContainerRunning = false;
  }

  const state = watchers.get(watcher.id);

  if (!isContainerRunning) {
    // Reset counters if target is stopped
    state.emptyMinutes = 0;
    state.lastPlayers = -1;
    return;
  }

  try {
    let players = 0;

    // Query player count based on game type
    if (watcher.gamedigType === 'satisfactory') {
      // Satisfactory: use custom HTTPS API
      const result = await pollSatisfactory(watcher);
      players = result.players;
    } else {
      // Other games: use GameDig
      const ip = await resolveContainerIPWithCache(watcher.targetContainer);
      if (!ip) {
        emitEvent({
          type: 'warn',
          msg: `[${watcher.name}] IP not resolved for container ${watcher.targetContainer}`
        });
        return;
      }
      const result = await Gamedig.query({
        type: watcher.gamedigType,
        host: ip,
        port: Number(watcher.queryPort)
      });
      players = Array.isArray(result.players)
        ? result.players.length
        : typeof result.numplayers === 'number'
          ? result.numplayers
          : 0;
    }

    // Log player count changes
    if (players !== state.lastPlayers) {
      emitEvent({ type: 'info', msg: `[${watcher.name}] players: ${players}` });
      state.lastPlayers = players;
    }

    // Handle inactivity
    if (players === 0) {
      state.emptyMinutes += state.intervalSec / 60;
      if (state.emptyMinutes >= watcher.inactivityMinutes) {
        emitEvent({ type: 'info', msg: `[${watcher.name}] stopping (inactivity)` });
        await stopGracefully(container, watcher.stopTimeoutSec, emitEvent);
        state.emptyMinutes = 0;
        state.lastPlayers = -1;
      }
    } else {
      state.emptyMinutes = 0;
    }
  } catch (err) {
    // Query failed: log but don't penalize (keep inactivity counter unchanged)
    emitEvent({ type: 'warn', msg: `[${watcher.name}] query unavailable (no penalty)` });
  }
}

/**
 * Start periodic polling for a watcher.
 *
 * Creates a polling interval, runs first poll immediately,
 * and stores state for lifecycle management.
 *
 * @param {Object} watcher - Watcher config
 * @param {Map} watchers - Runtime state map
 * @param {Object} docker - Dockerode instance
 * @param {Function} getContainer - Function to get container
 * @param {Function} resolveContainerIPWithCache - Function to resolve IP
 * @param {Function} stopGracefully - Function to stop container
 * @param {Function} emitEvent - Event emitter function
 * @returns {Promise<void>}
 */
export async function startWatcher(
  watcher,
  watchers,
  docker,
  getContainer,
  resolveContainerIPWithCache,
  stopGracefully,
  emitEvent
) {
  const id = watcher.id;

  if (watchers.has(id)) {
    return; // Already running
  }

  const intervalSec = Number(watcher.checkIntervalSec ?? 60);
  const state = {
    timer: null,
    intervalSec,
    emptyMinutes: 0,
    lastPlayers: -1,
    busy: false
  };

  const run = async () => {
    if (state.busy) return;
    state.busy = true;
    try {
      const container = await getContainer(docker, watcher.targetContainer);
      await tickOne(
        watcher,
        container,
        watchers,
        docker,
        resolveContainerIPWithCache,
        stopGracefully,
        emitEvent
      );
    } finally {
      state.busy = false;
    }
  };

  state.timer = setInterval(run, intervalSec * 1000);
  watchers.set(id, state);
  emitEvent({ type: 'info', msg: `[${watcher.name}] watcher started (every ${intervalSec}s)` });

  // Run immediately first
  await run();
}

/**
 * Stop periodic polling for a watcher.
 *
 * @param {string} id - Watcher ID
 * @param {Map} watchers - Runtime state map
 * @returns {Promise<void>}
 */
export async function stopWatcher(id, watchers) {
  const state = watchers.get(id);
  if (!state) {
    return;
  }
  clearInterval(state.timer);
  watchers.delete(id);
}

/**
 * Stop all running watchers.
 * Used during shutdown.
 *
 * @param {Map} watchers - Runtime state map
 * @returns {Promise<void>}
 */
export async function stopAllWatchers(watchers) {
  for (const id of [...watchers.keys()]) {
    await stopWatcher(id, watchers);
  }
}
