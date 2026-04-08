<template>
  <div class="graph-panel">
    <div v-if="error" class="empty-state" style="color:var(--red)">⚠ {{ error }}</div>
    <template v-else-if="health">
      <div style="display:flex;gap:20px;margin-bottom:16px;align-items:center;flex-wrap:wrap">
        <div class="graph-section-title" style="margin:0">CadenzaDB · :3001</div>
        <span style="font-size:11px;color:var(--accent)">● online</span>
        <span style="font-size:11px;color:var(--muted)">{{ health.services }} services · {{ health.plans }} plans</span>
        <button class="log-filter-btn" @click="$emit('refresh')" style="margin-left:auto">↺ refresh</button>
      </div>
      <div class="graph-section-title">Services</div>
      <div style="overflow-x:auto;margin-bottom:24px">
        <table class="stats-table">
          <thead>
            <tr><th>ID</th><th>Group</th><th>Type</th><th>Port</th><th>Status</th><th>Retries</th><th>Created</th></tr>
          </thead>
          <tbody>
            <tr v-if="!services.length">
              <td colspan="7" style="color:var(--muted);text-align:center">No services recorded yet</td>
            </tr>
            <tr v-for="s in services" :key="s.id">
              <td style="font-size:10px;color:var(--muted)">{{ s.id }}</td>
              <td style="font-size:11px">{{ s.groupId }}</td>
              <td><span :class="'svc-type-badge badge-' + s.type">{{ s.type }}</span></td>
              <td>
                <a v-if="s.port" :href="'http://' + host + ':' + s.port" target="_blank" class="port-link">:{{ s.port }} ↗</a>
                <span v-else style="color:var(--muted)">—</span>
              </td>
              <td :style="{ color: statusColor(s.status) }">{{ s.status }}</td>
              <td style="color:var(--muted)">{{ s.retries || s._fixRetries || 0 }}</td>
              <td style="color:var(--muted);font-size:10px">{{ fmtDate(s.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="graph-section-title">Plans</div>
      <div style="overflow-x:auto">
        <table class="stats-table">
          <thead>
            <tr><th>Plan ID</th><th>Group</th><th>Intent</th><th>Description</th><th>Services</th><th>Created</th></tr>
          </thead>
          <tbody>
            <tr v-if="!plans.length">
              <td colspan="6" style="color:var(--muted);text-align:center">No plans recorded yet</td>
            </tr>
            <tr v-for="p in plans" :key="p.id">
              <td style="font-size:10px;color:var(--muted)">{{ p.id }}</td>
              <td style="font-size:11px">{{ p.groupId }}</td>
              <td>{{ p.intent }}</td>
              <td>{{ p.description }}</td>
              <td style="color:var(--muted)">{{ (p.services || []).length }}</td>
              <td style="color:var(--muted);font-size:10px">{{ fmtDate(p.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <div v-else class="empty-state">
      <div class="empty-icon">◎</div>
      <div>CadenzaDB not connected.</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">Start the backend to connect.</div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps(['health', 'services', 'plans', 'error', 'host']);
defineEmits(['refresh']);

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

function statusColor(s) {
  if (s === 'verified') return 'var(--accent)';
  if (s === 'degraded') return 'var(--amber)';
  if (s === 'error') return 'var(--red)';
  return 'var(--muted)';
}
</script>
