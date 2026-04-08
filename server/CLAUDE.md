# server/ — Backend (ESM, port 3010)

## File map
```
index.js                     # entry: CadenzaDB, agent graph, Express API
logger.js                    # shared logAgent() + logBus EventEmitter — import this, not index.js
cadenza-core.js              # SignalBroker, GraphRegistry, Task, Routine, createCadenza()
cadenza-db.js                # child process on port 3001, persists to /cadenza-data.json
agent-graph.js               # thin wiring file — imports all tasks, registers them, exports userBroker
session.js                   # cancelCurrentSession(), startSession(), isCancelled()

services/
  llm-brain.js               # barrel re-export of all llm-*.js modules
  llm-caller.js              # callLLM(), MODELS list, ranked model fallback + 429 handling
  llm-intent.js              # interpretRequest(), suggestFeatures()
  llm-codegen.js             # generateServiceCode(), cleanCode(), ROUTER_API_DOCS(_ASYNC)
  llm-tests.js               # generateTests() — fetches live /schema, keeps suite ≤8 tests
  llm-fix.js                 # diagnoseAndFix(), modifyServiceCode(), planSelfModification(), generateSelfModification()
  deployer.js                # writeServiceFile(), spawnService(), killService(), waitForHealth(), validateServiceCode()
  test-runner.js             # runTests() — HTTP tests against live port, returns {passed, failed}
  spec-writer.js             # writeSpec(), readSpec() — compact .md snapshots in /deployed/specs/
  self-modifier.js           # applySelfModification(), rollbackToSnapshot(), listSnapshots()

pipelines/
  helpers.js                 # fetchServiceSchema(), resolveServices(), classifyChangeTarget()
  service-pipeline.js        # runServicePipeline() — full codegen→deploy→test→fix loop
  modify-pipeline.js         # runModifyPipeline() — spec-based targeted edit + fix loop

tasks/
  task-interpret.js          # interpretPlanTask (doOn: request_received) — strips [UI_SPEC], routes intents
  task-dispatch.js           # dispatchDeployTask (doOn: dispatch) — db→backend→frontend order
  task-retry.js              # retryServiceTask (doOn: retry_service) — retry failed or modify verified
  task-manage.js             # deleteGroupTask, reactivateGroupTask, analyzeSelfTask, rollbackTask
  task-run-fix.js            # runTestsTask, fixCodeTask (signal-triggered manual retry path)

registry/
  service-registry.js        # in-memory Map<id,svc>, allocatePort() starts at 4100
  cadenza-db-client.js       # dbFetch/Create/Update/Delete/UpsertPlan, rehydrateRegistry()
  model-stats.js             # recordSuccess/Failure(), getRankedModelIndices() — persists to CadenzaDB /kv
```

## Signal flow
```
POST /api/chat { message, focusIds?, uiSpec? }
  → index.js: prepends [Focus:...], appends [UI_SPEC]:...
  → userBroker.emit('request_received', enrichedMessage)
    → task-interpret.js
        strips [UI_SPEC] block → stores as plan.uiSpec (never seen by intent LLM)
        strips [Focus:...] → LLM sees clean user message + existing service list
        → intent 'new'         → emit('dispatch', plan)
        → intent 'fix'         → emit('retry_service', {hint, description})
        → intent 'delete'      → emit('delete_group', hint)
        → intent 'reactivate'  → emit('reactivate_group', hint)
        → intent 'self_modify' → emit('self_modify', message)
        → intent 'rollback'    → emit('rollback', snapshotId)
    → task-dispatch.js (new builds)
        ordered: db → backend → frontend
        each: runServicePipeline(svc, completedServices)
          DB schema fetched from live /schema before backend codegen
          contextHint (DB URL + routes) passed to LLM and all fix attempts
          plan.uiSpec injected into frontend system prompt only
          fix loop max 10: diagnoseAndFix → respawn → runTests
          on verify: writeSpec() → /deployed/specs/{id}.md
    → task-retry.js (fix/edit existing)
        resolveServices(hint) — exact id → groupId → fuzzy name words
        classifyChangeTarget() → 'frontend' | 'data' | 'all'
        failed services → runServicePipeline
        verified + change → runModifyPipeline (spec + contextHint + targeted LLM edit)
```

## API endpoints (index.js)
```
GET  /api/logs                    SSE stream (500-entry buffer, heartbeat 15s)
POST /api/chat                    { message, focusIds?, uiSpec? } → request_received
GET  /api/services                registry stripped of proc/code/_plan
DEL  /api/services/:id            emits delete_group
POST /api/services/:id/stop       kills process, marks stopped
POST /api/services/:id/start      spawns process, marks running
POST /api/retry/:id               emits retry_service
POST /api/agent/cancel            cancelCurrentSession() → emits done log
POST /api/suggest-features        { message } → suggestFeatures() → {isNew, appType, features[]}
GET  /api/snapshots               listSnapshots()
POST /api/snapshots/:id/rollback  rollbackToSnapshot(id)
GET  /api/plans                   proxied from CadenzaDB
GET  /api/graph                   cadenza.registry.export()
GET  /api/model-stats             getAllStats()
GET  /api/db/health               proxied from CadenzaDB :3001/health
```

## Codegen constraints
- `db` type: router API (sync handlers), in-memory arrays, CORS via scaffold, `/health` + `/schema` built-in
- `backend` type: router API (async handlers when DB context exists), hardcoded DB URL string, NO own validation
- `frontend` type: single HTML file starting with `<!DOCTYPE html>`, fetch() to backend, plan.uiSpec applied
- `cleanCode()`: strips `<think>` blocks first, then markdown fences, JS_START strips leading garbage
- `contextHint`: lists deployed siblings with ports + live routes — passed to codegen AND all fix attempts
- `plan.uiSpec`: layout, defaultTheme, themeSwitcher, style[], corners, font, colors{} — frontend only

## Backend proxy rules (critical)
- DB URL must be a **hardcoded string literal**: `const DB = 'http://localhost:PORT';`
- Never use `globalThis`, `process.env`, or any variable to hold the URL
- Do NOT add field validation in the backend — forward body as-is to DB, return `[r.status, await r.json()]`
- Use exact route paths from DB's `/schema` routes list

## Self-modification
- Snapshot stored in `server/backups/snapshots/snap_{ts}/` with `_manifest.json`
- Flow: plan → read files → snapshot → write → syntax check → smoke test port 3099 → commit or rollback
- Keep last 5 snapshots; `MODIFIABLE_FILES` lists all 22 server + frontend files
- Rollback: `POST /api/snapshots/:id/rollback` or chat "rollback snap_..."

## CadenzaDB (cadenza-db.js)
- Runs as IPC child process, sends 'ready' message when listening
- Tables: services[], plans[], kv{} key-value store
- Persists to `/cadenza-data.json` at project root
- rehydrateRegistry() on startup marks all services status:'stopped'

## Deployed files
- Written to `/deployed/` as `{type}_{name}_{id}.cjs` or `.html`
- `/deployed/package.json` has `"type":"commonjs"` so .cjs files work
- NODE_PATH set to `server/node_modules` in all spawn calls
- Port: registry.allocatePort() → max existing + 1 (floor 4100)
- Frontend HTML gets a companion `_server.cjs` (http.createServer wrapper) for the port to be live
- waitForHealth() polls GET /health → {"ok":true} — all services must expose this
- Spec files written to `/deployed/specs/{id}.md` after verification for use by modify pipeline
