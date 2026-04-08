// llm-tests.js — Test generation. Prefers live schema; verifies user-specified features.
import { callLLM } from './llm-caller.js';

// Fetch the actual routes from a running service's /schema endpoint
async function fetchLiveSchema(port) {
  try {
    const fetch = (await import('node-fetch')).default;
    const res = await fetch(`http://localhost:${port}/schema`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const data = await res.json();
    const routes = Array.isArray(data) ? data : (data.routes || []);
    return routes
      .filter(r => r.path !== '/health' && r.path !== '/schema')
      .map(r => `${r.method || 'GET'} ${r.path}`);
  } catch { return null; }
}

// Extract explicit feature/field names from the plan or service description.
// Handles: "include these features: Name, Phone number, Email, Address, Birthday"
//          "fields: title, done, createdAt"
//          "with name, email and phone support"
export function extractFeatureFields(planDesc, serviceDesc) {
  const text = [planDesc || '', serviceDesc || ''].join(' ');

  // Try explicit "features:" or "fields:" list first
  const explicitMatch = text.match(
    /(?:include(?:\s+these)?|with|has|fields?|features?)\s*:?\s*([A-Za-z][^.!?\n]{3,120})/i
  );
  if (explicitMatch) {
    const fields = explicitMatch[1]
      .split(/,\s*(?:and\s+)?|\s+and\s+/)
      .map(f => f.trim().toLowerCase().replace(/[^a-z0-9 _]/g, '').trim())
      .filter(f => f.length >= 2 && f.length <= 30 && !/^(these|the|a|an|each|every|all)$/i.test(f));
    if (fields.length >= 2) return fields;
  }
  return [];
}

// Convert a field label to a plausible test value
function fieldTestValue(field) {
  const f = field.toLowerCase();
  if (f.includes('email'))    return 'test@example.com';
  if (f.includes('phone') || f.includes('number')) return '555-0100';
  if (f.includes('birth'))    return '1990-01-15';
  if (f.includes('date'))     return '2026-01-01';
  if (f.includes('address'))  return '123 Test St';
  if (f.includes('url') || f.includes('website')) return 'https://example.com';
  if (f.includes('age'))      return 30;
  if (f.includes('price') || f.includes('amount') || f.includes('cost')) return 9.99;
  // Generic: use the field name itself as the value so expectBodyContains matches easily
  return `test-${f.replace(/\s+/g, '-')}`;
}

// Convert a field label to the snake_case/camelCase key the LLM most likely used
function fieldKey(field) {
  // "phone number" → "phone", "date of birth" → "dateOfBirth", etc.
  const words = field.trim().toLowerCase().split(/\s+/);
  if (words.length === 1) return words[0];
  return words[0] + words.slice(1).map(w => w[0].toUpperCase() + w.slice(1)).join('');
}

// Build the field-body object for the POST test
function buildFieldBody(fields) {
  const body = {};
  for (const f of fields) {
    body[fieldKey(f)] = fieldTestValue(f);
  }
  return body;
}

// Minimal health check — fallback if LLM returns nothing
const HEALTH_CHECK = [
  { name: 'health check', method: 'GET', path: '/health', body: null, expectStatus: 200, expectBodyContains: 'ok' }
];

export async function generateTests(service, plan) {
  // Get live route list
  const liveSchema = service.schema?.length ? service.schema : await fetchLiveSchema(service.port);
  const schemaNote = liveSchema?.length
    ? `\nActual routes this service exposes (use THESE paths only — do not invent others):\n${liveSchema.join('\n')}`
    : '';

  // Extract user-requested feature fields
  const featureFields = extractFeatureFields(plan?.description, service.description);
  const fieldBody = featureFields.length ? buildFieldBody(featureFields) : null;
  const fieldNote = featureFields.length
    ? `\nUser-requested features that MUST be tested: ${featureFields.join(', ')}\n` +
      `- The POST test body MUST include all these fields: ${JSON.stringify(fieldBody)}\n` +
      `- After POST+GET, verify each field value appears in the response using expectBodyContains\n` +
      `- Generate one test per feature field checking its value is returned correctly`
    : '';

  const content = await callLLM([
    {
      role: 'system',
      content: `Generate HTTP integration tests for a Node.js service. Return ONLY a valid JSON array — no markdown, no explanation.

Test schema:
[{
  "name": "string",
  "method": "GET|POST|PUT|DELETE|PATCH",
  "path": "/exact/path",
  "body": null or {},
  "expectStatus": 200,
  "expectBodyContains": "optional substring to check in response body",
  "saveIdFrom": "optional key to save from response body and use as {{id}} in later tests"
}]

HTTP STATUS CODES — use these exactly:
- GET → 200, POST → 201, PUT → 200, PATCH → 200, DELETE → 204
- 404 for missing resource, 400 for bad input

RULES — follow exactly:
1. First test: GET /health, expectStatus 200, expectBodyContains "ok"
2. Only test routes that actually exist — use the route list below; never invent paths
3. POST comes first, before GET-by-id / PUT / DELETE — use saveIdFrom:"id" on the POST, expectStatus 201
4. Reference the saved id as the literal string "{{id}}" in later paths: "/items/{{id}}"
5. Empty lists start empty — do not check body content on initial GET-all
6. Suite size: 8–12 tests — health + full CRUD cycle + one test per user-specified feature field
7. For each feature field: after creating a record (POST), add a GET test that uses expectBodyContains to verify the field value is present in the response
8. You MUST return a non-empty array — minimum is the health check test
9. DELETE expectStatus must be 204, never 200`
    },
    {
      role: 'user',
      content: `Service: ${service.name} (${service.type}) on :${service.port}
Description: ${service.description}
App: ${plan?.description || 'standalone'}${schemaNote}${fieldNote}`
    }
  ], { maxTokens: 1400, taskType: 'test' });

  const clean = content.replace(/```json|```/g, '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  let arr = null;
  try { arr = JSON.parse(clean); } catch {}
  if (!Array.isArray(arr)) {
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) try { arr = JSON.parse(match[0]); } catch {}
  }
  if (!Array.isArray(arr) || arr.length === 0) return HEALTH_CHECK;

  // ── Post-process: enforce correct HTTP status codes and saveIdFrom ──────────
  for (const t of arr) {
    // Correct common LLM mistakes on status codes
    if (t.method === 'POST' && t.expectStatus === 200) t.expectStatus = 201;
    if (t.method === 'DELETE' && t.expectStatus === 200) t.expectStatus = 204;
    // Add saveIdFrom to POST tests that are followed by {{id}} references
    if (t.method === 'POST' && !t.saveIdFrom) {
      const rest = arr.slice(arr.indexOf(t) + 1);
      if (rest.some(r => typeof r.path === 'string' && r.path.includes('{{'))) {
        t.saveIdFrom = 'id';
      }
    }
  }

  // Reorder: health → before-id tests (POST, GET-all) → after-id tests ({{id}} paths)
  const health   = arr.filter(t => t.path === '/health');
  const beforeId = arr.filter(t => t.path !== '/health' && !(typeof t.path === 'string' && t.path.includes('{{')));
  const afterId  = arr.filter(t => typeof t.path === 'string' && t.path.includes('{{'));
  arr = [...health, ...beforeId, ...afterId];

  // ── Post-process: inject field-coverage tests if LLM missed any ──────────
  if (featureFields.length && fieldBody) {
    // Find the POST test (non-health) that creates the main resource
    const postTest = arr.find(t => t.method === 'POST' && t.path !== '/health');
    if (postTest) {
      // Ensure POST body covers all feature fields
      postTest.body = { ...fieldBody, ...(postTest.body || {}) };
      postTest.saveIdFrom = postTest.saveIdFrom || 'id';

      // Find which fields have no dedicated check in afterId tests
      const covered = new Set(
        arr.filter(t => t.expectBodyContains).map(t => t.expectBodyContains)
      );
      const missingFields = featureFields.filter(f => {
        const val = String(fieldTestValue(f));
        return !covered.has(val);
      });

      // Insert a GET-by-id field-coverage test if any fields are unchecked
      if (missingFields.length) {
        // Find the resource path from liveSchema or POST path
        const postPath = postTest.path; // e.g. /contacts
        const byIdPath = postPath.endsWith('s') ? `${postPath}/{{id}}` : `${postPath}/{{id}}`;

        // Only add if the {{id}} path exists in schema
        const hasById = !liveSchema || liveSchema.some(r => r.includes('/:id') || r.includes('/{{id}}'));
        if (hasById) {
          const fieldCoverageTest = {
            name: `field coverage: ${missingFields.join(', ')}`,
            method: 'GET',
            path: byIdPath,
            body: null,
            expectStatus: 200,
            expectBodyContains: String(fieldTestValue(missingFields[0]))
          };
          // Insert after the POST test
          const postIdx = arr.indexOf(postTest);
          arr.splice(postIdx + 1, 0, fieldCoverageTest);
        }
      }
    }
  }

  return arr;
}
