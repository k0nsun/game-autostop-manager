/**
 * Satisfactory API Provider
 *
 * Provides functions to query Satisfactory servers via their private HTTPS API
 * instead of using GameDig (which doesn't support Satisfactory's API).
 *
 * Uses self-signed certificates and accepts them without verification.
 */

import https from 'https';
import axios from 'axios';

// Create HTTPS agent that ignores self-signed certificate errors
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Authenticate with admin password to obtain an API token.
 *
 * @param {Object} options
 * @param {string} options.host - Server IP or hostname
 * @param {number} options.port - API port (default 7777)
 * @param {string} options.adminPassword - Admin password
 * @param {number} options.timeoutMs - Request timeout (default 4000)
 * @returns {Promise<string|null>} API token or null if authentication fails
 */
export async function passwordLogin({ host, port = 7777, adminPassword, timeoutMs = 4000 }) {
  if (!adminPassword) {
    return null;
  }

  const url = `https://${host}:${port}/api/v1/`;
  const payload = {
    function: 'PasswordLogin',
    data: {
      MinimumPrivilegeLevel: 'Administrator',
      Password: adminPassword
    }
  };

  try {
    const { data } = await axios.post(url, payload, {
      httpsAgent,
      timeout: timeoutMs,
      headers: { 'Content-Type': 'application/json' }
    });
    return data?.data?.AuthenticationToken || null;
  } catch {
    return null;
  }
}

// ============================================================================
// SERVER STATE QUERY
// ============================================================================

/**
 * Query current server state (online/offline, player count).
 *
 * @param {Object} options
 * @param {string} options.host - Server IP or hostname
 * @param {number} options.port - API port (default 7777)
 * @param {string} options.apiToken - API authentication token (optional)
 * @param {number} options.timeoutMs - Request timeout (default 4000)
 * @returns {Promise<Object>} { state, players }
 */
export async function queryServerState({
  host,
  port = 7777,
  apiToken,
  timeoutMs = 4000
}) {
  const url = `https://${host}:${port}/api/v1/`;
  const headers = { 'Content-Type': 'application/json' };

  if (apiToken) {
    headers['Authorization'] = `Bearer ${apiToken}`;
  }

  const { data } = await axios.post(
    url,
    { function: 'QueryServerState', data: {} },
    { httpsAgent, timeout: timeoutMs, headers }
  );

  const d = data?.data || {};
  
  // Determine server state
  let state = '';
  if (d.serverGameState?.isGameRunning) {
    state = 'playing';
  } else {
    state = String(d.ServerState || d.serverState || 'offline').toLowerCase();
  }
  
  // Handle different API response formats for player count
  let players = 0;
  if (d.serverGameState?.numConnectedPlayers !== undefined) {
    // Format: { data: { serverGameState: { numConnectedPlayers: N } } }
    players = d.serverGameState.numConnectedPlayers;
  } else if (Array.isArray(d.ConnectedPlayers)) {
    players = d.ConnectedPlayers.length;
  } else if (Array.isArray(d.connectedPlayers)) {
    players = d.connectedPlayers.length;
  } else if (d.PlayerCount !== undefined) {
    players = d.PlayerCount;
  } else if (d.playerCount !== undefined) {
    players = d.playerCount;
  }

  return { state, players: Number(players) || 0 };
}

// ============================================================================
// POLLING FUNCTION
// ============================================================================

/**
 * Poll Satisfactory server for current player count.
 * Handles both token-based and password-based authentication.
 * Automatically resolves container name to IP if needed.
 *
 * @param {Object} watcher - Watcher configuration object
 * @param {string} watcher.host - Server IP, hostname, or container name
 * @param {number} watcher.port - API port (default 7777)
 * @param {string} watcher.apiToken - API token (optional)
 * @param {string} watcher.adminPassword - Admin password (optional, legacy)
 * @param {number} watcher.timeoutMs - Request timeout (default 4000)
 * @param {Object} docker - Dockerode instance (optional, for resolving container names)
 * @param {Function} resolveContainerIPWithCache - Function to resolve IP (optional)
 * @returns {Promise<Object>} { available: boolean, players: number }
 */
export async function pollSatisfactory(watcher, docker, resolveContainerIPWithCache) {
  try {
    let host = watcher.host;
    const port = Number(watcher.port) || 7777;
    const timeoutMs = Number(watcher.timeoutMs) || 4000;

    // If host looks like a container name (not an IP), resolve it
    if (docker && resolveContainerIPWithCache && host && !host.match(/^\d+\./)) {
      const resolvedIP = await resolveContainerIPWithCache(docker, host, new Map(), 300);
      if (resolvedIP) {
        host = resolvedIP;
      }
    }

    let token = watcher.apiToken || process.env.SATISFACTORY_API_TOKEN;

    // Fallback: try password login (legacy support)
    if (!token && watcher.adminPassword) {
      token = await passwordLogin({
        host,
        port,
        adminPassword: watcher.adminPassword,
        timeoutMs
      });
    }

    const { state, players } = await queryServerState({
      host,
      port,
      apiToken: token,
      timeoutMs
    });

    // Server is available if state is "playing"
    return { available: state === 'playing', players };
  } catch (err) {
    // Fallback: server unreachable
    return { available: false, players: 0 };
  }
}