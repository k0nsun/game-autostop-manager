/**
 * Storage Module - Configuration persistence
 *
 * Handles loading and saving watcher configurations to disk.
 * Ensures atomic writes to prevent data corruption.
 */

import * as fsp from 'fs/promises';
import path from 'path';

/**
 * Load watchers configuration from disk.
 * Ensures autostart defaults to true if not specified.
 *
 * @param {string} configPath - Path to configuration file
 * @returns {Promise<Object>} Configuration object { watchers: [] }
 */
export async function loadConfig(configPath) {
  try {
    const raw = await fsp.readFile(configPath, 'utf8');
    const config = JSON.parse(raw);

    if (!Array.isArray(config.watchers)) {
      config.watchers = [];
    }

    // Normalize autostart field
    for (const w of config.watchers) {
      if (typeof w.autostart !== 'boolean') {
        w.autostart = true;
      }
    }

    return config;
  } catch {
    // Return empty config if load fails
    return { watchers: [] };
  }
}

/**
 * Save configuration to disk atomically.
 * Writes to a temp file first, then renames to avoid partial writes.
 *
 * @param {string} configPath - Path to configuration file
 * @param {Object} config - Configuration object to save
 * @returns {Promise<void>}
 */
export async function saveConfig(configPath, config) {
  const dir = path.dirname(configPath);
  await fsp.mkdir(dir, { recursive: true });

  const tmp = `${configPath}.tmp`;
  const data = JSON.stringify(config, null, 2);

  const fh = await fsp.open(tmp, 'w');
  try {
    await fh.writeFile(data, 'utf8');
    await fh.sync();
  } finally {
    await fh.close();
  }

  await fsp.rename(tmp, configPath);
}
