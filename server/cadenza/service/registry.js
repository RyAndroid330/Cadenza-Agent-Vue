// Service registry for tracking all running services, ports, status, retries, etc.


const { load, save } = require('../../storage');
const SERVICES_KEY = 'services';


const { spawn } = require('child_process');

const registry = {
  services: load(SERVICES_KEY, []),
  modelStats: {}, // { [model]: { [type]: { success: n, fail: n } } }

  // Add a new service and optionally spawn its process
  add(service, spawnProcess = false) {
    if (spawnProcess && service.type !== 'frontend' && service.filePath) {
      service.proc = this._spawnServiceProcess(service);
    }
    this.services.push(service);
    save(SERVICES_KEY, this.services);
  },

  // Update a service and optionally restart its process
  update(id, updates, restartProcess = false) {
    const svc = this.services.find(s => s.id === id);
    if (svc) {
      Object.assign(svc, updates);
      if (restartProcess && svc.type !== 'frontend' && svc.filePath) {
        this.stopProcess(svc);
        svc.proc = this._spawnServiceProcess(svc);
      }
      save(SERVICES_KEY, this.services);
    }
  },

  // Remove a service and kill its process if running
  remove(id) {
    const idx = this.services.findIndex(s => s.id === id);
    if (idx !== -1) {
      const svc = this.services[idx];
      this.stopProcess(svc);
      this.services.splice(idx, 1);
      save(SERVICES_KEY, this.services);
    }
  },

  // Get a service by id
  get(id) {
    return this.services.find(s => s.id === id);
  },

  // Get all services
  all() {
    return this.services;
  },

  // Stop a service's process if running
  stopProcess(service) {
    if (service && service.proc && service.proc.kill) {
      try { service.proc.kill(); } catch {}
      service.proc = null;
    }
  },

  // Restart a service's process
  restartProcess(service) {
    this.stopProcess(service);
    if (service.type !== 'frontend' && service.filePath) {
      service.proc = this._spawnServiceProcess(service);
    }
  },

  // Internal: spawn a child process for a service
  _spawnServiceProcess(service) {
    try {
      const proc = spawn('node', [service.filePath], { stdio: 'inherit' });
      return proc;
    } catch (e) {
      return null;
    }
  },

  // Retry a degraded service (reset retries, restart process)
  retry(id) {
    const svc = this.get(id);
    if (svc) {
      svc.retries = (svc.retries || 0) + 1;
      this.restartProcess(svc);
      save(SERVICES_KEY, this.services);
    }
  },

  updateModelStat(model, type, success) {
    if (!this.modelStats[model]) this.modelStats[model] = {};
    if (!this.modelStats[model][type]) this.modelStats[model][type] = { success: 0, fail: 0 };
    if (success) this.modelStats[model][type].success++;
    else this.modelStats[model][type].fail++;
  },

  getBestModel(type, fallback) {
    // Return model with highest success rate for this type, fallback if none
    let best = fallback, bestRate = -1;
    for (const [model, stats] of Object.entries(this.modelStats)) {
      if (stats[type]) {
        const { success, fail } = stats[type];
        const total = success + fail;
        if (total >= 3) { // Only consider if at least 3 attempts
          const rate = success / total;
          if (rate > bestRate) {
            best = model;
            bestRate = rate;
          }
        }
      }
    }
    return best;
  }
};

module.exports = registry;
