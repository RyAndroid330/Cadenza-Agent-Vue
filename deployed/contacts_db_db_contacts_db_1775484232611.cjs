'use strict';
const http = require('http');
const PORT = process.env.PORT || 4101;

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
const db = [];
let nextId = 1;

router.get('/contacts', (p, b, q) => {
  const status = q.status;
  const name = q.name;
  const phone = q.phone;
  const email = q.email;
  const address = q.address;
  const birthday = q.birthday;
  const createdAt = q.createdAt;
  const filtered = db.filter(x => {
    let match = true;
    if (status && x.status !== status) match = false;
    if (name && x.name !== name) match = false;
    if (phone && x.phone !== phone) match = false;
    if (email && x.email !== email) match = false;
    if (address && x.address !== address) match = false;
    if (birthday && x.birthday !== birthday) match = false;
    if (createdAt && x.createdAt !== +createdAt) match = false;
    return match;
  });
  return filtered;
});

router.post('/contacts', (p, body) => {
  if (!body.contactManagementForName) return [400, { error: 'name required' }];
  const contact = {
    id: nextId++,
    name: body.contactManagementForName,
    phone: body.phone || '',
    email: body.email || '',
    address: body.address || '',
    birthday: body.birthday || '',
    createdAt: Date.now()
  };
  db.push(contact);
  return [201, contact];
});

router.get('/contacts/:id', (p) => {
  const contact = db.find(x => x.id === +p.id);
  return contact || [404, { error: 'not found' }];
});

router.put('/contacts/:id', (p, body) => {
  const contact = db.find(x => x.id === +p.id);
  if (!contact) return [404, { error: 'not found' }];
  Object.assign(contact, body);
  return contact;
});

router.delete('/contacts/:id', (p) => {
  const i = db.findIndex(x => x.id === +p.id);
  if (i === -1) return [404, { error: 'not found' }];
  db.splice(i, 1);
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
