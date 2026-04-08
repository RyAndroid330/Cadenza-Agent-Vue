// test-runner.js — Run generated HTTP tests against a live service
import fetch from 'node-fetch';

// Replace {{key}} placeholders in a string using the saved values map
function interpolate(str, saved) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => saved[k] ?? _);
}

export async function runTests(service, testCases) {
  const passed = [];
  const failed = [];
  const saved = {}; // values captured via saveIdFrom

  for (const test of testCases) {
    // Interpolate saved values into path and body
    const path = interpolate(test.path, saved);
    const url = `http://localhost:${service.port}${path}`;

    // If path still contains unresolved {{}} placeholders, skip (dependency not created)
    if (path.includes('{{')) {
      failed.push({ name: test.name, error: `Skipped — dependency placeholder unresolved: ${path}` });
      continue;
    }

    try {
      const opts = {
        method: test.method || 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000)
      };

      if (test.method !== 'GET' && test.method !== 'DELETE' && test.body) {
        opts.body = JSON.stringify(test.body);
      }

      const res = await fetch(url, opts);
      const body = await res.text();

      const statusOk = res.status === (test.expectStatus || 200);
      const bodyOk = !test.expectBodyContains || body.includes(test.expectBodyContains);

      // Always try to save saveIdFrom on any 2xx response — even if expectStatus was wrong.
      // This prevents cascading {{id}} failures when the LLM generates the wrong expected status.
      if (test.saveIdFrom && res.status >= 200 && res.status < 300) {
        try {
          const parsed = JSON.parse(body);
          if (parsed[test.saveIdFrom] !== undefined) {
            saved[test.saveIdFrom] = String(parsed[test.saveIdFrom]);
            if (test.saveIdFrom === 'id') saved.id = saved[test.saveIdFrom];
          }
        } catch {}
      }

      if (statusOk && bodyOk) {
        passed.push(test.name);
      } else {
        failed.push({
          name: test.name,
          method: test.method || 'GET',
          path,
          sentBody: test.body || null,
          status: res.status,
          expected: test.expectStatus || 200,
          body: body.slice(0, 300)
        });
      }
    } catch (e) {
      failed.push({ name: test.name, error: e.message });
    }
  }

  return { passed, failed };
}
