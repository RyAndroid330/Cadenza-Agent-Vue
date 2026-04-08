// llm-intent.js — Interprets user natural language into a structured plan JSON
import { callLLM } from './llm-caller.js';

// Detect if message is a "new app" request and return suggested features for that app type.
// Returns { isNew: true, appType: "...", features: [{label, checked}] } or { isNew: false }
export async function suggestFeatures(message) {
  const content = await callLLM([
    {
      role: 'system',
      content: `Determine if the user wants to build a brand-new app. Return ONLY valid JSON (no markdown, no thinking):

If it IS a new app request:
{"isNew":true,"appType":"short readable name e.g. Address Book","features":[{"label":"Feature name","checked":true},...]}

If it is NOT a new app request (it's a fix, edit, query, or anything else):
{"isNew":false}

Feature rules:
- List 8–12 features common for that app type
- Pre-check (checked:true) the 5–7 most essential/expected ones
- Leave advanced/optional features unchecked
- Each label should be short and user-readable (e.g. "Contact photo", "Birthday", "Tags")`
    },
    { role: 'user', content: message }
  ], { maxTokens: 400, taskType: 'plan' });

  const clean = content.replace(/```json|```/g, '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  try { return JSON.parse(clean); } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) try { return JSON.parse(match[0]); } catch {}
    return { isNew: false };
  }
}

export async function interpretRequest(message, existingServices = []) {
  const serviceList = existingServices.length
    ? '\n\nExisting services (use exact id/groupId when targeting one):\n' +
      existingServices.map(s => `  id:${s.id} groupId:${s.groupId} name:"${s.name}" type:${s.type} status:${s.status}`).join('\n')
    : '';

  const content = await callLLM([
    {
      role: 'system',
      content: `You are an AI agent that interprets user requests for managing web services.
Return ONLY valid JSON (no markdown):
{
  "intent": "new|fix|deactivate|delete|reactivate|self_modify|rollback|unknown",
  "targetId": "exact service id if targeting one",
  "groupId": "exact groupId if targeting a group",
  "description": "what the user wants — for fix, include full change/requirement",
  "services": [{"type":"frontend|backend|db","name":"name","description":"desc"}]
}
Intent guide:
- "new": build something new → fill services array
- "fix": fix, edit, update, change requirements of an EXISTING service (even if verified) → fill groupId/targetId, full change in "description"
- "deactivate": stop a group  - "delete": remove a group  - "reactivate": restart stopped group
- "self_modify": change the agent's own code  - "rollback": undo a self-modification (put snapshot id in targetId)
Words like "edit", "update", "change", "modify", "add feature to", "make it require" → intent "fix".
If the message starts with [Focus: ...], extract groupId and/or targetId from the listed ids — prefer groupId if all focused services share one group.

Service planning rules for "new" intent:
- Standard app = exactly 3 services: 1 db + 1 backend + 1 frontend
- Use ONE db service for all data — do not split into multiple db services unless models are truly independent (e.g. a multi-tenant platform with completely separate schemas)
- Always set "description" on the plan itself (not just on services) — a one-line summary of what is being built
- Name services concisely: prefer "Contacts DB", "Contacts API", "Address Book UI" over vague names like "Database" or "User Model"`
    },
    { role: 'user', content: message + serviceList }
  ], { maxTokens: 800, taskType: 'plan' });

  const clean = content.replace(/```json|```/g, '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  try { return JSON.parse(clean); } catch {
    // Try extracting the outermost JSON object
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
      // If still failing (truncated JSON), attempt to repair by closing open structures
      try { return JSON.parse(repairJson(match[0])); } catch {}
    }
    throw new Error('LLM did not return valid JSON: ' + clean.slice(0, 200));
  }
}

// Best-effort JSON repair for truncated LLM output — closes unclosed arrays/objects
function repairJson(s) {
  const stack = [];
  let inStr = false, escape = false;
  for (const ch of s) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inStr) { escape = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }
  if (inStr) s += '"';
  return s + stack.reverse().join('');
}
