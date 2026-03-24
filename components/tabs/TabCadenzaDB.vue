<template>
  <div class="graph-panel">
    <div v-if="error" class="empty-state" style="color:var(--red)">⚠ {{error}}</div>
    <template v-else-if="health">
      <div style="display:flex;gap:20px;margin-bottom:16px;align-items:center">
        <div class="graph-section-title" style="margin:0">CadenzaDB · :3001</div>
        <span style="font-size:11px;color:var(--accent)">● online</span>
        <span style="font-size:11px;color:var(--muted)">{{health.services}} services · {{health.plans}} plans</span>
        <button class="log-filter-btn" @click="load" style="margin-left:auto">↺ refresh</button>
      </div>
      <div class="graph-section-title">Services Table</div>
      <div style="overflow-x:auto;margin-bottom:24px">
        <table class="stats-table">
          <thead><tr><th>ID</th><th>Group</th><th>Type</th><th>Port</th><th>Status</th><th>Retries</th><th>Created</th></tr></thead>
          <tbody>
            <tr v-if="!services.length"><td colspan="7" style="color:var(--muted);text-align:center">No services recorded yet</td></tr>
            <tr v-for="s in services" :key="s.id">
              <td style="font-size:10px;color:var(--muted)">{{s.id}}</td>
              <td>{{s.groupId}}</td>
              <td><span :class="'svc-type-badge badge-'+s.type">{{s.type}}</span></td>
              <td><a :href="'http://'+host+':'+s.port" target="_blank" class="port-link">:{{s.port}} ↗</a></td>
              <td :style="{color:s.status==='verified'?'var(--accent)':s.status==='degraded'?'var(--amber)':'var(--muted)'}">{{s.status}}</td>
              <td style="color:var(--muted)">{{s.retries||0}}</td>
              <td style="color:var(--muted);font-size:10px">{{fmtDate(s.createdAt)}}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="graph-section-title">Plans Table</div>
      <table class="stats-table">
        <thead><tr><th>Group ID</th><th>Description</th><th>Intent</th><th>Services</th><th>Updated</th></tr></thead>
        <tbody>
          <tr v-if="!plans.length"><td colspan="5" style="color:var(--muted);text-align:center">No plans recorded yet</td></tr>
          <tr v-for="p in plans" :key="p.groupId">
            <td style="font-weight:500">{{p.groupId}}</td>
            <td>{{p.description}}</td>
            <td>{{p.intent}}</td>
            <td>{{p.services}}</td>
            <td style="color:var(--muted);font-size:10px">{{fmtDate(p.updatedAt)}}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<script setup>
const props = defineProps(['health', 'services', 'plans', 'error', 'host']);
function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleString();
}
function load() {}
</script>
