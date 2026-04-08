// index.js — Cadenza Agent backend entry point (port 3010)
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import { spawn } from 'child_process';
import 'dotenv/config';
import { logAgent, logBus, logBuffer } from './logger.js';

export { logAgent };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3010;

// ── Start CadenzaDB child process ──────────────────────────────────────────────
function startCadenzaDB() {
  return new Promise((resolve) => {
    const dbPath = path.join(__dirname, 'cadenza-db.js');
    const proc = spawn('node', [dbPath], { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
    proc.on('message', (msg) => {
      if (msg === 'ready') resolve(proc);
    });
    proc.on('exit', (code) => {
      if (code !== 0) console.error(`[CadenzaDB] Exited with code ${code}`);
    });
    // Fallback: assume ready after 2s
    setTimeout(() => resolve(proc), 2000);
  });
}

async function waitForDB(retries = 20) {
  const fetch = (await import('node-fetch')).default;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('http://localhost:3001/health', { signal: AbortSignal.timeout(1000) });
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

// ── Express app ────────────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

// ── SSE log stream ─────────────────────────────────────────────────────────────
app.get('/api/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send buffered logs
  for (const entry of logBuffer) {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  }

  // Stream live logs
  const handler = (entry) => {
    try { res.write(`data: ${JSON.stringify(entry)}\n\n`); } catch {}
  };
  logBus.on('entry', handler);

  // Heartbeat
  const hb = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(hb); }
  }, 15000);

  req.on('close', () => {
    logBus.off('entry', handler);
    clearInterval(hb);
  });
});

// ── Chat endpoint ──────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, focusIds, uiSpec } = req.body;
  if (!message) return res.status(400).json({ error: 'Missing message' });
  const agentId = `agent_${Date.now()}`;
  logAgent({ type: 'user', message });

  // Build enriched message with focus context if services were selected
  let enriched = message;
  if (Array.isArray(focusIds) && focusIds.length > 0) {
    const { default: registry } = await import('./registry/service-registry.js');
    const all = registry.getAllServices();
    const focused = focusIds.map(id => all.find(s => s.id === id)).filter(Boolean);
    if (focused.length) {
      const ctx = focused.map(s => `id:${s.id} name:"${s.name}" type:${s.type} groupId:${s.groupId}`).join(', ');
      enriched = `[Focus: ${ctx}]\n${enriched}`;
    }
  }

  // Attach UI spec as a separate delimited block — task-interpret strips it before
  // sending to the intent LLM so it never gets interpreted as services to build.
  if (uiSpec && typeof uiSpec === 'object') {
    enriched = `${enriched}\n[UI_SPEC]:${JSON.stringify(uiSpec)}`;
  }

  const { userBroker } = await import('./agent-graph.js');
  userBroker.emit('request_received', enriched);
  res.json({ ok: true, agentId });
});

// ── Services API ───────────────────────────────────────────────────────────────
app.get('/api/services', async (_req, res) => {
  const { default: registry } = await import('./registry/service-registry.js');
  const services = registry.getAllServices().map(({ proc, code, _plan, ...rest }) => rest);
  res.json(services);
});

app.delete('/api/services/:id', async (req, res) => {
  const { default: registry } = await import('./registry/service-registry.js');
  const { userBroker } = await import('./agent-graph.js');
  const svc = registry.getService(req.params.id);
  if (!svc) return res.status(404).json({ error: 'Not found' });
  userBroker.emit('delete_group', svc.groupId);
  res.json({ ok: true });
});

app.post('/api/agent/cancel', async (_req, res) => {
  const { cancelCurrentSession } = await import('./agent-graph.js');
  cancelCurrentSession(); // emits done log internally
  res.json({ ok: true });
});

app.post('/api/retry/:id', async (req, res) => {
  const { default: registry } = await import('./registry/service-registry.js');
  const { userBroker } = await import('./agent-graph.js');
  const svc = registry.getService(req.params.id);
  if (!svc) return res.status(404).json({ error: 'Not found' });
  svc._fixRetries = 0;
  // Use retry_service (full regen+test pipeline) not run_tests (which short-circuits if no cached tests)
  userBroker.emit('retry_service', svc.id);
  res.json({ ok: true });
});

app.post('/api/services/:id/stop', async (req, res) => {
  const { default: registry } = await import('./registry/service-registry.js');
  const { killService } = await import('./services/deployer.js');
  const svc = registry.getService(req.params.id);
  if (!svc) return res.status(404).json({ error: 'Not found' });
  killService(svc);
  await registry.updateService(svc.id, { status: 'stopped' });
  res.json({ ok: true });
});

app.post('/api/services/:id/start', async (req, res) => {
  const { default: registry } = await import('./registry/service-registry.js');
  const { spawnService } = await import('./services/deployer.js');
  const svc = registry.getService(req.params.id);
  if (!svc) return res.status(404).json({ error: 'Not found' });
  if (!svc.filePath) return res.status(400).json({ error: 'No file to start' });
  const proc = spawnService(svc);
  svc.proc = proc;
  await registry.updateService(svc.id, { status: 'running' });
  res.json({ ok: true });
});

// ── Snapshots API ─────────────────────────────────────────────────────────────
app.get('/api/snapshots', async (_req, res) => {
  const { listSnapshots } = await import('./services/self-modifier.js');
  res.json(listSnapshots());
});

app.post('/api/snapshots/:id/rollback', async (req, res) => {
  const { rollbackToSnapshot } = await import('./services/self-modifier.js');
  try {
    await rollbackToSnapshot(req.params.id);
    logAgent({ type: 'fix', message: `Rolled back to snapshot ${req.params.id} via API — restart server to apply` });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Feature suggestion (pre-build dialog) ─────────────────────────────────────
app.post('/api/suggest-features', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.json({ isNew: false });
  try {
    const { suggestFeatures } = await import('./services/llm-intent.js');
    res.json(await suggestFeatures(message));
  } catch {
    res.json({ isNew: false });
  }
});

// ── Plans API ──────────────────────────────────────────────────────────────────
app.get('/api/plans', async (_req, res) => {
  const { dbFetch } = await import('./registry/cadenza-db-client.js');
  try {
    const plans = await dbFetch('/plans');
    res.json(plans);
  } catch {
    res.json([]);
  }
});

// ── Graph (task map) API ───────────────────────────────────────────────────────
app.get('/api/graph', async (_req, res) => {
  const { default: cadenza } = await import('./cadenza-core.js');
  res.json(cadenza.registry.export());
});

// ── Model stats API ────────────────────────────────────────────────────────────
app.get('/api/model-stats', async (_req, res) => {
  const { getAllStats } = await import('./registry/model-stats.js');
  res.json(getAllStats());
});

// ── CadenzaDB proxy (for TabCadenzaDB) ───────────────────────────────────────
app.get('/api/db/health', async (_req, res) => {
  const fetch = (await import('node-fetch')).default;
  try {
    const r = await fetch('http://localhost:3001/health');
    res.json(await r.json());
  } catch {
    res.status(503).json({ error: 'CadenzaDB unavailable' });
  }
});

// ── Startup ────────────────────────────────────────────────────────────────────
async function start() {
  console.log('[Cadenza] Starting CadenzaDB...');
  await startCadenzaDB();
  const dbReady = await waitForDB();
  if (!dbReady) {
    console.warn('[Cadenza] CadenzaDB not available — continuing without persistence');
  } else {
    console.log('[Cadenza] CadenzaDB ready');
    // Rehydrate registry from DB (marks all as stopped — no auto-respawn)
    const { rehydrateRegistry } = await import('./registry/cadenza-db-client.js');
    const { default: registry } = await import('./registry/service-registry.js');
    await rehydrateRegistry(registry);
  }

  // Clean up deployed files from previous crashed runs
  try {
    const { readdirSync, unlinkSync } = await import('fs');
    const deployedDir = path.join(__dirname, '..', 'deployed');
    const files = readdirSync(deployedDir).filter(f => f.endsWith('.cjs') || f.endsWith('.html'));
    files.forEach(f => { try { unlinkSync(path.join(deployedDir, f)); } catch {} });
    if (files.length) console.log(`[Cadenza] Cleaned ${files.length} stale deployed files`);
  } catch {}

  // Load agent graph (registers all tasks)
  await import('./agent-graph.js');
  console.log('[Cadenza] Agent graph loaded');

  const server = createServer(app);
  server.listen(PORT, () => {
    logAgent({ type: 'info', message: `Cadenza Agent backend running on port ${PORT}` });
    console.log(`[Cadenza] Backend listening on http://localhost:${PORT}`);
  });
}

start().catch(e => {
  console.error('[Cadenza] Fatal startup error:', e);
  process.exit(1);
});
