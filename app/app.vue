<template>
  <Head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@400;600;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/style.css" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Cadenza Agent: Self-expanding LLM system for autonomous service generation and management." />
    <meta name="theme-color" content="#181c20" />
    <meta property="og:title" content="Cadenza Agent" />
    <meta property="og:description" content="Self-expanding LLM system for autonomous service generation and management." />
    <meta property="og:type" content="website" />
  </Head>
  <div id="app">
    <header>
      <div class="logo">
        <div class="logo-icon" id="logo-icon">♩</div>
        <div>
          <div>Cadenza Agent</div>
          <div class="logo-sub">self-expanding LLM system</div>
        </div>
      </div>
      <div class="header-right">
        <StatusConn :state="connState" />
      </div>
    </header>

    <div class="tabs">
      <div v-for="t in tabs" :key="t.id" class="tab" :class="{active:tab===t.id}" @click="tab=t.id">
        {{t.label}}<span v-if="t.id==='services'">&nbsp;({{services.length}})</span>
      </div>
    </div>

    <div class="main">
      <AgentChat
        :messages="messages"
        :chatInput="chatInput"
        @send="val => { chatInput.value = val; sendMessage(); }"
        @update:chatInput="val => chatInput.value = val"
      />
      <div class="content-panel">
        <div class="tab-content" v-if="tab==='services'">
          <TabServices
            :services="services"
            host="localhost"
            @retry="s => { retryService(s); setTimeout(fetchServices, 1000); }"
            @delete="s => { deleteService(s); }"
          />
        </div>
        <div class="tab-content" v-else-if="tab==='logs'">
           <TabLogs
            :logs="filteredLogs()"
            :filter="logFilter"
            @setFilter="setLogFilter"
            @clear="clearLogs"
           />
        </div>
        <div class="tab-content" v-else-if="tab==='stats'">
          <TabStats :rows="stats" />
        </div>
        <div class="tab-content" v-else-if="tab==='map'">
          <TabMap :graph="graph" :services="services" />
        </div>
        <div class="tab-content" v-else-if="tab==='db'">
          <TabCadenzaDB :health="dbHealth" :services="dbServices" :plans="dbPlans" :error="dbError" host="localhost" />
        </div>
      </div>
    </div>
  </div>
</template>


<script setup>
import { ref, onMounted } from 'vue';
import TabServices from '../components/tabs/TabServices.vue';
import TabLogs from '../components/tabs/TabLogs.vue';
import TabStats from '../components/tabs/TabStats.vue';
import TabMap from '../components/tabs/TabMap.vue';
import TabCadenzaDB from '../components/tabs/TabCadenzaDB.vue';
import StatusConn from '../components/StatusConn.vue';
import AgentChat from '../components/AgentChat.vue';
const tabs = [
  { id: 'services', label: 'Services' },
  { id: 'logs', label: 'Logs' },
  { id: 'stats', label: 'Stats' },
  { id: 'map', label: 'Map' },
  { id: 'db', label: 'CadenzaDB' },
];
const tab = ref('services');
const stats = ref([]);
const graph = ref(null);
const dbHealth = ref(null);
const dbServices = ref([]);
const dbPlans = ref([]);
const dbError = ref(null);
const services = ref([]);
const running = ref([]);
const messages = ref([
  { role: 'system', text: 'Welcome to Cadenza Agent!' }
]);
const chatInput = ref('');

// Logs state and SSE connection
const logs = ref([]);
const logFilter = ref('all');
const logFilters = ['all','plan','code','deploy','test','fix','error'];
let eventSource = null;
const connState = ref('connecting'); // 'connecting' | 'connected' | 'disconnected'
const connStateLabel = computed(() => {
  if (connState.value === 'connected') return 'connected';
  if (connState.value === 'disconnected') return 'disconnected';
  return 'connecting...';
});

function connectLogsSSE() {
  if (eventSource) eventSource.close();
  connState.value = 'connecting';
  // Use full backend URL for local dev; fallback to relative for prod
  const backendUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3010/api/logs'
    : '/api/logs';
  eventSource = new EventSource(backendUrl);
  let opened = false;
  eventSource.onopen = () => {
    opened = true;
    connState.value = 'connected';
  };
  eventSource.onmessage = (e) => {
    try {
      const entry = JSON.parse(e.data);
      logs.value.push(entry);
    } catch {}
  };
  eventSource.onerror = () => {
    if (!opened) connState.value = 'disconnected';
    else connState.value = 'disconnected';
    setTimeout(() => connectLogsSSE(), 3000);
  };
  setTimeout(() => {
    if (!opened && connState.value === 'connecting') connState.value = 'disconnected';
  }, 2000);
}



function filteredLogs() {
  return logs.value.filter(e => e.type !== 'cadenza' && (logFilter.value === 'all' || e.type === logFilter.value));
}

function setLogFilter(f) {
  logFilter.value = f;
}

function clearLogs() {
  logs.value = [];
}


async function fetchServices() {
  try {
    const res = await fetch('/api/services');
    const data = await res.json();
    services.value = Array.isArray(data) ? data : [];
    running.value = services.value.filter(s => ['verified','running','degraded'].includes(s.status));
  } catch {}
}

async function retryService(s) {
  const picker = document.getElementById('mp-' + s.id);
  const modelIndex = picker && picker.value ? parseInt(picker.value) : 0;
  try {
    const res = await fetch(`/api/retry/${s.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelIndex })
    });
    if ((await res.json()).ok) tab.value = 'logs';
  } catch {}
}

async function deleteService(s) {
  if (!confirm(`Delete group "${s.groupId}"?\nThis stops all its processes.`)) return;
  try {
    await fetch(`/api/services/${s.id}`, { method: 'DELETE' });
    fetchServices();
  } catch {}
}


async function fetchStats() {
  try {
    const res = await fetch('/api/model-stats');
    stats.value = await res.json();
  } catch {}
}

async function fetchGraph() {
  try {
    const res = await fetch('/api/graph');
    graph.value = await res.json();
  } catch {}
}

async function fetchDB() {
  try {
    const healthRes = await fetch('/api/db/health');
    dbHealth.value = await healthRes.json();
    const svcRes = await fetch('/api/services');
    dbServices.value = await svcRes.json();
    const planRes = await fetch('/api/plans');
    dbPlans.value = await planRes.json();
    dbError.value = null;
  } catch (e) {
    dbError.value = 'CadenzaDB not available';
  }
}

onMounted(() => {
  connectLogsSSE();
  fetchServices();
  fetchStats();
  fetchGraph();
  fetchDB();
});

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  messages.value.push({ role: 'user', text });
  chatInput.value = '';
  messages.value.push({ role: 'system', text: '⚙ Processing...' });
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    if (data.ok) {
      messages.value.push({ role: 'system', text: `🚀 Agent started (${data.agentId})\nWatch the logs for real-time progress.` });
      tab.value = 'logs';
    } else {
      messages.value.push({ role: 'system', text: 'Error: ' + (data.error || 'Unknown error') });
    }
  } catch (e) {
    messages.value.push({ role: 'system', text: '❌ ' + e.message });
  }
}
</script>

<style>
      .dot-connecting {
        background: var(--amber, #ffc107);
        box-shadow: 0 0 4px var(--amber, #ffc107);
      }
      .dot-connected {
        background: var(--green, #4caf50);
        box-shadow: 0 0 4px var(--green, #4caf50);
      }
      .dot-disconnected {
        background: var(--red, #f44336) !important;
        box-shadow: 0 0 4px var(--red, #f44336) !important;
      }
</style>

