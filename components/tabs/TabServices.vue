<template>
  <div class="services-panel">
    <div v-if="!groups.length" class="empty-state">
      <div class="empty-icon">⬡</div>
      <div>No services deployed yet.</div>
      <div style="margin-top:6px;font-size:11px">Chat with the agent to deploy your first service.</div>
    </div>

    <div v-for="g in groups" :key="g.groupId" class="service-group">
      <div class="group-header">
        <div class="group-status-row">
          <div :class="'status-indicator s-'+g.groupStatus" style="flex-shrink:0"></div>
          <span class="group-name">{{ g.label }}</span>
          <span class="group-id">{{ g.groupId }}</span>
        </div>
        <button class="action-btn btn-delete" style="margin-left:auto" @click="$emit('delete', g.services[0])">✖ Delete group</button>
      </div>
      <div class="group-cards">
        <div v-for="s in g.services" :key="s.id" class="service-card">
          <div class="svc-header">
            <div class="svc-name">{{ s.name }}</div>
            <div :class="'svc-type-badge badge-'+s.type">{{ s.type }}</div>
          </div>
          <div class="svc-desc">{{ s.description }}</div>
          <div class="svc-status">
            <div :class="'status-indicator s-'+s.status"></div>
            <span :class="'svc-status-label sl-'+s.status">{{ s.status }}</span>
            <span v-if="s.port" style="margin-left:auto">
              <a :href="'http://localhost:'+s.port" target="_blank" class="port-link">:{{ s.port }} ↗</a>
            </span>
          </div>
          <div class="svc-actions">
            <button v-if="s.status==='error'" class="action-btn btn-retry" @click="$emit('retry', s)">↺ Rebuild</button>
            <button v-if="s.status==='degraded'" class="action-btn btn-retry" @click="$emit('retry', s)">↺ Retry</button>
            <button v-if="s.status==='running'||s.status==='verified'||s.status==='degraded'" class="action-btn btn-stop" @click="$emit('stop', s)">◼ Stop</button>
            <button v-if="s.status==='stopped'&&s.filePath" class="action-btn btn-start" @click="$emit('start', s)">▶ Start</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps(['services', 'host']);
defineEmits(['retry', 'stop', 'start', 'delete']);

const STATUS_RANK = { error: 0, degraded: 1, generating: 2, deploying: 2, running: 3, stopped: 4, verified: 5 };

const groups = computed(() => {
  const all = Array.isArray(props.services) ? props.services : [];
  const map = new Map();
  for (const s of all) {
    const gid = s.groupId || s.id;
    if (!map.has(gid)) map.set(gid, []);
    map.get(gid).push(s);
  }
  return [...map.entries()].map(([groupId, services]) => {
    // Group status = worst individual status
    const groupStatus = services.reduce((worst, s) => {
      return (STATUS_RANK[s.status] ?? 3) < (STATUS_RANK[worst] ?? 3) ? s.status : worst;
    }, 'verified');
    // Label: derive from service names by finding common prefix words
    const words = services[0]?.name?.replace(/[_-]/g, ' ').replace(/\s+(db|database|api|backend|ui|frontend|server)$/i, '').trim() || groupId;
    return { groupId, services, groupStatus, label: words };
  });
});
</script>
