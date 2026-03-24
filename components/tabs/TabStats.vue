<template>
  <div class="graph-panel">
    <div style="margin-bottom:16px">
      <div class="graph-section-title">Model Performance by Task Type</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">Rankings update automatically. #1 is tried first for each task.</div>
    </div>
    <div style="overflow-x:auto">
      <table class="stats-table">
        <thead><tr>
          <th>Model</th>
          <th v-for="t in taskTypes" :key="t">{{t}}</th>
        </tr></thead>
        <tbody>
          <tr v-for="(row,i) in rows" :key="row.model">
            <td style="font-weight:500;color:var(--text)">{{shortModel(i)}}</td>
            <td v-for="t in taskTypes" :key="t">
              <template v-if="row[t]">
                <span :class="rankClass(i,t)">{{rankNum(i,t)}}</span>
                <span :style="{color:scoreColor(row[t].score)}">{{pct(row[t].score)}}%</span>
                <div class="score-bar"><div class="score-fill" :class="fillClass(row[t].score)" :style="{width:pct(row[t].score)+'%'}"></div></div>
                <br><span style="color:var(--muted);font-size:9px">{{row[t].successes}}✓ {{row[t].failures}}✗{{row[t].avgMs?' '+row[t].avgMs+'ms':''}}</span>
              </template>
              <template v-else><span style="color:var(--muted)">—</span></template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
const TASK_TYPES = ['frontend','backend','db','test','fix','plan'];
const SHORT_MODELS = ['gpt-oss-120b','kimi-k2','llama-70b','gpt-oss-20b','qwen3-32b','llama-4-scout','llama-8b'];
const props = defineProps(['rows']);
const taskTypes = TASK_TYPES;
function shortModel(i) { return SHORT_MODELS[i] || 'Model'; }
function rankClass(i,t) { return 'rank-'+(i+1)+'-'+t; }
function rankNum(i,t) { return i+1; }
function scoreColor(score) { return score>0.8?'var(--accent)':score>0.5?'var(--amber)':'var(--red)'; }
function pct(score) { return Math.round((score||0)*100); }
function fillClass(score) { return score>0.8?'fill-accent':score>0.5?'fill-amber':'fill-red'; }
</script>
