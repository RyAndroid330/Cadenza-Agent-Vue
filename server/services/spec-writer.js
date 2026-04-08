// spec-writer.js — Write/read compact markdown specs for verified services
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPECS_DIR = path.join(__dirname, '..', '..', 'deployed', 'specs');

function ensureSpecsDir() {
  if (!fs.existsSync(SPECS_DIR)) fs.mkdirSync(SPECS_DIR, { recursive: true });
}

// Build a compact markdown spec from a verified service object
export function buildSpec(svc) {
  const lines = [
    `# ${svc.name} (${svc.type})`,
    `Description: ${svc.description}`,
    `Port: ${svc.port}`,
  ];

  if (svc.schema?.length) {
    lines.push('', '## Routes');
    svc.schema.forEach(r => lines.push(`- ${r}`));
  }

  // Extract field info from route code heuristically
  if (svc._routeCode) {
    const fieldMatches = [...svc._routeCode.matchAll(/\{[^}]*\bid:\s*nextId\+\+[^}]*\}/g)];
    const constMatches = [...svc._routeCode.matchAll(/const\s+(\w+)\s*=\s*\[\s*\]/g)];
    if (constMatches.length) {
      lines.push('', '## Data Stores');
      constMatches.forEach(m => lines.push(`- ${m[1]} (array)`));
    }
    // Extract required field validation
    const reqMatches = [...svc._routeCode.matchAll(/!body\.(\w+)[^)]*return\s*\[400/g)];
    if (reqMatches.length) {
      lines.push('', '## Required Fields on POST');
      reqMatches.forEach(m => lines.push(`- ${m[1]}`));
    }
  }

  return lines.join('\n');
}

// Write spec to disk; attach _specPath to service object
export function writeSpec(svc) {
  ensureSpecsDir();
  const spec = buildSpec(svc);
  const specPath = path.join(SPECS_DIR, `${svc.id}.md`);
  fs.writeFileSync(specPath, spec, 'utf-8');
  svc._specPath = specPath;
  svc._spec = spec;
  return spec;
}

// Read spec from disk (or use cached _spec on service object)
export function readSpec(svc) {
  if (svc._spec) return svc._spec;
  const specPath = svc._specPath || path.join(SPECS_DIR, `${svc.id}.md`);
  try { return fs.readFileSync(specPath, 'utf-8'); } catch { return null; }
}
