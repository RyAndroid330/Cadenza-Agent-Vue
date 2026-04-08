// tasks/task-retry.js — Retry failed services or apply modifications to verified ones
import { Task } from '../cadenza-core.js';
import { logAgent } from '../logger.js';
import { resolveServices, classifyChangeTarget } from '../pipelines/helpers.js';
import { runServicePipeline } from '../pipelines/service-pipeline.js';
import { runModifyPipeline } from '../pipelines/modify-pipeline.js';

const TYPE_ORDER = { db: 0, backend: 1, frontend: 2 };

// payload: string svcId (from UI retry button) OR { hint, description } (from chat)
export const retryServiceTask = new Task('retryService', async (payload) => {
  const hint = typeof payload === 'string' ? payload : (payload?.hint || '');
  const userDescription = typeof payload === 'string' ? '' : (payload?.description || '');

  const services = resolveServices(hint);
  if (!services.length) {
    logAgent({ type: 'error', message: `Could not find any service matching: "${hint}"` });
    logAgent({ type: 'done', message: 'Nothing to do' });
    return;
  }

  const failed = services.filter(s => ['error', 'degraded', 'stopped'].includes(s.status));
  const isModification = failed.length === 0 && userDescription;

  let toRetry;
  if (failed.length > 0) {
    toRetry = failed;
  } else if (isModification) {
    const target = classifyChangeTarget(userDescription);
    const sorted = [...services].sort((a, b) => (TYPE_ORDER[a.type] ?? 1) - (TYPE_ORDER[b.type] ?? 1));
    if (target === 'frontend') {
      toRetry = sorted.filter(s => s.type === 'frontend');
      logAgent({ type: 'plan', message: `Change looks like a UI issue — targeting frontend only` });
    } else if (target === 'data') {
      toRetry = sorted.filter(s => s.type !== 'frontend');
      logAgent({ type: 'plan', message: `Change looks like a data/API issue — targeting db + backend` });
    } else {
      toRetry = sorted;
    }
  } else {
    toRetry = [];
  }

  if (toRetry.length === 0) {
    logAgent({ type: 'error', message: `No services to retry — all verified and no change provided` });
    logAgent({ type: 'done', message: 'Nothing to do' });
    return;
  }

  if (isModification) {
    logAgent({ type: 'fix', message: `Modifying [${toRetry.map(s => s.type).join(', ')}] — "${userDescription}"` });
  } else {
    logAgent({ type: 'fix', message: `Retrying ${toRetry.length} failed service(s)` });
  }

  const completed = services.filter(s => !toRetry.includes(s) && s.status === 'verified');
  for (const svc of toRetry) {
    svc._fixRetries = 0;
    svc._tests = null;
    let result;
    if (isModification && svc._routeCode && svc.type !== 'frontend') {
      result = await runModifyPipeline(svc, userDescription, completed);
    } else {
      if (isModification) svc.description = `${svc.description}. Updated requirement: ${userDescription}`;
      result = await runServicePipeline(svc, completed);
    }
    if (result) completed.push(result);
  }
});

retryServiceTask.doOn('retry_service');
