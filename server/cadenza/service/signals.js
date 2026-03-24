// Central event bus and signal constants for agent meta-layer

// Advanced signal bus with namespaced signals and wildcard listeners
class SignalBus {
  constructor() {
    this.listeners = {};
    this.wildcardListeners = [];
    this.history = [];
  }

  on(signal, fn) {
    if (signal === '*') {
      this.wildcardListeners.push(fn);
    } else {
      if (!this.listeners[signal]) this.listeners[signal] = [];
      this.listeners[signal].push(fn);
    }
  }

  emit(signal, payload) {
    this.history.push({ signal, payload, ts: Date.now() });
    // Exact listeners
    if (this.listeners[signal]) {
      for (const fn of this.listeners[signal]) {
        try { fn(payload); } catch (e) { console.error('[signalBus]', e); }
      }
    }
    // Wildcard listeners
    for (const fn of this.wildcardListeners) {
      try { fn(signal, payload); } catch (e) { console.error('[signalBus]', e); }
    }
  }

  getHistory() {
    return this.history;
  }
}

const signalBus = new SignalBus();

const SIGNALS = {
  REQUEST_RECEIVED: 'agent.request_received',
  PLAN_READY: 'meta.plan.ready',
  SERVICE_DEPLOY: 'meta.service.deploy',
  SERVICE_VERIFIED: 'meta.service.verified',
  SERVICE_FIX_NEEDED: 'meta.service.fix_needed',
  GROUP_DONE: 'meta.group.done',
};

module.exports = { signalBus, SIGNALS };
