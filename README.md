
# Cadenza-Agent Nuxt Migration

This project is a Nuxt 3 (Vue 3) migration of the original Cadenza-Agent app. It provides a modern UI and connects to the backend agent logic.

## Features
- Agent chat: Describe what you want to build, and the agent will plan, generate, deploy, and test services.
- Live logs: Real-time log streaming from the backend via SSE.
- Services tab: View, retry, and delete deployed services.
- Stats, Map, and CadenzaDB tabs: Visualize model performance, task graph, and database state.

## Usage
1. Start the backend (original Cadenza-Agent Express server) and CadenzaDB if not already running.
2. Install dependencies:
	```bash
	npm install
	```
3. Start the Nuxt development server:
	```bash
	npm run dev
	```
4. Open the app in your browser (see terminal for port, e.g. http://localhost:3001/).
5. Use the chat to request new apps/services. Watch logs and tabs for progress.

## Backend API Endpoints
- `POST /api/chat` — Send chat messages to the agent
- `GET /api/services` — List all deployed services
- `POST /api/retry/:serviceId` — Retry a failed service
- `GET /api/logs` — Live log stream (SSE)
- `GET /api/graph` — Task graph
- `GET /api/model-stats` — Model stats
- `http://localhost:3001/health` — CadenzaDB health
- `http://localhost:3001/services` — CadenzaDB services
- `http://localhost:3001/plans` — CadenzaDB plans

## Project Structure
- `app/app.vue` — Main layout, tab logic, chat, and backend integration
- `components/tabs/` — Tab components for logs, services, stats, map, and CadenzaDB

## Notes
- Requires Node.js 20.x+
- Backend must be running for full functionality

---
Original Nuxt instructions below:


