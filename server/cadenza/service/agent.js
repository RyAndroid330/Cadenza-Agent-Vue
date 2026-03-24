// Core agent workflow: planning, codegen, deploy, test, fix, meta-layer
const { signalBus, SIGNALS } = require('./signals');
const { registerAgentTasks } = require('./task-graph');
const { callGroq } = require('../../llm-groq');
const { generateServiceCode, writeServiceFile } = require('../../codegen');

const { spawn } = require('child_process');
const path = require('path');
const registry = require('./registry');


const { load, save } = require('../../storage');
const PLANS_KEY = 'plans';
const plans = load(PLANS_KEY, []);
const logs = [];

// Register meta-layer tasks
registerAgentTasks({
  deployServices,
  runServiceTests,
  fixService,
  finishGroup
});

// Step 1: Plan
async function handleUserRequest(message) {
  logs.push({ ts: Date.now(), type: 'user', message });
  signalBus.emit(SIGNALS.REQUEST_RECEIVED, message);
  // Plan
  let planText, cleanPlan, plan;
  try {
    planText = await callGroq([
      { role: 'system', content: 'You are an AI agent that deploys web services. The user says: "{user_message}". Analyze and return ONLY a valid JSON deployment plan, with NO explanation, markdown, or preamble. Schema: { "groupId": "short_id", "description": "desc", "services": [ { "type": "frontend|backend|db", "name": "name", "description": "desc" } ] }.' },
      { role: 'user', content: message }
    ], 512, 'plan');
    cleanPlan = planText.replace(/```json|```/g, '').trim();
    try {
      plan = JSON.parse(cleanPlan);
    } catch (e) {
      // Try to extract JSON substring if LLM added preamble
      const match = cleanPlan.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          plan = JSON.parse(match[0]);
        } catch (e2) {
          throw e;
        }
      } else {
        throw e;
      }
    }
  } catch (e) {
    logs.push({ ts: Date.now(), type: 'error', message: `Plan LLM output error: ${e.message}. Raw: ${planText || ''}` });
    throw new Error('The LLM did not return valid JSON for the deployment plan. Please try rephrasing your request or try again.');
  }
  plan.id = `plan_${Date.now()}`;
  plan.createdAt = Date.now();
  plans.push(plan);
  save(PLANS_KEY, plans);
  logs.push({ ts: Date.now(), type: 'plan', message: `Created plan: ${plan.description}` });
  signalBus.emit(SIGNALS.PLAN_READY, plan);
}

// Step 2: Deploy services (codegen + spawn)
async function deployServices(plan) {
  for (const svc of plan.services) {
    // Assign unique id if missing
    if (!svc.id) svc.id = `${svc.type}_${svc.name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`;
    logs.push({ ts: Date.now(), type: 'code', message: `Generating code for ${svc.type} (${svc.name})...` });
    const code = await generateServiceCode(svc, plan);
    // Basic validation: skip if code is empty or clearly invalid
    if (!code || code.trim().length < 10 || code.includes('```')) {
      logs.push({ ts: Date.now(), type: 'error', message: `Codegen failed for ${svc.name}: empty or invalid code.` });
      continue;
    }
    const filePath = writeServiceFile(svc, code);
    svc.filePath = filePath;
    logs.push({ ts: Date.now(), type: 'code', message: `Wrote code for ${svc.type} (${svc.name}) to ${filePath}` });
    // Assign dynamic port
    svc.port = 4100 + registry.all().length;
    // Spawn process (backend/db only)
    if (svc.type !== 'frontend') {
      const proc = spawn('node', [filePath], { stdio: 'inherit' });
      svc.proc = proc;
      logs.push({ ts: Date.now(), type: 'deploy', message: `Spawned ${svc.type} (${svc.name}) on port ${svc.port}` });
    }
    registry.add(svc);
    signalBus.emit(SIGNALS.SERVICE_DEPLOY, svc);
  }
}

// Step 3: Run tests (stub)
const { runTests } = require('./test-runner');
const { generateTests } = require('./llm-tests');
async function runServiceTests(service) {
  logs.push({ ts: Date.now(), type: 'test', message: `Generating tests for ${service.name}...` });
  const plan = plans.find(p => p.services && p.services.some(s => s.name === service.name));
  const testCases = await generateTests(service, plan);
  logs.push({ ts: Date.now(), type: 'test', message: `Running ${testCases.length} tests for ${service.name}...` });
  let passed = [], failed = [];
  for (const test of testCases) {
    try {
      // Only support GET/POST for now
      const url = `http://localhost:${service.port}${test.path}`;
      let res;
      if (test.method === 'GET') {
        res = await require('node-fetch')(url);
      } else if (test.method === 'POST') {
        res = await require('node-fetch')(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(test.body || {}) });
      } else {
        continue; // skip unsupported
      }
      const body = await res.text();
      const statusOk = res.status === test.expectStatus;
      const bodyOk = !test.expectBodyContains || (body && body.includes(test.expectBodyContains));
      if (statusOk && bodyOk) {
        passed.push(test.name);
      } else {
        failed.push(test.name);
      }
    } catch {
      failed.push(test.name);
    }
  }
  logs.push({ ts: Date.now(), type: 'test', message: `Test results for ${service.name}: passed=${passed.length}, failed=${failed.length}` });
  if (failed.length === 0) {
    signalBus.emit(SIGNALS.SERVICE_VERIFIED, service);
  } else {
    signalBus.emit(SIGNALS.SERVICE_FIX_NEEDED, { service, failedTests: failed });
  }
}

// Step 4: Fix service (stub)
const { fixServiceCode } = require('./fixer');
const fs = require('fs');
async function fixService(service, failedTests) {
  logs.push({ ts: Date.now(), type: 'fix', message: `Auto-fix attempted for ${service.name}` });
  // Read the current code
  const plan = plans.find(p => p.services && p.services.some(s => s.name === service.name));
  const filePath = service.filePath || (service.name && `./deployed/${service.name.replace(/\s+/g, '_').toLowerCase()}_${service.id || ''}.js`);
  let code = '';
  try {
    code = fs.readFileSync(filePath, 'utf-8');
  } catch {}
  // Use LLM to fix code
  const fixedCode = await fixServiceCode(service, code, failedTests, plan);
  // Write fixed code back
  fs.writeFileSync(filePath, fixedCode);
  logs.push({ ts: Date.now(), type: 'fix', message: `Wrote fixed code for ${service.name}` });
  // Restart process if needed
  if (service.proc && service.proc.kill) {
    service.proc.kill();
    logs.push({ ts: Date.now(), type: 'fix', message: `Restarted process for ${service.name}` });
  }
  // Respawn process (backend/db only)
  if (service.type !== 'frontend') {
    const { spawn } = require('child_process');
    const proc = spawn('node', [filePath], { stdio: 'inherit' });
    service.proc = proc;
  }
  // Retest
  await runServiceTests(service);
}

// Step 5: Finish group (stub)
function finishGroup(groupId) {
  logs.push({ ts: Date.now(), type: 'done', message: `Group ${groupId} complete!` });
}

module.exports = { handleUserRequest, plans, logs, registry };
