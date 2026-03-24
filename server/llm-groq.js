// Groq LLM API utility
const fetch = require('node-fetch');

const registry = require('./cadenza/service/registry');
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODELS = {
  plan: ['llama-3.3-70b-versatile', 'kimi-k2', 'gpt-oss-120b'],
  code: ['llama-3.1-8b-instant', 'llama-70b', 'gpt-oss-20b'],
  test: ['llama-3.1-8b-instant', 'llama-8b', 'qwen3-32b'],
  fix: ['llama-3.1-8b-instant', 'llama-4-scout', 'llama-8b']
};

// type: 'plan' | 'code' | 'test' | 'fix'
async function callGroq(messages, maxTokens = 512, type = 'plan') {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not set in environment');
  const fallback = MODELS[type]?.[0] || 'llama-3.1-8b-instant';
  const model = registry.getBestModel(type, fallback);
  let res, data, success = false;
  try {
    res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens
      })
    });
    if (!res.ok) throw new Error('Groq API error: ' + (await res.text()));
    data = await res.json();
    success = true;
    return data.choices[0].message.content;
  } catch (e) {
    throw e;
  } finally {
    registry.updateModelStat(model, type, success);
  }
}

module.exports = { callGroq };
