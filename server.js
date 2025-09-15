import express from 'express';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { WatchManager } from './src/manager.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(morgan('dev'));

const DATA_DIR = process.env.DATA_DIR || '/data';
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(DATA_DIR, 'config.json');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

function auth(req, res, next){
  if (!ADMIN_TOKEN) return next();
  const header = req.headers['authorization'] || '';
  if (header === `Bearer ${ADMIN_TOKEN}`) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CONFIG_PATH)) fs.writeFileSync(CONFIG_PATH, JSON.stringify({ watchers: [] }, null, 2));

const manager = new WatchManager({ dataDir: DATA_DIR, configPath: CONFIG_PATH });
console.log(`[manager] DATA_DIR=${DATA_DIR} CONFIG_PATH=${CONFIG_PATH} LABEL_PREFIX=${process.env.LABEL_PREFIX || 'autostop.'}`);
manager.subscribe(e => console.log(`[autostop] ${e.type}: ${e.msg}`));
await manager.load();
await manager.syncFromDockerLabels?.();
await manager.autostart();

// --- API (watchers only) ---
app.get('/api/watchers', auth, (req, res)=>{ res.json(manager.list()); });
app.post('/api/watchers', auth, async (req, res)=>{ try { const w = await manager.create(req.body); res.status(201).json(w);} catch(e){res.status(400).json({error:e.message});} });
app.put('/api/watchers/:id', auth, async (req, res)=>{ try { const w = await manager.update(req.params.id, req.body); res.json(w);} catch(e){res.status(400).json({error:e.message});} });
app.delete('/api/watchers/:id', auth, async (req, res)=>{ try { await manager.remove(req.params.id); res.status(204).end(); } catch(e){res.status(400).json({error:e.message});} });
app.post('/api/watchers/:id/start', auth, async (req, res)=>{ try { await manager.startWatcher(req.params.id); res.json({ok:true}); } catch(e){res.status(400).json({error:e.message});} });
app.post('/api/watchers/:id/stop', auth, async (req, res)=>{ try { await manager.stopWatcher(req.params.id); res.json({ok:true}); } catch(e){res.status(400).json({error:e.message});} });

app.get('/api/test-query', auth, async (req, res)=>{ try { const out = await manager.testQuery(req.query); res.json(out);} catch(e){res.status(400).json({error:e.message});} });

app.get('/health', (req, res)=>{ const list = manager.list(); const running = list.filter(w=>w.running).length; res.json({ ok:true, watchers: list.length, running }); });

// SSE for live logs (fixed ping line)
app.get('/api/events', auth, (req, res)=>{
  res.setHeader('Content-Type','text/event-stream');
  res.setHeader('Cache-Control','no-cache');
  res.setHeader('Connection','keep-alive');
  if (res.flushHeaders) res.flushHeaders();
  const send = (event)=>{ res.write('data: ' + JSON.stringify(event) + '\n\n'); };
  const unsub = manager.subscribe(send);
  const ping = setInterval(()=>{
    res.write(': ping\n\n'); // keep-alive comment line
  }, 25000);
  req.on('close', ()=>{ clearInterval(ping); unsub(); try{res.end();}catch{} });
});

app.use('/', express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 8080;
app.listen(PORT, ()=>{ console.log(`[manager] UI on http://0.0.0.0:${PORT}`); });

const shutdown = async (sig)=>{
  console.log(`[manager] ${sig} -> saving & stopping watchers`);
  try { await manager.save(); } catch {}
  try { await manager.stopAllWatchers?.(); } catch {}
  process.exit(0);
};
process.on('SIGTERM', ()=>shutdown('SIGTERM'));
process.on('SIGINT',  ()=>shutdown('SIGINT'));
