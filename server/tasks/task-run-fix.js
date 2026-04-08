// tasks/task-run-fix.js — Signal-triggered run-tests and fix-code tasks (manual retry path)
import { Task } from '../cadenza-core.js';
import cadenza from '../cadenza-core.js';
import { logAgent } from '../logger.js';
import { runTests } from '../services/test-runner.js';
import { diagnoseAndFix } from '../services/llm-fix.js';
import { writeServiceFile, readServiceFile, spawnService, killService } from '../services/deployer.js';
import registry from '../registry/service-registry.js';

const { userBroker } = cadenza;
const MAX_FIX_RETRIES = 10;

export const runTestsTask = new Task('runTests', async (svc) => {
  const tests = svc._tests;
  if (!tests || tests.length === 0) {
    logAgent({ type: 'test', message: `No cached tests for "${svc.name}" — marking verified` });
    await registry.updateService(svc.id, { status: 'verified' });
    return;
  }
  logAgent({ type: 'test', message: `Running ${tests.length} tests for "${svc.name}"...` });
  const { passed, failed } = await runTests(svc, tests);
  logAgent({ type: 'test', message: `"${svc.name}": ${passed.length} passed, ${failed.length} failed` });

  if (failed.length === 0) {
    await registry.updateService(svc.id, { status: 'verified' });
    logAgent({ type: 'test', message: `"${svc.name}" verified!` });
  } else {
    await registry.updateService(svc.id, { status: 'degraded' });
    userBroker.emit('fix_code', { svc, failedTests: failed });
  }
});
runTestsTask.doOn('run_tests');

export const fixCodeTask = new Task('fixCode', async ({ svc, failedTests }) => {
  svc._fixRetries = (svc._fixRetries || 0) + 1;
  if (svc._fixRetries > MAX_FIX_RETRIES) {
    logAgent({ type: 'error', message: `Max retries (${MAX_FIX_RETRIES}) for "${svc.name}" — giving up` });
    await registry.updateService(svc.id, { status: 'error' });
    return;
  }
  logAgent({ type: 'fix', message: `Fix attempt ${svc._fixRetries}/${MAX_FIX_RETRIES} for "${svc.name}"` });

  const currentCode = svc._routeCode || readServiceFile(svc.filePath);
  let fixedCode;
  try {
    fixedCode = await diagnoseAndFix(svc, currentCode, failedTests, svc._plan);
  } catch (e) {
    logAgent({ type: 'error', message: `Fix LLM failed for "${svc.name}": ${e.message}` });
    return;
  }

  svc._routeCode = fixedCode;
  writeServiceFile(svc, fixedCode);
  logAgent({ type: 'fix', message: `Fixed code written for "${svc.name}"` });
  killService(svc);
  svc.proc = spawnService(svc);
  await registry.updateService(svc.id, { status: 'running' });
  setTimeout(() => userBroker.emit('run_tests', svc), 2000);
});
fixCodeTask.doOn('fix_code');
