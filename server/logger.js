// logger.js — Shared log bus (no circular imports)
import { EventEmitter } from 'events';

const LOG_BUFFER_SIZE = 500;
export const logBus = new EventEmitter();
logBus.setMaxListeners(200);
export const logBuffer = [];

export function logAgent(entry) {
  const e = { ts: Date.now(), type: entry.type || 'info', message: entry.message || '', ...entry };
  logBuffer.push(e);
  if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();
  logBus.emit('entry', e);
}
