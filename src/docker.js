/**
 * Docker Module - Container interactions
 *
 * Handles all Docker API calls:
 * - Container inspection
 * - Container state management
 * - IP resolution with caching
 * - Container listing with metadata
 */

/**
 * Get a Docker container by name or ID.
 * Returns null if container not found or not available.
 *
 * @param {Docker} docker - Dockerode instance
 * @param {string} ref - Container name or ID
 * @returns {Promise<Object|null>} Container object or null
 */
export async function getContainer(docker, ref) {
  const c = docker.getContainer(ref);
  return c.inspect()
    .then(() => c)
    .catch(() => null);
}

/**
 * Check if a container is currently running.
 *
 * @param {Object} container - Docker container object
 * @returns {Promise<boolean>} True if running
 */
export async function isRunning(container) {
  const info = await container.inspect();
  return info?.State?.Running === true;
}

/**
 * Gracefully stop a container with timeout.
 *
 * @param {Object} container - Docker container object
 * @param {number} stopTimeoutSec - Timeout in seconds
 * @param {Function} emitEvent - Event emitter (for logging errors)
 * @returns {Promise<void>}
 */
export async function stopGracefully(container, stopTimeoutSec, emitEvent) {
  try {
    await container.stop({ t: stopTimeoutSec });
  } catch (err) {
    if (emitEvent) {
      emitEvent({ type: 'error', msg: `Stop error: ${err.message}` });
    }
  }
}

/**
 * Resolve container name to IP address with caching.
 * Caches results to avoid repeated lookups.
 *
 * @param {Docker} docker - Dockerode instance
 * @param {string} containerName - Container name
 * @param {Map} ipCache - IP cache map
 * @param {number} cacheTTL - Cache TTL in seconds
 * @param {Function} emitEvent - Event emitter (for logging warnings)
 * @returns {Promise<string|null>} IP address or null
 */
export async function resolveContainerIPWithCache(
  docker,
  containerName,
  ipCache,
  cacheTTL,
  emitEvent
) {
  const now = Date.now() / 1000;
  const cached = ipCache.get(containerName);

  if (cached && now - cached.timestamp < cacheTTL) {
    return cached.ip;
  }

  try {
    const container = await getContainer(docker, containerName);
    if (!container) {
      return null;
    }

    const info = await container.inspect();
    const networks = info.NetworkSettings.Networks;
    const ip = Object.values(networks)[0]?.IPAddress;

    if (ip) {
      ipCache.set(containerName, { ip, timestamp: now });
    }

    return ip || null;
  } catch (err) {
    if (emitEvent) {
      emitEvent({ type: 'warn', msg: `[resolveIP] ${containerName}: ${err.message}` });
    }
    return null;
  }
}

/**
 * List all Docker containers with metadata.
 *
 * @param {Docker} docker - Dockerode instance
 * @returns {Promise<Array>} Array of container objects
 */
export async function listDockerContainers(docker) {
  const all = await docker.listContainers({ all: true });
  return all.map((c) => ({
    id: c.Id,
    name: c.Names && c.Names[0] ? c.Names[0].replace(/^\//, '') : c.Id.substring(0, 12),
    image: c.Image,
    state: c.State,
    status: c.Status,
    labels: c.LabelS ?? c.Labels ?? {}
  }));
}

/**
 * Perform an action on a container (start/stop).
 *
 * @param {Docker} docker - Dockerode instance
 * @param {string} idOrName - Container name or ID
 * @param {string} action - 'start' or 'stop'
 * @returns {Promise<Object>} { ok: true }
 * @throws {Error} If container not found or action unsupported
 */
export async function containerAction(docker, idOrName, action) {
  const c = await getContainer(docker, idOrName);
  if (!c) {
    throw new Error('Container not found');
  }

  if (action === 'start') {
    await c.start();
    return { ok: true };
  }

  if (action === 'stop') {
    await c.stop({ t: 60 });
    return { ok: true };
  }

  throw new Error('Unsupported action');
}
