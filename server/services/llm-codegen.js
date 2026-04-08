// llm-codegen.js — Service code generation (generateServiceCode, cleanCode)
import { callLLM } from './llm-caller.js';

// JS code start patterns — used to strip leading garbage from LLM output
const JS_START = /^(\/\/|\/\*|'use strict'|"use strict"|const |var |let |function |class |if |router\.)/;

// Router API for DB/simple services — synchronous handlers only
export const ROUTER_API_DOCS = `
You have a pre-built \`router\` object. Use it to register routes. Do NOT write any HTTP server code.

router.get('/path', (params, body, query) => data)
router.post('/path', (params, body, query) => [201, data])
router.put('/path/:id', (params, body, query) => data)
router.delete('/path/:id', (params, body, query) => [204, null])
router.patch('/path/:id', (params, body, query) => data)

- params: URL path parameters (e.g. params.id for /items/:id)
- body: parsed JSON request body (object)
- query: parsed query string (object)
- Return value: either plain data (status 200) or [statusCode, data]
- Return [404, { error: 'not found' }] for missing items
- Return [400, { error: 'reason' }] for bad input
- /health and /schema are already registered — do NOT add them again
- NO require() calls — all data must be plain JS arrays/objects/Maps at the top of the file
- NO async/await — all handlers must be synchronous`;

// Router API for backend services — async handlers allowed (can fetch DB)
export const ROUTER_API_DOCS_ASYNC = `
You have a pre-built \`router\` object. Use it to register routes. Do NOT write any HTTP server code.

router.get('/path', async (params, body, query) => data)
router.post('/path', async (params, body, query) => [201, data])
router.put('/path/:id', async (params, body, query) => data)
router.delete('/path/:id', async (params, body, query) => [204, null])
router.patch('/path/:id', async (params, body, query) => data)

- params: URL path parameters (e.g. params.id for /items/:id)
- body: parsed JSON request body (object)
- query: parsed query string (object)
- Return value: either plain data (status 200) or [statusCode, data]
- Return [404, { error: 'not found' }] for missing items
- Return [400, { error: 'reason' }] for bad input
- /health and /schema are already registered — do NOT add them again
- NO require() calls — use globalThis.fetch (built into Node 18+) to call other services
- Handlers MAY be async and use await fetch() to proxy to a DB service`;

export function cleanCode(raw, type) {
  // Strip model thinking blocks (qwen3 and similar output <think>...</think>)
  raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  const fenceMatch = raw.match(/```[\w]*\r?\n([\s\S]*?)```/);
  let code = fenceMatch ? fenceMatch[1] : raw;

  if (type === 'frontend') {
    // Find <!DOCTYPE html specifically — not just any '<' (avoids picking up stray tags)
    const doctypeIdx = code.search(/<!doctype html/i);
    if (doctypeIdx > 0) code = code.slice(doctypeIdx);
    const htmlEnd = code.lastIndexOf('</html>');
    if (htmlEnd !== -1) code = code.slice(0, htmlEnd + 7);
  } else {
    const lines = code.split('\n').filter(l => !l.trim().match(/^```/));
    let firstCodeLine = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() && JS_START.test(lines[i].trim())) { firstCodeLine = i; break; }
    }
    let lastCodeLine = firstCodeLine;
    for (let i = firstCodeLine; i < lines.length; i++) {
      const l = lines[i].trim();
      if (l && (l.endsWith(';') || l.endsWith('}') || l.endsWith(')') || l.startsWith('//'))) lastCodeLine = i;
    }
    code = lines.slice(firstCodeLine, lastCodeLine + 1).join('\n');
  }
  return code.trim();
}

export async function generateServiceCode(service, plan, backendPort = null, contextHint = '') {
  const dbPrompt = `You are generating route handlers for a Node.js in-memory data store.
Output ONLY the data declarations and router calls — no HTTP server code, no require(), no markdown, no explanation.
${ROUTER_API_DOCS}

Example of correct output (a todo store):
const todos = [];
let nextId = 1;
router.get('/todos', (p, b, q) => q.status ? todos.filter(x => x.status === q.status) : todos);
router.post('/todos', (p, body) => { if (!body.title) return [400, { error: 'title required' }]; const t = { id: nextId++, title: body.title, done: false, createdAt: Date.now() }; todos.push(t); return [201, t]; });
router.get('/todos/:id', (p) => { const t = todos.find(x => x.id === +p.id); return t || [404, { error: 'not found' }]; });
router.put('/todos/:id', (p, body) => { const t = todos.find(x => x.id === +p.id); if (!t) return [404, { error: 'not found' }]; Object.assign(t, body); return t; });
router.delete('/todos/:id', (p) => { const i = todos.findIndex(x => x.id === +p.id); if (i === -1) return [404, { error: 'not found' }]; todos.splice(i, 1); return [204, null]; });`;

  const hasDbContext = contextHint.includes('db ');
  const backendPrompt = hasDbContext
    ? `You are generating async route handlers for a Node.js backend API service that proxies to a DB.
Output ONLY the constant declarations and router calls — no HTTP server code, no require(), no markdown, no explanation.
${ROUTER_API_DOCS_ASYNC}

CRITICAL RULES for proxy backends:
1. Extract the DB URL from the context and assign it to a const: const DB = 'http://localhost:XXXX';
   DO NOT use globalThis, process.env, or any variable — use the LITERAL URL string from the context.
2. Proxy ALL requests to the DB using fetch(). Use the EXACT route paths shown in the DB's routes list.
3. Do NOT add your own validation or field checks — the DB service handles all validation.
   Just forward the body as-is and return whatever status+body the DB returns.
4. Pass through non-200 status codes: return [r.status, await r.json()] for all responses.

Example of correct output that proxies a DB at http://localhost:4101 with routes GET/POST /contacts, GET/PUT/DELETE /contacts/:id:
const DB = 'http://localhost:4101';
router.get('/contacts', async () => { const r = await fetch(DB + '/contacts'); return r.json(); });
router.post('/contacts', async (p, body) => { const r = await fetch(DB + '/contacts', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }); return [r.status, await r.json()]; });
router.get('/contacts/:id', async (p) => { const r = await fetch(DB + '/contacts/' + p.id); return [r.status, await r.json()]; });
router.put('/contacts/:id', async (p, body) => { const r = await fetch(DB + '/contacts/' + p.id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }); return [r.status, await r.json()]; });
router.delete('/contacts/:id', async (p) => { const r = await fetch(DB + '/contacts/' + p.id, { method: 'DELETE' }); return [r.status, r.status === 204 ? null : await r.json()]; });`
    : `You are generating route handlers for a Node.js backend API service with in-memory storage.
Output ONLY the data declarations and router calls — no HTTP server code, no require(), no markdown, no explanation.
${ROUTER_API_DOCS}

No DB service is available — use plain JS arrays/objects for storage (same as a DB service).
Example of correct output (a todo service):
const todos = [];
let nextId = 1;
router.get('/todos', (p, b, q) => todos);
router.post('/todos', (p, body) => { if (!body.title) return [400, { error: 'title required' }]; const t = { id: nextId++, title: body.title, done: false, createdAt: Date.now() }; todos.push(t); return [201, t]; });
router.get('/todos/:id', (p) => { const t = todos.find(x => x.id === +p.id); return t || [404, { error: 'not found' }]; });
router.put('/todos/:id', (p, body) => { const t = todos.find(x => x.id === +p.id); if (!t) return [404, { error: 'not found' }]; Object.assign(t, body); return t; });
router.delete('/todos/:id', (p) => { const i = todos.findIndex(x => x.id === +p.id); if (i === -1) return [404, { error: 'not found' }]; todos.splice(i, 1); return [204, null]; });`;

  let systemPrompt;
  if (service.type === 'frontend') {
    const apiBase = backendPort ? `http://localhost:${backendPort}` : null;
    const apiNote = apiBase
      ? `const API = '${apiBase}';  // use for ALL fetch() calls — never call db services directly`
      : (contextHint ? `// Use the backend URL from context below` : '// No backend — use relative paths');

    // Extract feature fields for the FIELDS checklist
    const planDesc = plan?.description || service.description || '';
    const featMatch = planDesc.match(/(?:include(?:\s+these)?|with|has|fields?|features?)\s*:?\s*([A-Za-z][^.!?\n]{3,120})/i);
    const featureList = featMatch
      ? featMatch[1].split(/,\s*(?:and\s+)?|\s+and\s+/).map(f => f.trim()).filter(f => f.length >= 2 && f.length <= 40).slice(0, 12)
      : [];
    const fieldChecklist = featureList.length
      ? `\nFIELDS array MUST include an entry for each: ${featureList.join(', ')}`
      : '';

    systemPrompt = `You are generating a single-file HTML app that uses the CadenzaUI component library.
Output ONLY raw HTML starting with <!DOCTYPE html>. No markdown, no explanation, no preamble.
CadenzaUI is already injected into the page — do NOT import, define, or redefine it.

CadenzaUI API:
  CadenzaUI.init('App Title')                                    — call first in DOMContentLoaded
  CadenzaUI.setNav([{label, icon?}], onSelect)                  — optional sidebar nav
  CadenzaUI.addToolbarButton('Label', onClick, {primary?,danger?}) — adds button to toolbar
  CadenzaUI.setToolbarTitle('Page Title')                        — optional toolbar heading
  CadenzaUI.renderSearch('#_toolbar', {placeholder, onSearch: async fn(query)})
  CadenzaUI.renderList('#_content', {data:[], columns:[{key,label}], onEdit:fn, onDelete:fn})
  CadenzaUI.renderForm({title, fields:[{key,label,type?,placeholder?,required?}], values:{}, onSubmit:async fn(data)})
  CadenzaUI.hideForm()                                           — call after successful save
  CadenzaUI.showToast('msg', 'success'|'error')
  CadenzaUI.toggleTheme()                                        — already wired to titlebar

REQUIRED — app WILL BE REJECTED if missing:
1. CadenzaUI.init('Title') called in DOMContentLoaded
2. addToolbarButton('Add ...', ()=>showForm(), {primary:true}) — visible Add button
3. renderList with BOTH onEdit and onDelete handlers
4. renderForm FIELDS array with an entry for EVERY feature field (key + label)
5. Load data automatically on page load
6. On save: POST/PUT → hideForm() → reload → showToast('Saved!')
7. On delete: DELETE fetch → reload → showToast('Deleted')
8. Errors: showToast(err.message||'Error', 'error')
${fieldChecklist}

OUTPUT FORMAT:
<!DOCTYPE html>
<html data-theme="light">
<head><meta charset="utf-8"><title>App Name</title></head>
<body>
<script>
${apiNote}
const COLUMNS = [{key:'...', label:'...'}, ...];
const FIELDS  = [{key:'...', label:'...', type:'text', required:true}, ...];
let _editId = null;
async function load(q='') { const r=await fetch(API+'/resource'+(q?'?q='+encodeURIComponent(q):'')); CadenzaUI.renderList('#_content',{data:await r.json(),columns:COLUMNS,onEdit:showForm,onDelete:remove}); }
async function remove(item) { await fetch(API+'/resource/'+item.id,{method:'DELETE'}); load(); CadenzaUI.showToast('Deleted'); }
function showForm(item=null) { _editId=item?.id||null; CadenzaUI.renderForm({title:item?'Edit':'Add',fields:FIELDS,values:item||{},onSubmit:save}); }
async function save(data) { try { const url=API+'/resource'+(_editId?'/'+_editId:''); await fetch(url,{method:_editId?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); CadenzaUI.hideForm(); load(); CadenzaUI.showToast('Saved!'); } catch(e){CadenzaUI.showToast(e.message,'error');} }
document.addEventListener('DOMContentLoaded',()=>{ CadenzaUI.init('App Name'); CadenzaUI.addToolbarButton('Add Record',()=>showForm(),{primary:true}); CadenzaUI.renderSearch('#_toolbar',{placeholder:'Search...',onSearch:load}); load(); });
</script>
</body>
</html>`;
  } else if (service.type === 'backend') {
    systemPrompt = backendPrompt;
  } else {
    systemPrompt = dbPrompt;
  }

  const userPrompt = `Build: ${service.name} (${service.type})
Description: ${service.description}
Overall app: ${plan?.description || 'standalone service'}${contextHint}

${service.type === 'db' ? `Requirements for this data store:
- Define the full data model with all relevant fields (infer from the description above)
- Include createdAt timestamps on records
- Support filtering by query params where it makes sense (e.g. ?status=open)
- On POST, validate ONLY the single most essential field (e.g. title, name, or text) — do NOT require secondary fields like description, notes, tags, etc.
- Return [400, {error}] for missing essential field only
- Use numeric auto-increment ids` : ''}
${service.type === 'backend' && hasDbContext ? `Requirements — DB proxy mode:
- A DB service is listed in the context. Use its EXACT URL (literal string) as: const DB = 'http://localhost:PORT';
- Mirror every route the DB exposes using the SAME path (e.g. if DB has GET /contacts use router.get('/contacts', ...))
- Do NOT add your own field validation — forward the body directly to the DB and return its response as-is
- Use [r.status, await r.json()] for all responses so errors pass through correctly` : ''}
${service.type === 'backend' && !hasDbContext ? `Requirements — standalone mode:
- No DB service in context — maintain your own in-memory store (arrays/objects)
- Validate inputs and return clear error messages` : ''}`;

  const code = await callLLM([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ], { maxTokens: 3000, taskType: 'code' });

  return cleanCode(code, service.type);
}
