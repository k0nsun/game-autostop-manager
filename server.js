/**
 * Game Auto-Stop Manager - Express Server
 *
 * REST API endpoints for managing watchers + Server-Sent Events (SSE) for live logs
 */

import express from 'express';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { WatchManager } from './src/manager.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(express.json());
app.use(morgan('dev'));

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATA_DIR = process.env.DATA_DIR || '/data';
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(DATA_DIR, 'config.json');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const LABEL_PREFIX = process.env.LABEL_PREFIX || 'autostop.';
const RESCAN_INTERVAL_SEC = Number(process.env.RESCAN_INTERVAL_SEC || 0);

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(CONFIG_PATH)) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ watchers: [] }, null, 2));
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

function authMiddleware(req, res, next) {
  if (!ADMIN_TOKEN) {
    return next();
  }
  const header = req.headers['authorization'] || '';
  if (header === `Bearer ${ADMIN_TOKEN}`) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

// ============================================================================
// MANAGER INITIALIZATION
// ============================================================================

const manager = new WatchManager({ dataDir: DATA_DIR, configPath: CONFIG_PATH });

// Subscribe to manager events for logging
manager.subscribe((event) => {
  console.log(`[autostop] ${event.type}: ${event.msg}`);
});

// Initialize manager
console.log(`[server] DATA_DIR=${DATA_DIR} CONFIG_PATH=${CONFIG_PATH} LABEL_PREFIX=${LABEL_PREFIX}`);
await manager.load();
await manager.syncFromDockerLabels?.();
await manager.autostart();
if (RESCAN_INTERVAL_SEC > 0) {
  manager.scheduleRescan(RESCAN_INTERVAL_SEC);
}

// ============================================================================
// REST API ENDPOINTS
// ============================================================================

/**
 * GET /api/watchers
 * List all watchers with current status
 */
app.get('/api/watchers', authMiddleware, (req, res) => {
  res.json(manager.list());
});

/**
 * POST /api/watchers
 * Create a new watcher
 */
app.post('/api/watchers', authMiddleware, async (req, res) => {
  try {
    const w = await manager.create(req.body);
    res.status(201).json(w);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/watchers/:id
 * Update a watcher
 */
app.put('/api/watchers/:id', authMiddleware, async (req, res) => {
  try {
    const w = await manager.update(req.params.id, req.body);
    res.json(w);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * DELETE /api/watchers/:id
 * Delete a watcher
 */
app.delete('/api/watchers/:id', authMiddleware, async (req, res) => {
  try {
    await manager.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/watchers/:id/start
 * Start a watcher
 */
app.post('/api/watchers/:id/start', authMiddleware, async (req, res) => {
  try {
    await manager.startWatcher(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/watchers/:id/stop
 * Stop a watcher
 */
app.post('/api/watchers/:id/stop', authMiddleware, async (req, res) => {
  try {
    await manager.stopWatcher(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  const list = manager.list();
  const running = list.filter((w) => w.running).length;
  res.json({ ok: true, watchers: list.length, running });
});

// ============================================================================
// SERVER-SENT EVENTS (SSE) ENDPOINT
// ============================================================================

/**
 * GET /api/events
 * Stream live logs via Server-Sent Events
 */
app.get('/api/events', authMiddleware, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (res.flushHeaders) {
    res.flushHeaders();
  }

  const send = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Subscribe to manager events
  const unsub = manager.subscribe(send);

  // Send keep-alive ping every 25 seconds
  const ping = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(ping);
    unsub();
    try {
      res.end();
    } catch {
      // Ignore errors during cleanup
    }
  });
});

// ============================================================================
// STATIC FILES
// ============================================================================

app.use('/', express.static(path.join(__dirname, 'public')));

// ============================================================================
// SERVER START
// ============================================================================

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[server] UI on http://0.0.0.0:${PORT}`);
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

const shutdown = async (sig) => {
  console.log(`[server] ${sig} -> saving & stopping watchers`);
  try {
    await manager.save();
  } catch {
    // Ignore save errors
  }
  try {
    await manager.stopAllWatchers?.();
  } catch {
    // Ignore stop errors
  }
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

