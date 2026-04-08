// llm-caller.js — Core LLM API caller with ranked model fallback and rate-limit handling
import fetch from 'node-fetch';
import { getRankedModelIndices, recordSuccess, recordFailure } from '../registry/model-stats.js';
import { logAgent } from '../logger.js';

export const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Active Groq text-generation models (verified 2026-04-01)
export const MODELS = [
  'openai/gpt-oss-120b',
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'moonshotai/kimi-k2-instruct',
  'moonshotai/kimi-k2-instruct-0905',
  'qwen/qwen3-32b',
  'openai/gpt-oss-20b',
  'groq/compound',
  'groq/compound-mini',
  'llama-3.1-8b-instant',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function callLLM(messages, { maxTokens = 1024, taskType = 'plan' } = {}) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not set in environment');
  const ranked = getRankedModelIndices(MODELS, taskType);
  return tryModels(messages, maxTokens, taskType, ranked, 0);
}

// Short display name for a model (strips org prefix)
function shortModel(model) {
  return model.includes('/') ? model.split('/').pop() : model;
}

async function tryModels(messages, maxTokens, taskType, ranked, attempt) {
  if (attempt >= ranked.length) throw new Error('All models failed');
  const model = MODELS[ranked[attempt]];
  const label = shortModel(model);
  logAgent({ type: 'llm', message: `[LLM] ${label} ← ${taskType}` });
  let success = false;
  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.3 })
    });
    if (res.status === 429) {
      const body = await res.text();
      const match = body.match(/try again in ([0-9.]+)s/i);
      const wait = match ? Math.ceil(parseFloat(match[1]) * 1000) + 500 : 6000;
      logAgent({ type: 'llm', message: `[LLM] ${label} 429 — waiting ${(wait/1000).toFixed(1)}s, trying next model` });
      console.warn(`[LLM] 429 on ${model}, waiting ${wait}ms`);
      await recordFailure(model, taskType);
      await sleep(wait);
      return tryModels(messages, maxTokens, taskType, ranked, attempt + 1);
    }
    if (!res.ok) throw new Error(`API error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from model');
    success = true;
    await recordSuccess(model, taskType);
    const tokens = data.usage?.completion_tokens;
    logAgent({ type: 'llm', message: `[LLM] ${label} ✓${tokens ? ` (${tokens} tokens)` : ''}` });
    return content;
  } catch (e) {
    if (!success) await recordFailure(model, taskType);
    logAgent({ type: 'llm', message: `[LLM] ${label} ✗ — ${e.message.slice(0, 120)}` });
    console.warn(`[LLM] ${model} failed (${taskType}): ${e.message}`);
    return tryModels(messages, maxTokens, taskType, ranked, attempt + 1);
  }
}
