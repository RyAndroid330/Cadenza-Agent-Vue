// pipelines/service-pipeline.js — Full codegen → deploy → test → fix loop for one service
import registry from '../registry/service-registry.js';
import { generateServiceCode, generateTests, diagnoseAndFix } from '../services/llm-brain.js';
import { writeServiceFile, spawnService, killService, waitForHealth, validateServiceCode } from '../services/deployer.js';
import { writeSpec } from '../services/spec-writer.js';
import { runTests } from '../services/test-runner.js';
import { logAgent } from '../logger.js';
import { isCancelled } from '../session.js';
import { fetchServiceSchema } from './helpers.js';
import { extractFeatureFields } from '../services/llm-tests.js';

const MAX_FIX_RETRIES = 15;
export { MAX_FIX_RETRIES };

// Audit a generated frontend's source code for CadenzaUI component API usage.
// Returns an array of failure strings (empty = all good).
async function auditFrontendHTML(port, featureFields) {
  let src = '';
  try {
    const fetch = (await import('node-fetch')).default;
    const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(5000) });
    src = await res.text();
  } catch {
    return ['page did not respond'];
  }

  const failures = [];

  // 1. Must call CadenzaUI.init()
  if (!src.includes('CadenzaUI.init(')) failures.push('missing CadenzaUI.init() call');

  // 2. Must add an Add/Create toolbar button
  if (!src.includes('addToolbarButton(')) failures.push('missing addToolbarButton() — no Add button');

  // 3. Must call renderList with onEdit and onDelete
  if (!src.includes('renderList(')) failures.push('missing CadenzaUI.renderList() call');
  else {
    if (!src.includes('onEdit')) failures.push('renderList missing onEdit handler');
    if (!src.includes('onDelete')) failures.push('renderList missing onDelete handler');
  }

  // 4. Must call renderForm with a FIELDS array
  if (!src.includes('renderForm(')) failures.push('missing CadenzaUI.renderForm() call');

  // 5. Each feature field must appear as a key in the FIELDS array
  for (const field of featureFields) {
    const word = field.split(' ')[0].toLowerCase();
    // key: 'word' or key:"word" anywhere in source
    const keyPattern = new RegExp(`key\\s*:\\s*['"]${word}`, 'i');
    // also accept the field label appearing in the FIELDS array definition
    const labelPattern = new RegExp(`label\\s*:\\s*['"][^'"]*${word}[^'"]*['"]`, 'i');
    if (!keyPattern.test(src) && !labelPattern.test(src)) {
      failures.push(`FIELDS missing entry for "${field}"`);
    }
  }

  return failures;
}

export async function runServicePipeline(svc, groupContext) {
  // For backend services: fetch live schema from DB so LLM knows exact field names
  const dbSvc = groupContext.find(c => c.type === 'db');
  if (svc.type === 'backend' && dbSvc && !dbSvc.schema?.length) {
    const dbSchema = await fetchServiceSchema(dbSvc.port);
    if (dbSchema?.length) dbSvc.schema = dbSchema;
  }

  const contextLines = groupContext.map(c => {
    let line = `- ${c.type} "${c.name}" at http://localhost:${c.port}`;
    if (c.schema?.length) line += `\n  Routes: ${c.schema.join(', ')}`;
    return line;
  });
  const contextHint = contextLines.length ? `\n\nAlready deployed in this group:\n${contextLines.join('\n')}` : '';
  const backendSvc = groupContext.find(c => c.type === 'backend');
  const backendPort = backendSvc?.port || null;
  const T = svc.type.toUpperCase();

  // ── Codegen ────────────────────────────────────────────────────────────────
  logAgent({ type: 'code', message: `[${T}] Generating "${svc.name}"${groupContext.length ? ` (with context from ${groupContext.length} prior service(s))` : ''}...` });
  svc.status = 'generating';
  await registry.registerService(svc);

  let code;
  try {
    code = await generateServiceCode(svc, svc._plan, backendPort, contextHint);
  } catch (e) {
    logAgent({ type: 'error', message: `[${T}] Codegen failed: ${e.message}` });
    await registry.updateService(svc.id, { status: 'error' });
    return null;
  }
  if (isCancelled()) return null;
  const minLines = svc.type === 'frontend' ? 10 : 5;
  if (!code || code.split('\n').length < minLines) {
    logAgent({ type: 'error', message: `[${T}] LLM returned truncated code for "${svc.name}" (${code?.split('\n').length ?? 0} lines, need ≥${minLines})` });
    await registry.updateService(svc.id, { status: 'error' });
    return null;
  }

  // Strip forbidden require()s
  if (svc.type !== 'frontend') {
    let forbidden = validateServiceCode(code);
    for (let i = 0; forbidden.length > 0 && i < 3; i++) {
      logAgent({ type: 'fix', message: `[${T}] Removing forbidden require(s): [${forbidden.join(', ')}] (attempt ${i+1}/3)` });
      try { code = await diagnoseAndFix(svc, code, [{ name: 'package-check', error: `Used forbidden require() calls: ${forbidden.join(', ')}` }], svc._plan); } catch { break; }
      forbidden = validateServiceCode(code);
    }
    if (validateServiceCode(code).length > 0) {
      logAgent({ type: 'error', message: `[${T}] "${svc.name}" still uses forbidden packages — aborting` });
      await registry.updateService(svc.id, { status: 'error' });
      return null;
    }
  }

  svc.code = code;
  svc._routeCode = code;
  logAgent({ type: 'code', message: `[${T}] "${svc.name}" — ${code.split('\n').length} lines, writing to disk...` });

  // ── Deploy ─────────────────────────────────────────────────────────────────
  svc.port = registry.allocatePort();
  svc.filePath = writeServiceFile(svc, code);
  svc.status = 'deploying';
  await registry.updateService(svc.id, { filePath: svc.filePath, port: svc.port, status: 'deploying' });

  svc.proc = spawnService(svc);
  logAgent({ type: 'deploy', message: `[${T}] "${svc.name}" spawned on :${svc.port} (pid ${svc.proc?.pid || '?'}) — waiting for /health...` });

  if (isCancelled()) { killService(svc); return null; }
  const healthy = await waitForHealth(svc, 8000);
  if (!healthy) {
    await new Promise(r => setTimeout(r, 300));
    if (svc._lastCrash) logAgent({ type: 'error', message: `[${T}] "${svc.name}" crashed:\n${svc._lastCrash.slice(0, 300)}` });
    else logAgent({ type: 'deploy', message: `[${T}] "${svc.name}" /health timed out — continuing to tests` });
  } else {
    logAgent({ type: 'deploy', message: `[${T}] "${svc.name}" is up at http://localhost:${svc.port}` });
    if (svc.type !== 'frontend') {
      const schema = await fetchServiceSchema(svc.port);
      if (schema?.length) { svc.schema = schema; logAgent({ type: 'deploy', message: `[${T}] "${svc.name}" exposes: ${schema.join(' | ')}` }); }
    }
  }
  await registry.updateService(svc.id, { status: 'running', port: svc.port });

  if (svc.type === 'frontend') {
    const featureFields = extractFeatureFields(svc._plan?.description, svc.description);
    const failures = await auditFrontendHTML(svc.port, featureFields);

    if (failures.length) {
      logAgent({ type: 'fix', message: `[FRONTEND] "${svc.name}" UI audit failed (${failures.length} issue(s)):\n${failures.map(f => `  ✗ ${f}`).join('\n')}` });
      // Bake failures into description so every regen attempt knows exactly what's required
      svc.description = `${svc.description}. REQUIRED but missing: ${failures.join('; ')}`;

      let fixRetries = 0;
      let remaining = failures;
      while (remaining.length > 0 && fixRetries < MAX_FIX_RETRIES) {
        if (isCancelled()) return null;
        fixRetries++;
        logAgent({ type: 'fix', message: `[FRONTEND] Regen ${fixRetries}/${MAX_FIX_RETRIES} — fixing: ${remaining.join(', ')}` });
        let newCode;
        try { newCode = await generateServiceCode(svc, svc._plan, backendPort, contextHint); } catch { break; }
        if (!newCode || newCode.split('\n').length < 30) continue;
        svc.code = newCode;
        writeServiceFile(svc, newCode);
        killService(svc);
        svc.proc = spawnService(svc);
        await waitForHealth(svc, 6000);
        remaining = await auditFrontendHTML(svc.port, featureFields);
      }

      if (remaining.length === 0) {
        logAgent({ type: 'done', message: `[FRONTEND] "${svc.name}" verified at http://localhost:${svc.port}` });
      } else {
        logAgent({ type: 'error', message: `[FRONTEND] "${svc.name}" still failing after ${fixRetries} attempts:\n${remaining.map(f => `  ✗ ${f}`).join('\n')}` });
      }
    } else {
      logAgent({ type: 'done', message: `[FRONTEND] "${svc.name}" verified at http://localhost:${svc.port}` });
    }
    await registry.updateService(svc.id, { status: 'verified' });
    return svc;
  }

  // ── Tests + fix loop ───────────────────────────────────────────────────────
  logAgent({ type: 'test', message: `[${T}] Writing test cases for "${svc.name}"...` });
  let tests = [];
  try { tests = await generateTests(svc, svc._plan); } catch (e) { logAgent({ type: 'error', message: `[${T}] Test gen failed: ${e.message}` }); }

  if (!tests.length) {
    logAgent({ type: 'test', message: `[${T}] No tests — marking verified` });
    await registry.updateService(svc.id, { status: 'verified' });
    return svc;
  }

  logAgent({ type: 'test', message: `[${T}] Running ${tests.length} tests against "${svc.name}" on :${svc.port}...` });
  let { passed, failed } = await runTests(svc, tests);
  if (svc._lastCrash) { failed = [{ name: 'startup-crash', error: svc._lastCrash }, ...failed]; svc._lastCrash = null; }

  logTestResult(T, svc.name, tests.length, passed, failed);

  let fixRetries = 0;
  const fixHistory = [];
  let currentRouteCode = svc._routeCode;

  while (failed.length > 0 && fixRetries < MAX_FIX_RETRIES) {
    if (isCancelled()) return null;
    fixRetries++;
    fixHistory.push({ attempt: fixRetries, failures: failed, code: currentRouteCode });
    logAgent({ type: 'fix', message: `[${T}] Fix ${fixRetries}/${MAX_FIX_RETRIES} for "${svc.name}" — ${failed.length} failure(s) + ${fixRetries-1} prior attempt(s)` });

    let fixedCode;
    try { fixedCode = await diagnoseAndFix(svc, currentRouteCode, failed, svc._plan, fixHistory, contextHint); }
    catch (e) { logAgent({ type: 'error', message: `[${T}] Fix LLM failed: ${e.message}` }); break; }

    if (svc.type !== 'frontend' && validateServiceCode(fixedCode).length > 0) continue;

    currentRouteCode = fixedCode;
    svc._routeCode = fixedCode;
    writeServiceFile(svc, fixedCode);
    logAgent({ type: 'fix', message: `[${T}] New code written — restarting "${svc.name}"...` });
    killService(svc);
    svc.proc = spawnService(svc);
    await registry.updateService(svc.id, { status: 'running' });
    await waitForHealth(svc, 6000);
    await new Promise(r => setTimeout(r, 200));
    ({ passed, failed } = await runTests(svc, tests));
    if (svc._lastCrash) { failed = [{ name: 'startup-crash', error: svc._lastCrash }, ...failed]; svc._lastCrash = null; }
    logTestResult(T, svc.name, tests.length, passed, failed, fixRetries);
  }

  if (failed.length === 0) {
    await registry.updateService(svc.id, { status: 'verified' });
    logAgent({ type: 'done', message: `[${T}] "${svc.name}" verified at http://localhost:${svc.port}` });
    if (svc.type !== 'frontend') writeSpec(svc);
  } else {
    // Check if the service is still alive — if so, mark running (usable but unverified),
    // not error. Only mark error if it's actually down/unresponsive.
    const stillAlive = await waitForHealth(svc, 1500);
    if (stillAlive) {
      await registry.updateService(svc.id, { status: 'running' });
      logAgent({ type: 'deploy', message: `[${T}] "${svc.name}" unverified after ${fixRetries} attempts but still running at http://localhost:${svc.port} — ${failed.length} test(s) failing` });
    } else {
      await registry.updateService(svc.id, { status: 'error' });
      logAgent({ type: 'error', message: `[${T}] "${svc.name}" gave up after ${fixRetries} attempts and is not responding` });
    }
  }
  return svc;
}

function logTestResult(T, name, total, passed, failed, fixNum) {
  if (failed.length === 0) {
    logAgent({ type: 'test', message: `[${T}] "${name}" — all ${passed.length} tests passed${fixNum ? ` after fix ${fixNum}` : ''} ✓` });
  } else {
    logAgent({ type: 'test', message: `[${T}] "${name}"${fixNum ? ` after fix ${fixNum}` : ''}: ${passed.length}/${total} passed, ${failed.length} failed: ${failed.map(f => f.name).join(', ')}` });
    failed.forEach(f => {
      const detail = f.error ? `CRASH: ${f.error.slice(0, 150)}` : `got ${f.status}, expected ${f.expected}${f.body ? ' — ' + f.body.slice(0, 100) : ''}`;
      logAgent({ type: 'error', message: `  ✗ ${f.name}: ${detail}` });
    });
  }
}
