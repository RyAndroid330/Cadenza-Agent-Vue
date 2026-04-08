// tasks/task-dispatch.js — Dispatches a new plan: builds services in order (db → backend → frontend)
import { Task } from '../cadenza-core.js';
import { logAgent } from '../logger.js';
import { runServicePipeline } from '../pipelines/service-pipeline.js';

const TYPE_ORDER = { db: 0, backend: 1, frontend: 2 };

export const dispatchDeployTask = new Task('dispatchDeploy', async (plan) => {
  const groupId = `group_${Date.now()}`;
  plan.groupId = groupId;

  const ordered = [...plan.services].sort((a, b) => (TYPE_ORDER[a.type] ?? 1) - (TYPE_ORDER[b.type] ?? 1));
  logAgent({ type: 'deploy', message: `Starting group ${groupId} — ${ordered.length} service(s): ${ordered.map(s => s.type).join(' → ')}` });

  const completedServices = [];

  for (const svc of ordered) {
    svc.id = `${svc.type}_${(svc.name || 'svc').replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`;
    svc.groupId = groupId;
    svc._plan = plan;
    svc._fixRetries = 0;

    const idx = ordered.indexOf(svc) + 1;
    logAgent({ type: 'deploy', message: `[${idx}/${ordered.length}] Starting ${svc.type} "${svc.name}"` });
    const result = await runServicePipeline(svc, completedServices);

    if (result) {
      completedServices.push(result);
      if (idx < ordered.length) logAgent({ type: 'deploy', message: `[${svc.type.toUpperCase()}] "${svc.name}" done — passing :${svc.port} to next service` });
    } else {
      logAgent({ type: 'error', message: `[${svc.type.toUpperCase()}] "${svc.name}" failed — continuing` });
      completedServices.push({ ...svc, status: 'error' });
    }
  }

  const verified = completedServices.filter(s => s.status === 'verified').length;
  const running  = completedServices.filter(s => s.status === 'running').length;
  const errors   = completedServices.filter(s => s.status === 'error').length;
  const statusIcon = s => s.status === 'verified' ? '✓' : s.status === 'running' ? '~' : '✗';
  const summary = completedServices.map(s => `${s.type} :${s.port} ${statusIcon(s)}`).join('  |  ');
  const note = [verified + running > 0 ? `${verified + running}/${ordered.length} live` : '', errors ? `${errors} down` : ''].filter(Boolean).join(', ');
  logAgent({ type: 'done', message: `Group complete — ${note}  |  ${summary}` });
});

dispatchDeployTask.doOn('dispatch');
