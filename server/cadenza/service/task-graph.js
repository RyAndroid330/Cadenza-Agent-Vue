
// Advanced task graph for meta-layer orchestration
const { signalBus, SIGNALS } = require('./signals');

const taskGraph = {
  tasks: {}, // { signal: [taskFn, ...] }
  register(signal, fn) {
    if (!this.tasks[signal]) this.tasks[signal] = [];
    this.tasks[signal].push(fn);
    signalBus.on(signal, fn);
  },
  registerWildcard(fn) {
    signalBus.on('*', fn);
  },
  getGraph() {
    // Return a summary of the task graph for introspection
    return Object.entries(this.tasks).map(([signal, fns]) => ({ signal, count: fns.length }));
  }
};

function registerAgentTasks(tasks) {
  // Register core workflow tasks
  taskGraph.register(SIGNALS.PLAN_READY, tasks.deployServices);
  taskGraph.register(SIGNALS.SERVICE_DEPLOY, tasks.runServiceTests);
  taskGraph.register(SIGNALS.SERVICE_FIX_NEEDED, ({ service, failedTests }) => tasks.fixService(service, failedTests));
  taskGraph.register(SIGNALS.GROUP_DONE, tasks.finishGroup);
}

module.exports = { registerAgentTasks, taskGraph };
