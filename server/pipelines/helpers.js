// pipelines/helpers.js — Shared utilities: schema fetch, service resolver, change classifier
import registry from '../registry/service-registry.js';

// Fetch /schema from a running service and return its route list
export async function fetchServiceSchema(port) {
  try {
    const fetch = (await import('node-fetch')).default;
    const res = await fetch(`http://localhost:${port}/schema`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const data = await res.json();
    const routes = Array.isArray(data) ? data : (data.routes || []);
    return routes
      .filter(r => r.path !== '/health' && r.path !== '/schema')
      .map(r => `${r.method || 'GET'} ${r.path}`);
  } catch { return null; }
}

// Resolve a hint string → array of service objects (exact id, groupId, or fuzzy name)
export function resolveServices(hint) {
  const all = registry.getAllServices();
  let services = all.filter(s => s.id === hint);
  if (!services.length) services = registry.getServicesByGroup(hint);
  if (!services.length) {
    const stopwords = ['the','and','for','fix','test','retry','service','services','group','delete','remove','stop','start','reactivate'];
    const words = (hint || '').toLowerCase().replace(/[_\s-]+/g, ' ').trim().split(' ')
      .filter(w => w.length > 2 && !stopwords.includes(w));
    if (words.length) {
      const matched = all.filter(s =>
        words.some(w => (s.name || '').toLowerCase().replace(/[_\s-]/g, '').includes(w))
      );
      if (matched.length) {
        const groupIds = [...new Set(matched.map(s => s.groupId))];
        services = all.filter(s => groupIds.includes(s.groupId));
      }
    }
  }
  return services;
}

// Classify which service layer a change description targets
// Returns 'frontend' | 'data' | 'all'
export function classifyChangeTarget(description) {
  const d = (description || '').toLowerCase();
  const uiHits = ['visible', 'display', 'show', 'appear', 'render', 'style', 'color', 'layout',
    'button', 'click', 'ui', 'interface', 'page', 'list', 'table', 'form', 'input', 'text',
    'font', 'css', 'html', 'design', 'screen', 'view', 'icon', 'label', 'empty', 'blank',
    'light', 'dark', 'theme', 'mode', 'appearance', 'color scheme', 'styling', 'responsive',
    'mobile', 'animation', 'transition', 'modal', 'dialog', 'dropdown', 'tooltip', 'navbar']
    .filter(k => d.includes(k)).length;
  const dataHits = ['save', 'store', 'persist', 'database', 'api', 'endpoint', 'route',
    'field', 'validation', 'require', 'schema', 'query', 'filter', 'sort', 'search',
    'auth', 'login', 'permission', 'data', 'record', 'entry']
    .filter(k => d.includes(k)).length;
  if (uiHits > dataHits) return 'frontend';
  if (dataHits > uiHits) return 'data';
  // Tie or no keywords: default to frontend — the user sees it first and it's most likely broken
  return 'frontend';
}
