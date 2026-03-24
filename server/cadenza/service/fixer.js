// LLM-driven code fixer for failed services (stub, to be expanded)
const { callGroq } = require('../../llm-groq');
const { writeServiceFile } = require('../../codegen');

async function fixServiceCode(service, code, failedTests, plan) {
  // Use LLM to diagnose and rewrite code based on failed tests
  const prompt = `You are an expert developer. The following service failed tests:\n\nService: ${service.name}\nType: ${service.type}\nDescription: ${service.description}\n\nPlan: ${plan?.description || ''}\n\nFailed tests:\n${JSON.stringify(failedTests, null, 2)}\n\nCurrent code:\n${code}\n\nPlease return ONLY the fixed code as plain text, with NO markdown, explanation, or preamble.`;
  let result = code;
  try {
    const res = await callGroq([
      { role: 'system', content: 'You are an expert developer and code fixer.' },
      { role: 'user', content: prompt }
    ], 1200, 'fix');
    // Remove markdown if present
    result = res.replace(/```[a-zA-Z]*|```/g, '').trim();
    // Basic sanity check: must not be empty and must contain some function/exports
    if (!result || result.length < 10) return code;
    return result;
  } catch (e) {
    // On error, return original code
    return code;
  }
}

module.exports = { fixServiceCode };
