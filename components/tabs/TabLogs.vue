<template>
  <div class="tab-content active" id="tab-logs" style="display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden">
    <div class="log-toolbar">
      <span style="font-size:10px;color:var(--muted);margin-right:4px">FILTER:</span>
      <button v-for="f in filters" :key="f" class="log-filter-btn" :class="{ on: filter===f }" @click="$emit('setFilter',f)">{{f}}</button>
      <div style="flex:1"></div>
      <button class="log-filter-btn" @click="$emit('clear')">clear</button>
    </div>
    <div class="log-stream" ref="stream">
      <div v-for="(entry,i) in logs" :key="i" class="log-entry">
        <span class="log-ts">{{fmt(entry.ts)}}</span>
        <span class="log-type" :class="'lt-'+(entry.type||'info')">{{(entry.type||'info').toUpperCase()}}</span>
        <span class="log-msg">
          <span v-html="esc(entry.message||'')"></span>
        </span>
        <div v-if="entry.data" class="log-data">{{JSON.stringify(entry.data)}}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
const props = defineProps(['logs', 'filter']);
const filters = ['all','plan','code','deploy','test','fix','error'];
const stream = ref(null);

watch(() => props.logs, async () => {
  await nextTick();
  if (stream.value) stream.value.scrollTop = stream.value.scrollHeight;
}, { deep: true });

function fmt(ts) {
  const d = new Date(ts||Date.now());
  return [d.getHours(),d.getMinutes(),d.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':');
}
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
</script>
