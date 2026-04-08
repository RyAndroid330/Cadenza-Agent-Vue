# Cadenza Agent — Project Root

## What this is
Self-expanding LLM agent. User sends a natural language request → agent plans → generates Node.js/HTML service code → deploys as child process → tests → auto-fixes → reports. Built in Nuxt 4 + Vue 3 frontend, Express ESM backend.

## Start
```
npm start          # parallel: nuxt dev (port 3000) + node server/index.js (port 3010)
```
Nuxt proxies `/api/*` → `localhost:3010`. Backend spawns CadenzaDB child on port 3001.

## Repo layout
```
/app/app.vue              # single page — tabs + chat sidebar
/composables/             # useAgent.ts  useLogs.ts  useServices.ts
/components/
  AgentChat.vue           # chat sidebar with focus, feature, and UI prefs dialogs
  StatusConn.vue          # SSE dot indicator
  tabs/                   # TabServices  TabLogs  TabStats  TabMap  TabCadenzaDB
/public/style.css         # full dark theme — edit here, not in components
/server/                  # see server/CLAUDE.md
/deployed/                # LLM-generated .cjs and .html files land here
/deployed/specs/          # compact .md spec files written after each service verifies
/cadenza-data.json        # CadenzaDB persistence (services, plans, kv)
```

## Hard rules
- Backend is **ESM** (`server/package.json` has `"type":"module"`) — use `import/export`
- Deployed services are **CommonJS** (`.cjs`) — use `require()`
- Deployed services may ONLY `require('express')` — no external DB drivers
- All data in deployed services must use **in-memory** JS objects/arrays/Maps
- Never `import` from `./index.js` in other server files — use `./logger.js` instead (circular dep)
- Clear `/cadenza-data.json` and `/deployed/*.cjs|html` when resetting a crashed run

## CSS variables (dark theme)
```
--bg:#080b10  --surface:#0e1318  --panel:#111820  --border:#1e2a35
--accent:#3de0a0  --purple:#8b6dff  --amber:#ffb340  --red:#ff4d6a  --blue:#3db8ff
--font-mono:'JetBrains Mono'  --font-ui:'Syne'
```

## Active Groq models (verified 2026-04-01 via /openai/v1/models)
10 text-generation models in rotation. Untested models get random 0.4–0.6 score. 429s = failures.
```
openai/gpt-oss-120b
llama-3.3-70b-versatile
meta-llama/llama-4-scout-17b-16e-instruct
moonshotai/kimi-k2-instruct
moonshotai/kimi-k2-instruct-0905
qwen/qwen3-32b
openai/gpt-oss-20b
groq/compound
groq/compound-mini
llama-3.1-8b-instant
```
Dead/removed: llama-4-maverick, qwen-qwq-32b, deepseek-r1-distill-llama-70b, compound-beta, compound-beta-mini, mistral-saba-24b, llama-3.1-70b-specdec, llama3-groq-70b-8192-tool-use-preview, llama3-70b-8192, llama3-8b-8192, gemma2-9b-it, mixtral-8x7b-32768

## Known fixes applied
- `cconst` prefix bug → `cleanCode()` strips leading garbage using JS_START regex
- `<think>...</think>` blocks → stripped at top of `cleanCode()` before any parsing (qwen3 etc.)
- Frontend `<` anchor bug → `cleanCode()` searches for `<!doctype html` not first `<`
- Circular import → logAgent lives in logger.js not index.js
- Rate limit 429 → parse "try again in Xs", sleep + 500ms, try next model
- Services deploy sequentially: db → backend → frontend (each waits for previous + passes port context)
- Backend proxy → LLM must hardcode DB URL as string literal; no globalThis/process.env
- Backend proxy validation → backend must NOT add its own field validation; forward body as-is to DB
- Service targeting → use original `message` (not `plan.description`) as hint fallback in task-interpret
- Fix/modify targeting → UI keywords ("light","dark","theme","mode") score as frontend-only changes
- DB schema injected before backend codegen → `service-pipeline.js` fetches live `/schema` first
- Test suite size → capped at 6–8 tests, anchored to live `/schema` routes (not guessed paths)
- `contextHint` threaded through fix loops → `diagnoseAndFix` receives DB URL context on every attempt
- `[UI_SPEC]` block → stripped from message before intent LLM sees it; only injected into frontend codegen
