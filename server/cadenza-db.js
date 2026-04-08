// cadenza-db.js — Lightweight persistence DB on port 3001
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Store data at project root
const DATA_FILE = path.join(__dirname, '..', 'cadenza-data.json');

// Inline signal broker for internal events
class SignalBroker {
  constructor() { this._ee = new EventEmitter(); this._ee.setMaxListeners(50); }
  on(e, h) { this._ee.on(e, h); }
  emit(e, d) { this._ee.emit(e, d); }
}
const broker = new SignalBroker();

// ── Data store ─────────────────────────────────────────────────────────────────
let store = { services: [], plans: [], kv: {} };

function loadStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      store.services = store.services || [];
      store.plans = store.plans || [];
      store.kv = store.kv || {};
    }
  } catch (e) {
    console.error('[CadenzaDB] Failed to load store:', e.message);
  }
}

function saveStore() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
    broker.emit('save', store);
  } catch (e) {
    console.error('[CadenzaDB] Failed to save store:', e.message);
  }
}

loadStore();

// ── Express app ────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '4mb' }));

// Services CRUD
app.get('/services', (req, res) => res.json(store.services));

app.post('/services', (req, res) => {
  const svc = req.body;
  if (!svc || !svc.id) return res.status(400).json({ error: 'Missing id' });
  const idx = store.services.findIndex(s => s.id === svc.id);
  if (idx !== -1) store.services[idx] = svc;
  else store.services.push(svc);
  saveStore();
  res.json({ ok: true });
});

app.put('/services/:id', (req, res) => {
  const idx = store.services.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  store.services[idx] = { ...store.services[idx], ...req.body };
  saveStore();
  res.json({ ok: true });
});

app.delete('/services/:id', (req, res) => {
  store.services = store.services.filter(s => s.id !== req.params.id);
  saveStore();
  res.json({ ok: true });
});

// Plans CRUD
app.get('/plans', (req, res) => res.json(store.plans));

app.post('/plans', (req, res) => {
  const plan = req.body;
  if (!plan || !plan.id) return res.status(400).json({ error: 'Missing id' });
  const idx = store.plans.findIndex(p => p.id === plan.id);
  if (idx !== -1) store.plans[idx] = plan;
  else store.plans.push(plan);
  saveStore();
  res.json({ ok: true });
});

// KV store
app.get('/kv/:key', (req, res) => {
  const val = store.kv[req.params.key];
  if (val === undefined) return res.status(404).json({ error: 'Not found' });
  res.json({ key: req.params.key, value: val });
});

app.put('/kv/:key', (req, res) => {
  store.kv[req.params.key] = req.body.value;
  saveStore();
  res.json({ ok: true });
});

app.delete('/kv/:key', (req, res) => {
  delete store.kv[req.params.key];
  saveStore();
  res.json({ ok: true });
});

// Dump all data for rehydration
app.get('/dump', (req, res) => res.json(store));

// Health
app.get('/health', (req, res) => res.json({ ok: true, services: store.services.length, plans: store.plans.length }));

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[CadenzaDB] Listening on port ${PORT}`);
  process.send?.('ready');
});
