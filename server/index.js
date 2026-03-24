// Cadenza-Agent backend (Express) for Nuxt integration
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const { EventEmitter } = require('events');
const { load, save } = require('./storage');
// Use unified agent service
const agent = require('./cadenza/service/agent');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3010;

app.use(cors());
app.use(express.json());

// In-memory agent state (delegated to agent module)
const logEmitter = new EventEmitter();

// SSE log stream
app.get('/api/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  agent.logs.forEach(entry => res.write(`data: ${JSON.stringify(entry)}\n\n`));
  const onLog = entry => res.write(`data: ${JSON.stringify(entry)}\n\n`);
  logEmitter.on('log', onLog);
  req.on('close', () => logEmitter.off('log', onLog));
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'No message' });
  try {
    await agent.handleUserRequest(message);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Services endpoints
app.get('/api/services', (req, res) => {
  res.json(agent.registry.all());
});
app.post('/api/services', (req, res) => {
  const svc = req.body;
  agent.registry.add(svc);
  res.status(201).json(svc);
});
app.patch('/api/services/:id', (req, res) => {
  agent.registry.update(req.params.id, req.body);
  res.json(agent.registry.get(req.params.id) || {});
});
app.delete('/api/services/:id', (req, res) => {
  agent.registry.remove(req.params.id);
  res.json({ ok: true, id: req.params.id });
});

// Plans endpoints
app.get('/api/plans', (req, res) => {
  res.json(agent.plans);
});
app.post('/api/plans', (req, res) => {
  const plan = req.body;
  agent.plans.push(plan);
  res.status(201).json(plan);
});

// Graph endpoint
app.get('/api/graph', (req, res) => {
  // Populate with mock data based on current plans/services
  const nodes = [];
  const edges = [];
  agent.plans.forEach(plan => {
    nodes.push({ id: plan.groupId, label: plan.description, type: 'plan' });
    plan.services.forEach(svc => {
      nodes.push({ id: svc.id, label: svc.name, type: svc.type });
      edges.push({ from: plan.groupId, to: svc.id });
    });
  });
  res.json({ nodes, edges });
});

// Model stats endpoint
app.get('/api/model-stats', (req, res) => {
  // Return mock stats
  res.json([
    { model: 'gpt-oss-120b', frontend: { score: 0.9, successes: 10, failures: 1, avgMs: 120 }, backend: { score: 0.8, successes: 8, failures: 2, avgMs: 150 }, db: { score: 0.85, successes: 9, failures: 1, avgMs: 100 }, test: { score: 0.95, successes: 12, failures: 0, avgMs: 80 }, fix: { score: 0.7, successes: 3, failures: 1, avgMs: 200 }, plan: { score: 0.92, successes: 11, failures: 1, avgMs: 110 } }
  ]);
});

// Retry endpoint
app.post('/api/retry/:serviceId', (req, res) => {
  const { serviceId } = req.params;
  const svc = agent.registry.get(serviceId);
  if (!svc) return res.status(404).json({ error: 'Service not found' });
  svc.status = 'running';
  svc.retries = (svc.retries || 0) + 1;
  const retryLog = { ts: Date.now(), type: 'fix', message: `Manual retry for ${svc.name}` };
  agent.logs.push(retryLog);
  logEmitter.emit('log', retryLog);
  simulateServiceLifecycle(svc);
  res.json({ ok: true, serviceId });
});

// CadenzaDB health endpoint
app.get('/api/db/health', (req, res) => {
  res.json({ status: 'ok', services: agent.registry.all().length, plans: agent.plans.length, logs: agent.logs.length, ts: Date.now() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Cadenza-Agent backend running on http://localhost:${PORT}`);
});

// Enhance service deployment simulation
function simulateServiceLifecycle(serviceObj) {
  // Simulate test run after deployment
  setTimeout(() => {
    const pass = Math.random() > 0.2;
    serviceObj.status = pass ? 'verified' : 'degraded';
    serviceObj.testResults = {
      passed: pass ? ['health', 'basic'] : ['health'],
      failed: pass ? [] : ['basic'],
      total: 2
    };
    const testLog = { ts: Date.now(), type: 'test', message: `Test ${pass ? 'passed' : 'failed'} for ${serviceObj.name}` };
    logs.push(testLog);
    logEmitter.emit('log', testLog);
    if (!pass) {
      const fixLog = { ts: Date.now(), type: 'fix', message: `Auto-fix attempted for ${serviceObj.name}` };
      logs.push(fixLog);
      logEmitter.emit('log', fixLog);
      // Simulate fix
      setTimeout(() => {
        serviceObj.status = 'verified';
        serviceObj.retries += 1;
        const fixPassLog = { ts: Date.now(), type: 'fix', message: `Auto-fix succeeded for ${serviceObj.name}` };
        logs.push(fixPassLog);
        logEmitter.emit('log', fixPassLog);
      }, 1000);
    }
  }, 1200);
}
