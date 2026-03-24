<template>
  <div class="status-conn">
    <div class="status-dot" :class="'dot-' + state"></div>
    <div class="status-label" id="conn-status">{{ label }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
const props = defineProps({
  state: { type: String, required: true }, // 'connecting' | 'connected' | 'disconnected'
});
const label = computed(() => {
  if (props.state === 'connected') return 'connected';
  if (props.state === 'disconnected') return 'disconnected';
  return 'connecting...';
});
</script>

<style scoped>
.status-conn {
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 4px;
  border: 1.5px solid #222;
  box-sizing: border-box;
}
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
.status-label {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: lowercase;
}
</style>
