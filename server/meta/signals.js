// Meta-layer signals and event bus for agent workflow
const { EventEmitter } = require('events');

// Central event bus for all agent signals
const signalBus = new EventEmitter();

// Signal constants
const SIGNALS = {
  REQUEST_RECEIVED: 'agent.request_received',
  PLAN_READY: 'meta.plan.ready',
  SERVICE_DEPLOY: 'meta.service.deploy',
  SERVICE_VERIFIED: 'meta.service.verified',
  SERVICE_FIX_NEEDED: 'meta.service.fix_needed',
  GROUP_DONE: 'meta.group.done',
};

module.exports = { signalBus, SIGNALS };
