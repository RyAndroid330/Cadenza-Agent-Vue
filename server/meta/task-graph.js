// Meta-layer task graph wiring for agent workflow
const { signalBus, SIGNALS } = require('./signals');

// Register all tasks and their signal subscriptions here
function registerAgentTasks(tasks) {
  // Example: subscribe to plan ready, then deploy services
  signalBus.on(SIGNALS.PLAN_READY, plan => {
    tasks.deployServices(plan);
  });

  // Example: subscribe to service deploy, then run tests
  signalBus.on(SIGNALS.SERVICE_DEPLOY, service => {
    tasks.runServiceTests(service);
  });

  // Example: subscribe to test results, trigger fix if needed
  signalBus.on(SIGNALS.SERVICE_FIX_NEEDED, ({ service, failedTests }) => {
    tasks.fixService(service, failedTests);
  });

  // Example: subscribe to all services verified, mark group done
  signalBus.on(SIGNALS.GROUP_DONE, groupId => {
    tasks.finishGroup(groupId);
  });
}

module.exports = { registerAgentTasks };
