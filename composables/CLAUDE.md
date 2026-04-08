# composables/ — TypeScript composables

## Pattern
All composables use Vue 3 Composition API with `ref`/`computed`. They are imported explicitly
in app.vue — Nuxt auto-import is not relied on for these.

## useAgent.ts
Handles chat messages and all agent API calls.
```ts
const { messages, chatInput, sending, send, sendCommand, handleRetry, confirmDelete, cancelAgent } = useAgent()

// send(message, focusIds?, uiSpec?)
//   focusIds: string[] of service ids selected in the Focus dialog
//   uiSpec:   object from UI Prefs dialog | null
//   POSTs { message, focusIds, uiSpec } to /api/chat
//   Pushes user message + system response to messages[]

// cancelAgent() → POST /api/agent/cancel
// confirmDelete(serviceId, groupId) → confirm() + DELETE /api/services/:id
// handleRetry(serviceId) → POST /api/retry/:id
```

## useLogs.ts
Manages SSE connection to /api/logs and log filtering.
```ts
const { logs, filteredLogs, filter, connState, connect, disconnect, clearLogs, setFilter } = useLogs()
// connState: 'connecting'|'connected'|'disconnected'
// filteredLogs: computed — filters logs by type matching filter.value
// LOG_FILTERS = ['all','plan','code','deploy','test','fix','error']
// Auto-reconnects every 3s on error. Call connect() in onMounted.
// Calls disconnect() in onUnmounted automatically.
```

## useServices.ts
Polls /api/services on interval and provides service management.
```ts
const { services, loading, fetchServices, retryService, stopService, startService, deleteService, startPolling, stopPolling } = useServices()
// startPolling(4000) — starts interval + immediate fetch
// stopPolling() — clears interval. Call in onUnmounted.
// stopService(id)  → POST /api/services/:id/stop
// startService(id) → POST /api/services/:id/start
// Service shape: { id, name, type, status, port, groupId, filePath, description }
// status values: 'generating'|'deploying'|'running'|'verified'|'degraded'|'error'|'stopped'
```

## agentBusy (computed in app.vue)
```ts
// Scans logs backwards — true after a 'user' log until a 'done' log arrives
// All dead-end code paths in the agent MUST emit logAgent({ type: 'done', ... })
// cancelCurrentSession() emits done automatically
const agentBusy = computed(() => {
  for (let i = logs.value.length - 1; i >= 0; i--) {
    if (logs.value[i].type === 'done') return false;
    if (logs.value[i].type === 'user') return true;
  }
  return false;
});
```

## agentLiveLogs (computed in app.vue)
```ts
// Last 6 non-user log entries — shown inline in chat while busy
const agentLiveLogs = computed(() => logs.value.filter(e => e.type !== 'user').slice(-6));
```

## LogEntry shape
```ts
{ ts: number, type: string, message: string, data?: any }
// type values: 'plan'|'code'|'deploy'|'test'|'fix'|'error'|'done'|'info'|'user'
```
