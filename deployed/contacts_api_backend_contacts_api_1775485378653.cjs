'use strict';
const http = require('http');
const PORT = process.env.PORT || 4109;

// ── Micro-router (written by Cadenza, not LLM) ────────────────────────────────
const _routes = [];
const router = {
  get:    (p, fn) => _routes.push({ method: 'GET',    pattern: p, fn }),
  post:   (p, fn) => _routes.push({ method: 'POST',   pattern: p, fn }),
  put:    (p, fn) => _routes.push({ method: 'PUT',    pattern: p, fn }),
  delete: (p, fn) => _routes.push({ method: 'DELETE', pattern: p, fn }),
  patch:  (p, fn) => _routes.push({ method: 'PATCH',  pattern: p, fn }),
};
function _match(method, pathname) {
  for (const r of _routes) {
    if (r.method !== method && !(method === 'HEAD' && r.method === 'GET')) continue;
    const keys = [];
    const re = new RegExp('^' + r.pattern.replace(/:([^/]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '\/?$');
    const m = pathname.match(re);
    if (m) return { fn: r.fn, params: Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

// Built-in health route (always available)
router.get('/health', () => ({ ok: true }));
router.get('/schema', () => ({ routes: _routes.map(r => ({ method: r.method, path: r.pattern })) }));

// ── LLM-generated data and routes ────────────────────────────────────────────
const DB = 'http://localhost:4107';

const toApi = c => ({
  id: c.id,
  name: String(c.contactManagementName),
  phone: c.phone,
  email: c.email,
  address: c.address,
  birthday: c.birthday || '',
  createdAt: c.createdAt
});

router.get('/contacts', async () => {
  const r = await fetch(DB + '/contacts');
  if (!r.ok) return [r.status, await r.json()];
  const list = await r.json();
  return list.map(toApi);
});

router.post('/contacts', async (_, body) => {
  const name = body.contactManagementName ?? body.name;
  if (!name && name !== 0) return [400, { error: 'name required' }];
  const payload = {
    contactManagementName: name,
    phone: body.phone ?? '',
    email: body.email ?? '',
    address: body.address ?? '',
    birthday: body.birthdayRestApiForCreating ?? body.birthday ?? ''
  };
  const r = await fetch(DB + '/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) return [r.status, await r.json()];
  const created = await r.json();
  return [201, toApi(created)];
});

router.get('/contacts/:id', async (p) => {
  const r = await fetch(`${DB}/contacts/${p.id}`);
  if (!r.ok) return [404, { error: 'not found' }];
  const c = await r.json();
  return toApi(c);
});

router.put('/contacts/:id', async (p, body) => {
  const getR = await fetch(`${DB}/contacts/${p.id}`);
  if (!getR.ok) return [404, { error: 'not found' }];
  const existing = await getR.json();
  const payload = {
    contactManagementName: body.name !== undefined ? body.name : existing.contactManagementName,
    phone: body.phone !== undefined ? body.phone : existing.phone,
    email: body.email !== undefined ? body.email : existing.email,
    address: body.address !== undefined ? body.address : existing.address,
    birthday: body.birthday !== undefined ? body.birthday : existing.birthday
  };
  const upd = await fetch(`${DB}/contacts/${p.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!upd.ok) return [upd.status, await upd.json()];
  const updated = await upd.json();
  return toApi(updated);
});

router.delete('/contacts/:id', async (p) => {
  const r = await fetch(`${DB}/contacts/${p.id}`, { method: 'DELETE' });
  if (!r.ok) return [404, { error: 'not found' }];
  return [204, null];
});
// ─────────────────────────────────────────────────────────────────────────────

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const [pathname, qs = ''] = req.url.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs));
  let raw = '';
  req.on('data', d => { raw += d; });
  req.on('end', async () => {
    let body = {};
    try { if (raw) body = JSON.parse(raw); } catch {}
    res.setHeader('Content-Type', 'application/json');
    const match = _match(req.method, pathname);
    if (!match) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
    try {
      const result = await match.fn(match.params, body, query);
      // Distinguish [statusCode, data] tuples from plain array return values
      const isStatusTuple = Array.isArray(result) && result.length === 2 && typeof result[0] === 'number' && result[0] >= 100 && result[0] < 600;
      const [status, data] = isStatusTuple ? result : [200, result];
      res.writeHead(status);
      res.end(JSON.stringify(data ?? null));
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
  });
}).listen(PORT, () => console.log('Server listening on port ' + PORT));
