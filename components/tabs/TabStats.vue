<template>
  <div class="graph-panel">
    <div style="margin-bottom:16px">
      <div class="graph-section-title">Model Performance by Task Type</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">Rankings update automatically based on real LLM call outcomes.</div>
    </div>
    <div v-if="!hasData" class="empty-state">
      <div class="empty-icon">◎</div>
      <div>No model stats yet.</div>
      <div style="margin-top:6px;font-size:11px;color:var(--muted)">Stats accumulate as the agent runs tasks.</div>
    </div>
    <div v-else style="overflow-x:auto">
      <table class="stats-table">
        <thead>
          <tr>
            <th>Model</th>
            <th v-for="t in taskTypes" :key="t">{{ t }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="[model, data] in modelEntries" :key="model">
            <td style="font-weight:500;color:var(--text);font-size:11px">{{ model }}</td>
            <td v-for="t in taskTypes" :key="t">
              <template v-if="data[t]">
                <span :style="{ color: scoreColor(rate(data[t])) }">{{ pct(rate(data[t])) }}%</span>
                <div class="score-bar">
                  <div class="score-fill" :class="fillClass(rate(data[t]))" :style="{ width: pct(rate(data[t])) + '%' }"></div>
                </div>
                <br><span style="color:var(--muted);font-size:9px">{{ data[t].success }}✓ {{ data[t].fail }}✗</span>
              </template>
              <template v-else>
                <span style="color:var(--muted)">—</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({ stats: { type: Object, default: () => ({}) } });

const taskTypes = ['plan', 'code', 'test', 'fix'];

const hasData = computed(() => Object.keys(props.stats || {}).length > 0);
const modelEntries = computed(() => Object.entries(props.stats || {}));

function rate(s) { return s && (s.success + s.fail) > 0 ? s.success / (s.success + s.fail) : 0; }
function pct(r) { return Math.round(r * 100); }
function scoreColor(r) { return r > 0.8 ? 'var(--accent)' : r > 0.5 ? 'var(--amber)' : 'var(--red)'; }
function fillClass(r) { return r > 0.8 ? 'fill-accent' : r > 0.5 ? 'fill-amber' : 'fill-red'; }
</script>
