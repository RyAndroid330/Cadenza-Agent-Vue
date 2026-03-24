<template>
  <div class="services-panel">
    <div v-if="!list.length" class="empty-state">
      <div class="empty-icon">⬡</div>
      <div>No services deployed yet.</div>
      <div style="margin-top:6px;font-size:11px">Chat with the agent to deploy your first service.</div>
    </div>
    <div v-for="s in list" :key="s.id" class="service-card">
      <div class="svc-header">
        <div class="svc-name">{{s.name}}</div>
        <div :class="'svc-type-badge badge-'+s.type">{{s.type}}</div>
      </div>
      <div class="svc-desc">{{s.description}}</div>
      <div class="svc-port">Port: <a :href="'http://'+host+':'+s.port" target="_blank" class="port-link">:{{s.port}} ↗</a></div>
      <div class="svc-status">
        <div :class="'status-indicator s-'+s.status"></div>
        <span style="color:var(--muted)">{{s.status}}</span>
        <span v-if="s.retries>0" style="color:var(--amber);margin-left:auto">{{s.retries}} fix{{s.retries>1?'es':''}}</span>
      </div>
      <div class="svc-actions">
        <template v-if="s.status==='degraded'||s.status==='error'">
          <select class="model-picker" :id="'mp-'+s.id">
            <option value="">↓ model</option>
            <option value="0">gpt-oss-120b</option><option value="1">kimi-k2</option>
            <option value="2">llama-70b</option><option value="3">gpt-oss-20b</option>
            <option value="4">qwen3-32b</option><option value="5">llama-4-scout</option>
            <option value="6">llama-8b</option>
          </select>
          <button class="action-btn btn-retry" @click="$emit('retry', s)">↺ Retry</button>
        </template>
        <button class="action-btn btn-delete" @click="$emit('delete', s)">✖ Delete</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
const props = defineProps(['services', 'host']);
const list = computed(() => Array.isArray(props.services) ? props.services : []);
function testPass(s) { return s.testResults?.passed?.length || 0; }
function testTotal(s) { return s.testResults?.total || 0; }
</script>
