// self-modifier.js — Agent self-modification: snapshot → patch → test → commit | rollback
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import { planSelfModification, generateSelfModification } from './llm-fix.js';
import { logAgent } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.join(__dirname, '..');
const PROJECT_ROOT = path.join(SERVER_DIR, '..');
const SNAPSHOTS_DIR = path.join(SERVER_DIR, 'backups', 'snapshots');
const TEST_PORT = 3099;

// Files the agent is allowed to modify
const MODIFIABLE_FILES = {
  // Backend — require restart after change
  'cadenza-core.js':        { path: 'server/cadenza-core.js',                         restart: true  },
  'agent-graph.js':         { path: 'server/agent-graph.js',                          restart: true  },
  'session.js':             { path: 'server/session.js',                              restart: true  },
  'llm-brain.js':           { path: 'server/services/llm-brain.js',                  restart: true  },
  'llm-caller.js':          { path: 'server/services/llm-caller.js',                 restart: true  },
  'llm-intent.js':          { path: 'server/services/llm-intent.js',                 restart: true  },
  'llm-codegen.js':         { path: 'server/services/llm-codegen.js',                restart: true  },
  'llm-tests.js':           { path: 'server/services/llm-tests.js',                  restart: true  },
  'llm-fix.js':             { path: 'server/services/llm-fix.js',                    restart: true  },
  'deployer.js':            { path: 'server/services/deployer.js',                   restart: true  },
  'test-runner.js':         { path: 'server/services/test-runner.js',                restart: true  },
  'self-modifier.js':       { path: 'server/services/self-modifier.js',              restart: true  },
  'spec-writer.js':         { path: 'server/services/spec-writer.js',                restart: true  },
  'service-registry.js':    { path: 'server/registry/service-registry.js',          restart: true  },
  'model-stats.js':         { path: 'server/registry/model-stats.js',                restart: true  },
  'helpers.js':             { path: 'server/pipelines/helpers.js',                   restart: true  },
  'service-pipeline.js':    { path: 'server/pipelines/service-pipeline.js',          restart: true  },
  'modify-pipeline.js':     { path: 'server/pipelines/modify-pipeline.js',           restart: true  },
  'task-interpret.js':      { path: 'server/tasks/task-interpret.js',                restart: true  },
  'task-dispatch.js':       { path: 'server/tasks/task-dispatch.js',                 restart: true  },
  'task-retry.js':          { path: 'server/tasks/task-retry.js',                    restart: true  },
  'task-manage.js':         { path: 'server/tasks/task-manage.js',                   restart: true  },
  'task-run-fix.js':        { path: 'server/tasks/task-run-fix.js',                  restart: true  },
  // Frontend — hot-reloaded by Nuxt
  'TabServices.vue':       { path: 'components/tabs/TabServices.vue',      restart: false },
  'TabLogs.vue':           { path: 'components/tabs/TabLogs.vue',          restart: false },
  'TabStats.vue':          { path: 'components/tabs/TabStats.vue',         restart: false },
  'TabMap.vue':            { path: 'components/tabs/TabMap.vue',           restart: false },
  'TabCadenzaDB.vue':      { path: 'components/tabs/TabCadenzaDB.vue',     restart: false },
  'AgentChat.vue':         { path: 'components/AgentChat.vue',             restart: false },
  'app.vue':               { path: 'app/app.vue',                          restart: false },
  'useAgent.ts':           { path: 'composables/useAgent.ts',              restart: false },
  'useLogs.ts':            { path: 'composables/useLogs.ts',               restart: false },
  'useServices.ts':        { path: 'composables/useServices.ts',           restart: false },
  'style.css':             { path: 'public/style.css',                     restart: false },
};

export function listModifiableFiles() {
  return Object.entries(MODIFIABLE_FILES).map(([name, meta]) => `${name} (${meta.path})`);
}

// ── Snapshot: save a complete set of file contents before patching ─────────────
function createSnapshot(files) {
  const id = `snap_${Date.now()}`;
  const dir = path.join(SNAPSHOTS_DIR, id);
  fs.mkdirSync(dir, { recursive: true });

  const manifest = {};
  for (const [fileName, meta] of Object.entries(files)) {
    const src = path.join(PROJECT_ROOT, meta.path);
    const dest = path.join(dir, fileName);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      manifest[fileName] = { src, dest };
    }
  }

  const manifestPath = path.join(dir, '_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  logAgent({ type: 'fix', message: `[Self] Snapshot created: ${id} (${Object.keys(manifest).length} file(s))` });
  return { id, dir, manifest };
}

// ── Rollback: restore all files from a snapshot ────────────────────────────────
function rollback(snapshot) {
  let restored = 0;
  for (const [fileName, { src, dest }] of Object.entries(snapshot.manifest)) {
    try {
      fs.copyFileSync(dest, src);
      restored++;
    } catch (e) {
      logAgent({ type: 'error', message: `[Self] Could not restore ${fileName}: ${e.message}` });
    }
  }
  logAgent({ type: 'fix', message: `[Self] Rollback complete — restored ${restored} file(s) from snapshot ${snapshot.id}` });
}

// ── Syntax check a single file via node --check ────────────────────────────────
function syntaxCheck(filePath) {
  const ext = path.extname(filePath);
  if (!['.js', '.cjs', '.mjs'].includes(ext)) return { ok: true };
  try {
    const tmp = path.join(SNAPSHOTS_DIR, `_chk_${Date.now()}.cjs`);
    // Strip ESM syntax for checker (wrap in try, only checks CJS-compatible syntax)
    const code = fs.readFileSync(filePath, 'utf-8');
    // For ESM files, use a temp .mjs file instead
    const tmpMjs = tmp.replace('.cjs', '.mjs');
    fs.writeFileSync(tmpMjs, code);
    execSync(`node --input-type=module --eval "import(${JSON.stringify('file:///' + tmpMjs.replace(/\\/g, '/'))})" 2>&1`, {
      stdio: 'pipe', timeout: 8000
    });
    try { fs.unlinkSync(tmpMjs); } catch {}
    return { ok: true };
  } catch (e) {
    const msg = e.stderr?.toString() || e.stdout?.toString() || e.message || '';
    return { ok: false, error: msg.slice(0, 400) };
  }
}

// ── Smoke test: spawn a test instance of the server and hit /health ────────────
async function smokeTest() {
  return new Promise((resolve) => {
    const proc = spawn('node', [path.join(SERVER_DIR, 'index.js')], {
      env: { ...process.env, PORT: String(TEST_PORT), CADENZA_SMOKE_TEST: '1' },
      stdio: 'pipe',
      detached: false
    });

    const timeout = setTimeout(() => {
      try { proc.kill(); } catch {}
      resolve({ ok: false, error: 'Smoke test server timed out after 12s' });
    }, 12000);

    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });

    // Poll /health
    const check = async () => {
      try {
        const { default: fetch } = await import('node-fetch');
        const res = await fetch(`http://localhost:${TEST_PORT}/api/logs`, {
          signal: AbortSignal.timeout(1000)
        });
        // If it responds at all the server started OK
        if (res.status < 500) {
          clearTimeout(timeout);
          try { proc.kill(); } catch {}
          resolve({ ok: true });
          return;
        }
      } catch {}
      setTimeout(check, 800);
    };

    // Give it 1.5s to start then begin polling
    setTimeout(check, 1500);

    proc.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        resolve({ ok: false, error: `Server exited with code ${code}. stderr: ${stderr.slice(0, 300)}` });
      }
    });
  });
}

// ── Main: plan → generate → snapshot → syntax check → smoke test → commit | rollback ─
export async function applySelfModification(message) {
  const fileList = listModifiableFiles();
  logAgent({ type: 'fix', message: `[Self] Planning modification: "${message}"` });

  const modPlan = await planSelfModification(message, fileList);
  const filesToModify = (modPlan.files || []).filter(f => MODIFIABLE_FILES[f]);
  if (filesToModify.length === 0) throw new Error('No modifiable files identified in plan');

  logAgent({ type: 'fix', message: `[Self] Will modify: ${filesToModify.join(', ')}` });

  // Read current contents
  const fileContents = {};
  const fileMetas = {};
  for (const fileName of filesToModify) {
    const meta = MODIFIABLE_FILES[fileName];
    fileMetas[fileName] = meta;
    const filePath = path.join(PROJECT_ROOT, meta.path);
    fileContents[fileName] = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  }

  // Generate new content
  logAgent({ type: 'fix', message: `[Self] Generating modified code...` });
  const result = await generateSelfModification(modPlan, fileContents);
  const newFiles = result.files || {};

  if (Object.keys(newFiles).length === 0) throw new Error('LLM returned no file changes');

  // Take snapshot BEFORE writing anything
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const snapshot = createSnapshot(fileMetas);

  // Write all modified files
  for (const [fileName, newCode] of Object.entries(newFiles)) {
    const meta = MODIFIABLE_FILES[fileName];
    if (!meta) continue;
    const filePath = path.join(PROJECT_ROOT, meta.path);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, newCode, 'utf-8');
    logAgent({ type: 'fix', message: `[Self] Written: ${meta.path}` });
  }

  // Syntax check all modified JS files
  const needsRestart = Object.keys(newFiles).some(f => MODIFIABLE_FILES[f]?.restart);
  if (needsRestart) {
    logAgent({ type: 'test', message: `[Self] Running syntax checks...` });
    for (const [fileName, newCode] of Object.entries(newFiles)) {
      const meta = MODIFIABLE_FILES[fileName];
      if (!meta?.restart) continue;
      const filePath = path.join(PROJECT_ROOT, meta.path);
      const check = syntaxCheck(filePath);
      if (!check.ok) {
        logAgent({ type: 'error', message: `[Self] Syntax error in ${fileName}: ${check.error}` });
        logAgent({ type: 'fix', message: `[Self] Rolling back all changes...` });
        rollback(snapshot);
        throw new Error(`Syntax check failed for ${fileName} — rolled back`);
      }
      logAgent({ type: 'test', message: `[Self] ${fileName} — syntax OK` });
    }

    // Smoke test the modified server
    logAgent({ type: 'test', message: `[Self] Running smoke test on port ${TEST_PORT}...` });
    const smoke = await smokeTest();
    if (!smoke.ok) {
      logAgent({ type: 'error', message: `[Self] Smoke test failed: ${smoke.error}` });
      logAgent({ type: 'fix', message: `[Self] Rolling back all changes...` });
      rollback(snapshot);
      throw new Error(`Smoke test failed — rolled back. ${smoke.error}`);
    }
    logAgent({ type: 'test', message: `[Self] Smoke test passed ✓` });
  }

  // Committed — clean up old snapshots (keep last 5)
  try {
    const snaps = fs.readdirSync(SNAPSHOTS_DIR)
      .filter(d => d.startsWith('snap_'))
      .sort()
      .slice(0, -5);
    for (const old of snaps) {
      fs.rmSync(path.join(SNAPSHOTS_DIR, old), { recursive: true, force: true });
    }
  } catch {}

  return {
    modified: Object.keys(newFiles),
    needsRestart,
    snapshotId: snapshot.id
  };
}

// ── Rollback to a named snapshot ───────────────────────────────────────────────
export async function rollbackToSnapshot(snapshotId) {
  const dir = path.join(SNAPSHOTS_DIR, snapshotId);
  const manifestPath = path.join(dir, '_manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`Snapshot ${snapshotId} not found`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  rollback({ id: snapshotId, manifest });
  return { ok: true };
}

// ── List available snapshots ───────────────────────────────────────────────────
export function listSnapshots() {
  try {
    return fs.readdirSync(SNAPSHOTS_DIR)
      .filter(d => d.startsWith('snap_'))
      .sort()
      .reverse()
      .map(id => {
        const manifestPath = path.join(SNAPSHOTS_DIR, id, '_manifest.json');
        const files = fs.existsSync(manifestPath)
          ? Object.keys(JSON.parse(fs.readFileSync(manifestPath, 'utf-8')))
          : [];
        const ts = parseInt(id.replace('snap_', ''));
        return { id, files, createdAt: new Date(ts).toISOString() };
      });
  } catch { return []; }
}
