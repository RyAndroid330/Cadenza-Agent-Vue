// llm-fix.js — diagnoseAndFix, modifyServiceCode, planSelfModification, generateSelfModification
import { callLLM } from './llm-caller.js';
import { ROUTER_API_DOCS, ROUTER_API_DOCS_ASYNC, cleanCode } from './llm-codegen.js';

export async function diagnoseAndFix(service, currentCode, failedTests, plan, fixHistory = [], contextHint = '') {
  let historyBlock = '';
  const priorAttempts = fixHistory.slice(0, -1);
  if (priorAttempts.length > 0) {
    historyBlock = '\n\nPREVIOUS FIX ATTEMPTS — do NOT repeat these approaches:\n';
    for (const h of priorAttempts) {
      const failSummary = h.failures.map(f =>
        f.error ? `${f.name}: CRASHED — ${f.error.slice(0, 300)}`
                : `${f.name}: got HTTP ${f.status} expected ${f.expected}${f.body ? ', body: ' + f.body.slice(0, 200) : ''}`
      ).join('; ');
      historyBlock += `\nAttempt ${h.attempt} failures: ${failSummary}\n`;
      if (h.code) historyBlock += `Attempt ${h.attempt} code (did NOT work):\n${h.code}\n`;
    }
    historyBlock += '\nYou MUST try a fundamentally different approach.\n';
  }

  const failureDetail = failedTests.map(f => {
    if (f.error) return `  - ${f.name}: CRASHED — ${f.error.slice(0, 400)}`;
    const sent = f.sentBody ? `, sent: ${JSON.stringify(f.sentBody)}` : '';
    return `  - ${f.name}: ${f.method || 'GET'} ${f.path || ''}${sent} → got HTTP ${f.status} (expected ${f.expected})${f.body ? ', response: ' + f.body.slice(0, 300) : ''}`;
  }).join('\n');

  const routerDocs = service.type === 'backend' ? ROUTER_API_DOCS_ASYNC : ROUTER_API_DOCS;
  const handlerType = service.type === 'backend' ? 'async route handlers for a backend API' : 'route handlers for an in-memory service';
  const proxyRule = service.type === 'backend'
    ? '\nCRITICAL: If this is a DB proxy, the DB URL must be a hardcoded string literal: const DB = \'http://localhost:PORT\'. Do NOT use globalThis, process.env, or any other variable to get the URL.'
    : '';

  const content = await callLLM([
    {
      role: 'system',
      content: `You are fixing broken ${handlerType}.
Output ONLY the data declarations and router calls — no HTTP server code, no require(), no markdown.
${routerDocs}${proxyRule}`
    },
    {
      role: 'user',
      content: `Service: ${service.name} (${service.type})
Description: ${service.description}${contextHint}${historyBlock}

CURRENT FAILURES:
${failureDetail}

Current route code to fix:
${currentCode}`
    }
  ], { maxTokens: 3000, taskType: 'fix' });

  return cleanCode(content, service.type);
}

export async function modifyServiceCode(service, currentCode, spec, changeRequest, contextHint = '') {
  const routerDocs = service.type === 'backend' ? ROUTER_API_DOCS_ASYNC : ROUTER_API_DOCS;

  const content = await callLLM([
    {
      role: 'system',
      content: `You are modifying existing route handler code for a Node.js service.
Output ONLY the updated data declarations and router calls — no HTTP server code, no require(), no markdown.
${routerDocs}

Rules:
- Keep ALL existing routes and behavior unless the change explicitly removes something
- Apply ONLY the requested change — do not refactor or restructure unrelated code
- If adding a new field, add it everywhere it's relevant (POST, PUT, GET responses)`
    },
    {
      role: 'user',
      content: `${spec ? `Current service spec:\n${spec}\n\n` : ''}${contextHint ? `${contextHint}\n\n` : ''}Change requested: ${changeRequest}

Current route code to modify:
${currentCode}`
    }
  ], { maxTokens: 3000, taskType: 'fix' });

  return cleanCode(content, service.type);
}

export async function planSelfModification(message, fileList) {
  const content = await callLLM([
    {
      role: 'system',
      content: `You are analyzing a codebase to plan a self-modification.
Return ONLY valid JSON: {"files": ["file1", "file2"], "description": "what to change", "patch_mode": false}
patch_mode should be true if only small sections of files need changing.
No markdown, no explanation.`
    },
    {
      role: 'user',
      content: `User request: ${message}\n\nAvailable files:\n${fileList.join('\n')}`
    }
  ], { maxTokens: 512, taskType: 'plan' });

  const clean = content.replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Bad plan response');
  }
}

export async function generateSelfModification(plan, fileContents) {
  const filesContext = Object.entries(fileContents)
    .map(([f, c]) => `// FILE: ${f}\n${c}`)
    .join('\n\n---\n\n');

  const content = await callLLM([
    {
      role: 'system',
      content: `You are modifying agent source files. Return ONLY valid JSON:
{"files": {"filename": "complete_new_content"}}
Return the complete new content for each file that needs changing.
No markdown, no explanation outside the JSON.`
    },
    {
      role: 'user',
      content: `Change: ${plan.description}\n\nCurrent files:\n${filesContext}`
    }
  ], { maxTokens: 6000, taskType: 'fix' });

  const clean = content.replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Bad self-mod response');
  }
}
