// model-stats.js — Track per-model, per-task success rates; persist to CadenzaDB
import { dbFetch } from './cadenza-db-client.js';

const KV_KEY = 'model_stats';

// In-memory cache: { [model]: { [taskType]: { success: n, fail: n } } }
let stats = {};

async function loadStats() {
  try {
    const res = await dbFetch(`/kv/${KV_KEY}`);
    stats = res.value || {};
  } catch {
    stats = {}; // Not found is fine on first run
  }
}

async function saveStats() {
  try {
    await dbFetch(`/kv/${KV_KEY}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: stats })
    });
  } catch (e) {
    console.error('[ModelStats] Save failed:', e.message);
  }
}

export async function recordSuccess(model, taskType) {
  if (!stats[model]) stats[model] = {};
  if (!stats[model][taskType]) stats[model][taskType] = { success: 0, fail: 0 };
  stats[model][taskType].success++;
  await saveStats();
}

export async function recordFailure(model, taskType) {
  if (!stats[model]) stats[model] = {};
  if (!stats[model][taskType]) stats[model][taskType] = { success: 0, fail: 0 };
  stats[model][taskType].fail++;
  await saveStats();
}

// Returns sorted model indices (best first) from a models array
// Untested models get a random score between 0.4–0.6 so they spread across the pack
// rather than always trying the same two first and hitting rate limits
export function getRankedModelIndices(models, taskType) {
  const scored = models.map((model, idx) => {
    const s = stats[model]?.[taskType];
    if (!s || s.success + s.fail < 3) {
      // Spread untested models randomly so all get tried over time
      return { idx, score: 0.4 + Math.random() * 0.2 };
    }
    return { idx, score: s.success / (s.success + s.fail) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.idx);
}

export function getAllStats() {
  return stats;
}

// Purge stats for models no longer in the active list
// (imported lazily to avoid circular deps — reads MODELS from llm-brain at startup)
async function purgeDeadModels() {
  try {
    const { MODELS } = await import('../services/llm-brain.js');
    let changed = false;
    for (const model of Object.keys(stats)) {
      if (!MODELS.includes(model)) {
        delete stats[model];
        changed = true;
      }
    }
    if (changed) await saveStats();
  } catch {}
}

// Load stats on startup, then purge dead models
loadStats().then(purgeDeadModels).catch(() => {});
