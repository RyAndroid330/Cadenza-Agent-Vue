<template>
  <div id="app">
    <header>
      <div class="logo">
        <div class="logo-icon">♩</div>
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
      <div v-for="t in tabs" :key="t.id" class="tab" :class="{ active: tab === t.id }" @click="tab = t.id">
        {{ t.label }}<span v-if="t.id === 'services'">&nbsp;({{ services.length }})</span>
      </div>
    </div>

    <div class="main">
      <AgentChat
        :messages="messages"
        :chatInput="chatInput"
        :busy="agentBusy"
        :liveLogs="agentLiveLogs"
        :services="services"
        @send="(val, ids, uiSpec) => send(val, ids, uiSpec)"
        @cancel="cancelAgent"
        @update:chatInput="val => { chatInput = val; }"
      />
      <div class="content-panel">
        <TabServices
          v-if="tab==='services'"
          :services="services"
          host="localhost"
          @retry="s => retryService(s.id)"
          @stop="s => stopService(s.id)"
          @start="s => startService(s.id)"
          @delete="s => confirmAndDelete(s)"
        />
        <TabLogs
          v-else-if="tab === 'logs'"
          :logs="filteredLogs"
          :filter="filter"
          @setFilter="setFilter"
          @clear="clearLogs"
        />
        <TabStats
          v-else-if="tab === 'stats'"
          :stats="modelStats"
        />
        <TabMap
          v-else-if="tab === 'map'"
          :tasks="graphTasks"
          :services="services"
        />
        <TabCadenzaDB
          v-else-if="tab === 'db'"
          :health="dbHealth"
          :services="dbServices"
          :plans="dbPlans"
          :error="dbError"
          host="localhost"
          @refresh="fetchDB"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import StatusConn from '../components/StatusConn.vue';
import AgentChat from '../components/AgentChat.vue';
import TabServices from '../components/tabs/TabServices.vue';
import TabLogs from '../components/tabs/TabLogs.vue';
import TabStats from '../components/tabs/TabStats.vue';
import TabMap from '../components/tabs/TabMap.vue';
import TabCadenzaDB from '../components/tabs/TabCadenzaDB.vue';
import { useAgent } from '../composables/useAgent';
import { useLogs } from '../composables/useLogs';
import { useServices } from '../composables/useServices';

const tabs = [
  { id: 'services', label: 'Services' },
  { id: 'logs', label: 'Logs' },
  { id: 'stats', label: 'Stats' },
  { id: 'map', label: 'Map' },
  { id: 'db', label: 'CadenzaDB' },
];

const tab = ref('services');

// Composables
const { messages, chatInput, send, cancelAgent } = useAgent();
const { logs, filteredLogs, filter, connState, connect, clearLogs, setFilter } = useLogs();
const { services, retryService, stopService, startService, deleteService, startPolling, stopPolling } = useServices();

// Agent busy = a 'done' or terminal log hasn't arrived since the last 'user' log
const agentBusy = computed(() => {
  const all = logs.value;
  if (!all.length) return false;
  for (let i = all.length - 1; i >= 0; i--) {
    const t = all[i].type;
    if (t === 'done') return false;
    if (t === 'user') return true;
  }
  return false;
});

// Last 6 non-user log entries to show inline in chat while busy
const agentLiveLogs = computed(() =>
  logs.value.filter(e => e.type !== 'user').slice(-6)
);

// Stats, graph, db
const modelStats = ref({});
const graphTasks = ref([]);
const dbHealth = ref(null);
const dbServices = ref([]);
const dbPlans = ref([]);
const dbError = ref(null);

async function fetchStats() {
  try {
    const res = await fetch('/api/model-stats');
    modelStats.value = await res.json();
  } catch {}
}

async function fetchGraph() {
  try {
    const res = await fetch('/api/graph');
    graphTasks.value = await res.json();
  } catch {}
}

async function fetchDB() {
  try {
    const [healthRes, svcRes, planRes] = await Promise.all([
      fetch('/api/db/health'),
      fetch('/api/services'),
      fetch('/api/plans')
    ]);
    dbHealth.value = await healthRes.json();
    dbServices.value = await svcRes.json();
    dbPlans.value = await planRes.json();
    dbError.value = null;
  } catch {
    dbError.value = 'CadenzaDB not available';
  }
}

async function confirmAndDelete(s) {
  if (!confirm(`Delete group "${s.groupId}"?\nThis stops all its processes.`)) return;
  await deleteService(s.id);
}

useHead({
  title: 'Cadenza Agent',
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'description', content: 'Cadenza Agent: Self-expanding LLM system for autonomous service generation.' },
    { name: 'theme-color', content: '#080b10' }
  ],
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@400;600;800&display=swap' },
    { rel: 'stylesheet', href: '/style.css' },
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
  ]
});

onMounted(() => {
  connect();
  startPolling(4000);
  fetchStats();
  fetchGraph();
  fetchDB();
});

onUnmounted(() => {
  stopPolling();
});
</script>
