// tasks/task-interpret.js — Interprets user message into a structured plan
import { Task } from '../cadenza-core.js';
import registry from '../registry/service-registry.js';
import { interpretRequest } from '../services/llm-brain.js';
import { dbUpsertPlan } from '../registry/cadenza-db-client.js';
import { logAgent } from '../logger.js';
import { startSession } from '../session.js';

export const interpretPlanTask = new Task('interpretPlan', async (rawMessage, ctx) => {
  startSession();

  // Strip [UI_SPEC]:... block before sending to intent LLM — it must never be read as services
  let uiSpec = null;
  const uiSpecMatch = rawMessage.match(/\n\[UI_SPEC\]:(.+)$/s);
  const message = uiSpecMatch ? rawMessage.slice(0, uiSpecMatch.index).trim() : rawMessage;
  if (uiSpecMatch) {
    try { uiSpec = JSON.parse(uiSpecMatch[1]); } catch {}
  }

  const existingCount = registry.getAllServices().length;
  logAgent({ type: 'plan', message: `Interpreting: "${message}"${existingCount ? ` (${existingCount} service(s) running)` : ''}` });

  let plan;
  try {
    const existingServices = registry.getAllServices().map(({ proc, code, _plan, ...rest }) => rest);
    plan = await interpretRequest(message, existingServices);
  } catch (e) {
    logAgent({ type: 'error', message: `Plan interpretation failed: ${e.message}` });
    logAgent({ type: 'done', message: 'Failed to interpret request' });
    throw e;
  }

  plan.id = `plan_${Date.now()}`;
  plan.createdAt = Date.now();
  if (uiSpec) plan.uiSpec = uiSpec;
  if (['edit', 'update', 'modify'].includes(plan.intent)) plan.intent = 'fix';

  const intentLabel = {
    new: `Build ${plan.services?.length || 0} new service(s)`,
    fix: 'Fix/edit existing service',
    delete: 'Delete service group',
    deactivate: 'Stop service group',
    reactivate: 'Restart service group',
    self_modify: 'Modify agent source code',
    rollback: 'Rollback agent to previous snapshot',
    unknown: 'Unknown intent'
  }[plan.intent] || plan.intent;

  logAgent({ type: 'plan', message: `Intent: ${intentLabel} — ${plan.description}` });
  plan.services?.forEach(s => logAgent({ type: 'plan', message: `  → ${s.type}: "${s.name}" — ${s.description}` }));
  await dbUpsertPlan(plan);

  // Use original message as hint fallback — it always contains the service name.
  // plan.description is the change description ("replace prompts with dialog"), not a name.
  const targetHint = plan.targetId || plan.groupId || message;

  switch (plan.intent) {
    case 'new':         ctx.emit('dispatch', plan); break;
    case 'fix':         ctx.emit('retry_service', { hint: targetHint, description: plan.description }); break;
    case 'deactivate':
    case 'delete':      ctx.emit('delete_group', targetHint); break;
    case 'reactivate':  ctx.emit('reactivate_group', targetHint); break;
    case 'self_modify': ctx.emit('self_modify', message); break;
    case 'rollback':    ctx.emit('rollback', plan.targetId || ''); break;
    default:
      logAgent({ type: 'error', message: `Unknown intent "${plan.intent}"` });
      logAgent({ type: 'done', message: 'Nothing to do' });
  }
  return plan;
});

interpretPlanTask.doOn('request_received');
