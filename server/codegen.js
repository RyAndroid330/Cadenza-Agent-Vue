// Groq-powered code generation utility
const { callGroq } = require('./llm-groq');
const fs = require('fs');
const path = require('path');

const DEPLOY_DIR = path.join(__dirname, '../deployed');
if (!fs.existsSync(DEPLOY_DIR)) fs.mkdirSync(DEPLOY_DIR);

async function generateServiceCode(service, plan) {
  const prompt = [
    { role: 'system', content: `You are a code generator. Given a service description, generate a complete Node.js Express backend, HTML frontend, or in-memory DB service as required. Output ONLY the code, no explanations.` },
    { role: 'user', content: `Service type: ${service.type}\nService name: ${service.name}\nDescription: ${service.description}\nPlan: ${plan.description}` }
  ];
  const code = await callGroq(prompt, 2048);
  return code;
}

function writeServiceFile(service, code) {
  const ext = service.type === 'frontend' ? '.html' : '.js';
  const fileName = `${service.name.replace(/\s+/g, '_').toLowerCase()}_${service.id}${ext}`;
  const filePath = path.join(DEPLOY_DIR, fileName);
  fs.writeFileSync(filePath, code);
  return filePath;
}

module.exports = { generateServiceCode, writeServiceFile };
