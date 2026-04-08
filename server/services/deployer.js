// deployer.js — Write generated code to disk and spawn processes
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import { UI_LIB_JS } from './frontend-template.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const DEPLOYED_DIR = path.join(PROJECT_ROOT, 'deployed');

// Inline frontend server script — serves a single HTML file on the given port
function frontendServerScript(htmlPath, port) {
  return `const http = require('http');
const fs = require('fs');
const port = process.env.PORT || ${port};
const file = ${JSON.stringify(htmlPath)};
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/health') { res.writeHead(200); return res.end(JSON.stringify({ok:true})); }
  try {
    const html = fs.readFileSync(file, 'utf-8');
    res.writeHead(200, {'Content-Type':'text/html'});
    res.end(html);
  } catch(e) {
    res.writeHead(500); res.end('Error: ' + e.message);
  }
});
server.listen(port, () => console.log('Frontend server listening on port ' + port));
`;
}

// ── Server scaffold ───────────────────────────────────────────────────────────
// We write the HTTP infrastructure; LLM only fills in data + router.X() calls.
// Handler signature: (params, body, query) => data | [statusCode, data]
function serverScaffold(port, llmCode) {
  return `'use strict';
const http = require('http');
const PORT = process.env.PORT || ${port};

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
    const re = new RegExp('^' + r.pattern.replace(/:([^/]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '\\/?$');
    const m = pathname.match(re);
    if (m) return { fn: r.fn, params: Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

// Built-in health route (always available)
router.get('/health', () => ({ ok: true }));
router.get('/schema', () => ({ routes: _routes.map(r => ({ method: r.method, path: r.pattern })) }));

// ── LLM-generated data and routes ────────────────────────────────────────────
${llmCode}
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
`;
}

// Ensure deployed dir and its package.json (type: commonjs for deployed .cjs files)
function ensureDeployedDir() {
  if (!fs.existsSync(DEPLOYED_DIR)) fs.mkdirSync(DEPLOYED_DIR, { recursive: true });
  const pkgPath = path.join(DEPLOYED_DIR, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    fs.writeFileSync(pkgPath, JSON.stringify({ name: 'cadenza-deployed', version: '1.0.0', type: 'commonjs' }, null, 2));
  }
}

export function writeServiceFile(service, code) {
  ensureDeployedDir();
  const safeName = (service.name || service.id).replace(/\s+/g, '_').toLowerCase();
  const ext = service.type === 'frontend' ? '.html' : '.cjs';
  const filePath = path.join(DEPLOYED_DIR, `${safeName}_${service.id}${ext}`);
  // For backend/db: wrap LLM code in the scaffold — LLM only provides data + routes
  // For frontend: inject CadenzaUI component library before </body>
  let content;
  if (service.type !== 'frontend') {
    content = serverScaffold(service.port, code);
  } else {
    const lib = `<script>${UI_LIB_JS}</script>`;
    content = code.includes('</body>')
      ? code.replace('</body>', `${lib}\n</body>`)
      : code + '\n' + lib;
  }
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

export function readServiceFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8'); } catch { return ''; }
}

export function freePort(port) {
  try {
    if (process.platform === 'win32') {
      const result = execSync(`netstat -ano | findstr :${port}`, { stdio: 'pipe' }).toString();
      const lines = result.split('\n').filter(l => l.includes('LISTENING'));
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') {
          try { execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe' }); } catch {}
        }
      }
    } else {
      execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { stdio: 'pipe' });
    }
  } catch {}
}

// LLM-generated route code must not contain any require() — the scaffold provides everything
export function validateServiceCode(code) {
  const forbidden = [];
  const matches = code.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
  for (const m of matches) {
    forbidden.push(m[1]);
  }
  return forbidden; // empty = valid
}

export function spawnService(service) {
  if (!service.filePath) return null;
  try {
    freePort(service.port);

    let scriptPath = service.filePath;

    // For frontend: write a tiny static server script alongside the HTML file
    if (service.type === 'frontend') {
      scriptPath = service.filePath.replace(/\.html$/, '_server.cjs');
      fs.writeFileSync(scriptPath, frontendServerScript(service.filePath, service.port));
    }

    // Capture stderr so startup crashes are available for the fix loop
    const proc = spawn('node', [scriptPath], {
      stdio: ['inherit', 'inherit', 'pipe'],
      env: { ...process.env, PORT: String(service.port) }
    });

    const stderrChunks = [];
    proc.stderr.on('data', d => stderrChunks.push(d.toString()));
    proc.on('exit', (code) => {
      console.log(`[Deployer] Process ${service.name} exited with code ${code}`);
      // Attach last crash output to service so fix loop can use it
      if (code !== 0 && stderrChunks.length) {
        service._lastCrash = stderrChunks.join('').slice(0, 800);
      }
    });
    return proc;
  } catch (e) {
    console.error('[Deployer] Spawn failed:', e.message);
    return null;
  }
}

export function killService(service) {
  if (service.proc) {
    try { service.proc.kill(); } catch {}
    service.proc = null;
  }
}

// Wait for a service to respond on its port (health check)
export async function waitForHealth(service, timeoutMs = 10000) {
  const fetch = (await import('node-fetch')).default;
  const url = `http://localhost:${service.port}/health`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}
