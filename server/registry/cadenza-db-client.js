// cadenza-db-client.js — HTTP client for CadenzaDB
import fetch from 'node-fetch';

const DB_URL = 'http://localhost:3001';

export async function dbFetch(path, opts = {}) {
  const res = await fetch(`${DB_URL}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CadenzaDB ${path} ${res.status}: ${text}`);
  }
  return res.json();
}

export function dbCreateService(svc) {
  return dbFetch('/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(svc)
  });
}

export function dbUpdateService(id, updates) {
  return dbFetch(`/services/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
}

export function dbDeleteService(id) {
  return dbFetch(`/services/${id}`, { method: 'DELETE' });
}

export function dbUpsertPlan(plan) {
  return dbFetch('/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plan)
  });
}

export async function rehydrateRegistry(registry) {
  try {
    const { existsSync } = await import('fs');
    const dump = await dbFetch('/dump');
    let filesMissing = 0;
    for (const svc of dump.services || []) {
      svc.proc = null;
      // Check if deployed file still exists (startup wipes deployed/ on crash recovery)
      if (svc.filePath && !existsSync(svc.filePath)) {
        svc.status = 'error';
        svc.filePath = null;
        filesMissing++;
      } else {
        svc.status = 'stopped';
      }
      registry.services.set(svc.id, svc);
    }
    const total = dump.services?.length || 0;
    console.log(`[Registry] Rehydrated ${total} services (${filesMissing} missing files)`);
  } catch (e) {
    console.error('[Registry] Rehydration failed:', e.message);
  }
}
