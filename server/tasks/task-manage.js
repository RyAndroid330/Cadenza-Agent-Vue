// tasks/task-manage.js — Delete, reactivate, self-modify, and rollback tasks
import { Task } from '../cadenza-core.js';
import { logAgent } from '../logger.js';
import { resolveServices } from '../pipelines/helpers.js';
import { spawnService, killService } from '../services/deployer.js';
import { applySelfModification, rollbackToSnapshot, listSnapshots } from '../services/self-modifier.js';
import registry from '../registry/service-registry.js';

// ── Delete group ──────────────────────────────────────────────────────────────
export const deleteGroupTask = new Task('deleteGroup', async (hint) => {
  const services = resolveServices(hint);
  if (!services.length) {
    logAgent({ type: 'error', message: `Could not find any service matching: "${hint}"` });
    logAgent({ type: 'done', message: 'Nothing to do' });
    return;
  }
  logAgent({ type: 'deploy', message: `Deleting ${services.length} service(s) matching "${hint}"` });
  for (const svc of services) {
    killService(svc);
    await registry.removeService(svc.id);
  }
  logAgent({ type: 'done', message: `Deleted ${services.length} service(s)` });
});
deleteGroupTask.doOn('delete_group');

// ── Reactivate group ──────────────────────────────────────────────────────────
export const reactivateGroupTask = new Task('reactivateGroup', async (hint) => {
  const services = resolveServices(hint);
  if (!services.length) {
    logAgent({ type: 'error', message: `Could not find any service matching: "${hint}"` });
    logAgent({ type: 'done', message: 'Nothing to do' });
    return;
  }
  logAgent({ type: 'deploy', message: `Reactivating ${services.length} service(s)` });
  for (const svc of services) {
    if (svc.filePath) {
      svc.proc = spawnService(svc);
      await registry.updateService(svc.id, { status: 'running' });
      logAgent({ type: 'deploy', message: `Reactivated "${svc.name}"` });
    }
  }
});
reactivateGroupTask.doOn('reactivate_group');

// ── Self-modification ─────────────────────────────────────────────────────────
export const analyzeSelfTask = new Task('analyzeSelf', async (message) => {
  logAgent({ type: 'fix', message: `Self-modification requested: "${message}"` });
  try {
    const result = await applySelfModification(message);
    if (result.needsRestart) {
      logAgent({ type: 'done', message: `Self-modification committed: ${result.modified.join(', ')} — snapshot: ${result.snapshotId}` });
      logAgent({ type: 'fix', message: `Backend changed — restart server to apply. Rollback: rollback ${result.snapshotId}` });
    } else {
      logAgent({ type: 'done', message: `Self-modification applied: ${result.modified.join(', ')} (hot-reloaded)` });
    }
  } catch (e) {
    logAgent({ type: 'error', message: `Self-modification failed: ${e.message}` });
    logAgent({ type: 'done', message: 'Self-modification aborted' });
  }
});
analyzeSelfTask.doOn('self_modify');

// ── Rollback ──────────────────────────────────────────────────────────────────
export const rollbackTask = new Task('rollback', async (snapshotId) => {
  if (!snapshotId) {
    const snaps = listSnapshots();
    if (!snaps.length) {
      logAgent({ type: 'error', message: 'No snapshots available' });
      logAgent({ type: 'done', message: 'Nothing to do' });
      return;
    }
    logAgent({ type: 'fix', message: `Snapshots:\n${snaps.map(s => `  ${s.id} — ${s.createdAt} — ${s.files.join(', ')}`).join('\n')}` });
    logAgent({ type: 'done', message: `Say "rollback ${snaps[0].id}" to restore most recent` });
    return;
  }
  logAgent({ type: 'fix', message: `Rolling back to: ${snapshotId}` });
  try {
    await rollbackToSnapshot(snapshotId);
    logAgent({ type: 'done', message: `Rollback to ${snapshotId} complete — restart server to apply` });
  } catch (e) {
    logAgent({ type: 'error', message: `Rollback failed: ${e.message}` });
    logAgent({ type: 'done', message: 'Rollback failed' });
  }
});
rollbackTask.doOn('rollback');
