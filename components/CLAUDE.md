# components/ — Vue 3 SFCs

## Pattern
All components use `<script setup>` (no lang="ts" — Nuxt auto-imports handle typing).
`nuxt.config.ts` sets `pathPrefix: false` so all components resolve by filename regardless of folder.
`app.vue` explicitly imports all components to guarantee resolution.

## Component map
```
AgentChat.vue
  props: messages[], chatInput, busy, liveLogs, services[]
  emits: send(text, focusIds[], uiSpec|null), update:chatInput(val), cancel

StatusConn.vue
  props: state ('connecting'|'connected'|'disconnected')

tabs/
  TabServices.vue   props: services[], host        emits: retry(svc), stop(svc), start(svc), delete(svc)
  TabLogs.vue       props: logs[], filter          emits: setFilter(f), clear
  TabStats.vue      props: stats (object keyed by model name → {plan,code,test,fix:{success,fail}})
  TabMap.vue        props: tasks[], services[]     canvas force-directed graph, pan/zoom/drag
  TabCadenzaDB.vue  props: health, services[], plans[], error, host   emits: refresh
```

## AgentChat.vue — dialogs and state
Three Teleport dialogs, each independent:

**Focus dialog** (`focusOpen`)
- Opens via ⊙ button in input area or badge in title
- Groups services by groupId, shows group checkbox (with indeterminate) + per-service checkboxes
- Type dot colours: frontend=blue, backend=purple, db=amber
- Selected ids stored in `focusedIds` (Set) — sent as second arg to `send`
- Badge `⊙ N` shown in title when any selected

**Feature dialog** (`featureOpen`)
- Triggered automatically on send when `/api/suggest-features` returns `{ isNew: true }`
- Shows LLM-suggested features pre-checked/unchecked; custom inputs grow as user types
- "Next: UI →" button when UI Auto is OFF; "Build it ➤" when UI Auto is ON

**UI Preferences dialog** (`uiPrefOpen`)
- Only shown when **UI Auto toggle is OFF** (manual mode)
- Sections: Layout checkboxes, Theme radio + switcher, Style checkboxes, Corners/Font selects, Color swatches
- Color swatches: native `<input type="color">` hidden behind a styled preview div
- On approve: builds structured `uiSpec` object (never appended to message text) and emits it as third send arg
- "Skip" sends without UI spec

**UI Auto toggle**
- Pill button in sidebar title — green when auto (default), grey when manual
- Auto ON: feature dialog → build immediately
- Auto OFF (new app): feature dialog → UI prefs dialog → build
- Auto OFF (non-new): no feature dialog, no UI prefs for fix/edit requests

## Send flow (AgentChat.vue handleSend)
```
1. POST /api/suggest-features { message }
2a. isNew + features → show feature dialog
2b. isNew + no features + UI manual → show UI prefs dialog
2c. not new → emit send directly (skip both dialogs)
3. Feature dialog approved → pendingMessage updated with feature list
   UI Auto ON  → emit('send', msg, focusIds, null)
   UI Auto OFF → open UI prefs dialog
4. UI prefs approved → emit('send', msg, focusIds, uiSpec)
```

## uiSpec object shape
```js
{
  layout: ['Navigation bar', 'Header / hero', ...],  // from layoutOpts checkboxes
  defaultTheme: 'dark' | 'light',
  themeSwitcher: true | false,
  style: ['Animations & transitions', 'Responsive / mobile-friendly', ...],
  corners: 'sharp' | 'rounded' | 'pill',
  font: 'mono' | 'sans' | 'serif',
  colors: { bg, surface, accent, secondary, text, border } | null
}
```
Sent as separate POST field. Stripped from message before intent LLM; injected only into frontend codegen prompt.

## TabStats data shape (from /api/model-stats)
```js
{ "llama-3.3-70b-versatile": { "plan": { success: 4, fail: 1 }, "code": {...} }, ... }
```

## TabMap
Canvas 2D — nodes drawn as circles (tasks) or rectangles (services/signals).
Colors: tasks=var(--accent), signals=var(--purple), services=var(--blue).
Rebuilt on prop change via watch + nextTick. Resize on window resize.

## CSS classes to use (from public/style.css)
```
.services-panel  .service-card  .svc-header  .svc-name  .svc-desc
.svc-type-badge .badge-frontend .badge-backend .badge-db
.svc-status  .status-indicator  .s-verified .s-running .s-degraded .s-error .s-stopped
.action-btn  .btn-retry  .btn-delete  .model-picker
.log-toolbar  .log-filter-btn.on  .log-stream  .log-entry  .log-ts  .log-type
.lt-plan .lt-code .lt-deploy .lt-test .lt-fix .lt-error .lt-done .lt-info
.graph-panel  .graph-section-title  .stats-table  .score-bar  .score-fill
.fill-accent .fill-amber .fill-red
.empty-state  .empty-icon
```

## Do not
- Do not add `<style scoped>` blocks to tab components — use global classes from public/style.css
- AgentChat.vue uses `<style scoped>` because it has its own isolated dialog styling
- Do not import composables inside tab components — app.vue passes data as props
- Do not use Options API — always `<script setup>`
