// cadenza-core.js — Signal broker, task graph engine, Cadenza factory
import { EventEmitter } from 'events';

// ── Signal Broker ──────────────────────────────────────────────────────────────
export class SignalBroker {
  constructor(namespace) {
    this.ns = namespace;
    this._ee = new EventEmitter();
    this._ee.setMaxListeners(100);
  }
  subscribe(signal, handler) {
    this._ee.on(`${this.ns}.${signal}`, handler);
  }
  emit(signal, payload) {
    this._ee.emit(`${this.ns}.${signal}`, payload);
  }
  once(signal, handler) {
    this._ee.once(`${this.ns}.${signal}`, handler);
  }
}

// ── Graph Registry ─────────────────────────────────────────────────────────────
export class GraphRegistry {
  constructor() {
    this._tasks = new Map();
  }
  registerTask(task) {
    this._tasks.set(task.name, task);
  }
  getTask(name) {
    return this._tasks.get(name);
  }
  export() {
    const out = [];
    for (const t of this._tasks.values()) {
      out.push({
        name: t.name,
        on: t._on,
        emits: t._emits,
        then: t._then
      });
    }
    return out;
  }
}

// ── Task ───────────────────────────────────────────────────────────────────────
export class Task {
  constructor(name, fn) {
    this.name = name;
    this._fn = fn;
    this._on = null;
    this._emits = [];
    this._then = null;
    this._broker = null;
    this._registry = null;
  }
  doOn(signal) { this._on = signal; return this; }
  emits(signal) { this._emits.push(signal); return this; }
  then(taskName) { this._then = taskName; return this; }
  _attach(broker, registry) {
    this._broker = broker;
    this._registry = registry;
    if (this._on) {
      broker.subscribe(this._on, async (payload) => {
        await runnerExec(this, payload, broker, registry);
      });
    }
    registry.registerTask(this);
  }
}

// ── Routine (parallel task group) ──────────────────────────────────────────────
export class Routine {
  constructor(name, tasks) {
    this.name = name;
    this._tasks = tasks;
  }
  _attach(broker, registry) {
    for (const t of this._tasks) t._attach(broker, registry);
  }
}

// ── Runner / Executor ──────────────────────────────────────────────────────────
export async function runnerExec(task, payload, broker, registry) {
  const emitResults = [];
  const ctx = {
    emit(signal, data) {
      emitResults.push({ signal, data });
    }
  };
  let result;
  try {
    result = await task._fn(payload, ctx);
  } catch (e) {
    // Errors are handled in task functions; log but don't crash the broker
    console.error(`[Task:${task.name}] Error:`, e.message);
    return;
  }
  // Emit declared signals
  for (const sig of task._emits) {
    broker.emit(sig, result);
  }
  // Emit any ctx.emit() calls
  for (const { signal, data } of emitResults) {
    broker.emit(signal, data);
  }
  // Chain to next task if declared
  if (task._then) {
    const next = registry.getTask(task._then);
    if (next) await runnerExec(next, result, broker, registry);
  }
}

// ── Cadenza Factory ────────────────────────────────────────────────────────────
export function createCadenza() {
  const userBroker = new SignalBroker('user');
  const metaBroker = new SignalBroker('meta');
  const registry = new GraphRegistry();

  function registerTask(task) {
    task._attach(userBroker, registry);
  }
  function registerMetaTask(task) {
    task._attach(metaBroker, registry);
  }
  function registerRoutine(routine) {
    routine._attach(userBroker, registry);
  }

  return { userBroker, metaBroker, registry, registerTask, registerMetaTask, registerRoutine };
}

// Singleton
const cadenza = createCadenza();
export default cadenza;
