// LLM-driven test case generator for services (robust, retries on invalid JSON)
const { callGroq } = require('../../llm-groq');

async function generateTests(service, plan) {
  // Use LLM to generate integration tests for the service
  const prompt = `Generate integration tests as a JSON array for a ${service.type} service on port ${service.port} for: "${plan.description}"\nEach test object:{ "name": string, "method": "GET"|"POST"|"PUT"|"DELETE", "path": string, "body": null|object, "expectStatus": number, "expectBodyContains": string|null }\nInclude: health check, list items (GET), create item (POST). At least 3 tests.\nReturn ONLY the JSON array, no markdown.`;
  let res, clean, parsed;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await callGroq([{ role: 'user', content: prompt }], 800, 'code');
      clean = res.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
      if (Array.isArray(parsed) && parsed.length >= 1) return parsed;
    } catch (e) {
      // log error and retry once
      if (attempt === 0) console.error('LLM test generation error:', e.message, res);
    }
  }
  // Fallback tests
  return [
    { name: 'Health check', method: 'GET', path: '/health', body: null, expectStatus: 200, expectBodyContains: null },
    { name: 'List items', method: 'GET', path: service.type === 'backend' ? '/api/items' : '/items', body: null, expectStatus: 200, expectBodyContains: null },
    { name: 'Create item', method: 'POST', path: service.type === 'backend' ? '/api/items' : '/items', body: { foo: 'bar' }, expectStatus: 200, expectBodyContains: null }
  ];
}

module.exports = { generateTests };
