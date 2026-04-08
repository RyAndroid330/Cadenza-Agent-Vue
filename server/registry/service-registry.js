// service-registry.js — In-memory service registry with CadenzaDB persistence
import { dbCreateService, dbUpdateService, dbDeleteService } from './cadenza-db-client.js';

const PORT_START = 4100;

class ServiceRegistry {
  constructor() {
    // Map<id, service>
    this.services = new Map();
    this._nextPort = PORT_START;
  }

  allocatePort() {
    // Find highest used port and go above it
    let max = PORT_START - 1;
    for (const svc of this.services.values()) {
      if (svc.port && svc.port > max) max = svc.port;
    }
    return max + 1;
  }

  async registerService(svc) {
    if (!svc.port) svc.port = this.allocatePort();
    this.services.set(svc.id, svc);
    const persisted = this._toPersist(svc);
    try { await dbCreateService(persisted); } catch (e) {
      console.error('[Registry] DB create failed:', e.message);
    }
    return svc;
  }

  async updateService(id, updates) {
    const svc = this.services.get(id);
    if (!svc) return null;
    Object.assign(svc, updates);
    const persisted = this._toPersist(svc);
    try { await dbUpdateService(id, persisted); } catch (e) {
      console.error('[Registry] DB update failed:', e.message);
    }
    return svc;
  }

  async removeService(id) {
    const svc = this.services.get(id);
    if (svc) {
      this._killProc(svc);
      this.services.delete(id);
      try { await dbDeleteService(id); } catch (e) {
        console.error('[Registry] DB delete failed:', e.message);
      }
    }
  }

  getService(id) {
    return this.services.get(id);
  }

  getAllServices() {
    return Array.from(this.services.values());
  }

  getServicesByGroup(groupId) {
    return this.getAllServices().filter(s => s.groupId === groupId);
  }

  _killProc(svc) {
    if (svc.proc) {
      try { svc.proc.kill(); } catch {}
      svc.proc = null;
    }
  }

  // Strip runtime-only fields before persisting
  _toPersist(svc) {
    const { proc, code, fixHistory, _plan, _codeModel, _cachedSchema, ...rest } = svc;
    return rest;
  }
}

const registry = new ServiceRegistry();
export default registry;
