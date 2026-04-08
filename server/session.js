// session.js — Cancellation flag and session state for the current agent run
import { logAgent } from './logger.js';

let _cancelled = false;

export function cancelCurrentSession() {
  _cancelled = true;
  logAgent({ type: 'done', message: 'Agent cancelled by user' });
}

export function startSession() {
  _cancelled = false;
}

export function isCancelled() {
  return _cancelled;
}
