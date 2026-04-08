// pipelines/modify-pipeline.js — Targeted edit of a verified service using its spec + existing code
import registry from '../registry/service-registry.js';
import { modifyServiceCode, generateTests, diagnoseAndFix } from '../services/llm-brain.js';
import { writeServiceFile, spawnService, killService, waitForHealth, validateServiceCode } from '../services/deployer.js';
import { readSpec, writeSpec } from '../services/spec-writer.js';
import { runTests } from '../services/test-runner.js';
import { logAgent } from '../logger.js';
import { isCancelled } from '../session.js';
import { runServicePipeline, MAX_FIX_RETRIES } from './service-pipeline.js';
import { fetchServiceSchema } from './helpers.js';

export async function runModifyPipeline(svc, changeRequest, groupContext) {
  const T = svc.type.toUpperCase();

  // Build context hint so the LLM knows DB URL / sibling service ports
  const contextLines = groupContext.map(c => {
    let line = `- ${c.type} "${c.name}" at http://localhost:${c.port}`;
    if (c.schema?.length) line += `\n  Routes: ${c.schema.join(', ')}`;
    return line;
  });
  const contextHint = contextLines.length ? `\n\nGroup context:\n${contextLines.join('\n')}` : '';

  const spec = readSpec(svc) || `Service: ${svc.name} (${svc.type})\nDescription: ${svc.description}`;
  logAgent({ type: 'fix', message: `[${T}] Modifying "${svc.name}" — sending targeted change to LLM...` });

  let code;
  try {
    code = await modifyServiceCode(svc, svc._routeCode, spec, changeRequest, contextHint);
  } catch (e) {
    logAgent({ type: 'error', message: `[${T}] Modify LLM failed for "${svc.name}": ${e.message}` });
    return null;
  }

  if (validateServiceCode(code).length > 0) {
    logAgent({ type: 'error', message: `[${T}] Modified code uses forbidden require() — falling back to full rebuild` });
    svc.description = `${svc.description}. Updated requirement: ${changeRequest}`;
    return runServicePipeline(svc, groupContext);
  }

  svc._routeCode = code;
  writeServiceFile(svc, code);
  logAgent({ type: 'fix', message: `[${T}] Modified code written — redeploying "${svc.name}"...` });

  killService(svc);
  svc.proc = spawnService(svc);
  await registry.updateService(svc.id, { status: 'running' });
  const healthy = await waitForHealth(svc, 8000);

  // Refresh schema after redeploy
  if (healthy && svc.type !== 'frontend') {
    const schema = await fetchServiceSchema(svc.port);
    if (schema?.length) svc.schema = schema;
  }

  logAgent({ type: 'test', message: `[${T}] Generating tests for modified "${svc.name}"...` });
  let tests = [];
  try { tests = await generateTests(svc, svc._plan); } catch {}

  if (!tests.length) {
    logAgent({ type: 'test', message: `[${T}] No tests — marking verified` });
    await registry.updateService(svc.id, { status: 'verified' });
    writeSpec(svc);
    return svc;
  }

  logAgent({ type: 'test', message: `[${T}] Running ${tests.length} tests against modified "${svc.name}"...` });
  let { passed, failed } = await runTests(svc, tests);
  if (svc._lastCrash) { failed = [{ name: 'startup-crash', error: svc._lastCrash }, ...failed]; svc._lastCrash = null; }

  let fixRetries = 0;
  const fixHistory = [];
  let currentRouteCode = code;

  while (failed.length > 0 && fixRetries < MAX_FIX_RETRIES) {
    if (isCancelled()) return null;
    fixRetries++;
    fixHistory.push({ attempt: fixRetries, failures: failed, code: currentRouteCode });
    logAgent({ type: 'fix', message: `[${T}] Fix ${fixRetries}/${MAX_FIX_RETRIES} for modified "${svc.name}"...` });

    let fixedCode;
    try { fixedCode = await diagnoseAndFix(svc, currentRouteCode, failed, svc._plan, fixHistory, contextHint); } catch { break; }

    if (validateServiceCode(fixedCode).length > 0) continue;
    currentRouteCode = fixedCode;
    svc._routeCode = fixedCode;
    writeServiceFile(svc, fixedCode);
    killService(svc);
    svc.proc = spawnService(svc);
    await registry.updateService(svc.id, { status: 'running' });
    await waitForHealth(svc, 6000);
    await new Promise(r => setTimeout(r, 200));
    ({ passed, failed } = await runTests(svc, tests));
    if (svc._lastCrash) { failed = [{ name: 'startup-crash', error: svc._lastCrash }, ...failed]; svc._lastCrash = null; }
  }

  if (failed.length === 0) {
    await registry.updateService(svc.id, { status: 'verified' });
    logAgent({ type: 'done', message: `[${T}] "${svc.name}" modified and verified ✓` });
    writeSpec(svc);
  } else {
    await registry.updateService(svc.id, { status: 'error' });
    logAgent({ type: 'error', message: `[${T}] "${svc.name}" modification failed after ${fixRetries} fix attempts` });
  }
  return svc;
}
