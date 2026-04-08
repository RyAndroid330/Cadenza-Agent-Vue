// agent-graph.js — Wires all tasks into the cadenza signal graph
import cadenza from './cadenza-core.js';
import { cancelCurrentSession } from './session.js';

import { interpretPlanTask } from './tasks/task-interpret.js';
import { dispatchDeployTask } from './tasks/task-dispatch.js';
import { retryServiceTask } from './tasks/task-retry.js';
import { deleteGroupTask, reactivateGroupTask, analyzeSelfTask, rollbackTask } from './tasks/task-manage.js';
import { runTestsTask, fixCodeTask } from './tasks/task-run-fix.js';

const { userBroker, registerTask } = cadenza;

registerTask(interpretPlanTask);
registerTask(dispatchDeployTask);
registerTask(retryServiceTask);
registerTask(deleteGroupTask);
registerTask(reactivateGroupTask);
registerTask(analyzeSelfTask);
registerTask(rollbackTask);
registerTask(runTestsTask);
registerTask(fixCodeTask);

export { userBroker, cancelCurrentSession };
