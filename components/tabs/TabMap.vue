<template>
  <div style="display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden">
    <div class="log-toolbar">
      <span style="font-size:10px;color:var(--muted)">TASK GRAPH — drag nodes · scroll to zoom</span>
      <div style="flex:1"></div>
      <button class="log-filter-btn" @click="rebuild">↺ rebuild</button>
      <button class="log-filter-btn" @click="resetView">⌂ reset</button>
    </div>
    <div style="flex:1;min-height:0;position:relative">
      <canvas ref="canvas"
        style="width:100%;height:100%;cursor:grab;display:block"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @mouseleave="onMouseUp"
        @wheel.prevent="onWheel"
      ></canvas>
      <div style="position:absolute;bottom:12px;right:12px;font-size:10px;color:var(--muted);line-height:2;background:rgba(8,11,16,0.7);padding:6px 10px;border-radius:6px">
        <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--accent);margin-right:6px;vertical-align:middle"></span>Task (user)</div>
        <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--purple, #8b6dff);margin-right:6px;vertical-align:middle"></span>Signal</div>
        <div><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--blue, #2196f3);margin-right:6px;vertical-align:middle"></span>Service</div>
      </div>
      <div v-if="!nodes.length" class="empty-state" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
        <div class="empty-icon">◎</div>
        <div>No tasks loaded yet.</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">Start the backend to populate the graph.</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps({
  tasks: { type: Array, default: () => [] },
  services: { type: Array, default: () => [] }
});

const canvas = ref(null);
let ctx = null;
let animFrame = null;
let nodes = ref([]);
let edges = [];
let dragging = null;
let dragOffX = 0, dragOffY = 0;
let viewX = 0, viewY = 0, viewScale = 1;
let isPanning = false;
let panStartX = 0, panStartY = 0;

const COLORS = {
  task: '#3de0a0',
  signal: '#8b6dff',
  service: '#2196f3',
  edge: '#334',
  text: '#cdd',
  bg: '#080b10'
};

function buildGraph() {
  nodes.value = [];
  edges = [];

  const taskList = Array.isArray(props.tasks) ? props.tasks : [];
  const svcList = Array.isArray(props.services) ? props.services : [];

  // Layout: tasks in a circle, services in outer ring
  const cx = (canvas.value?.width || 600) / 2;
  const cy = (canvas.value?.height || 400) / 2;
  const r = Math.min(cx, cy) * 0.5;

  taskList.forEach((t, i) => {
    const angle = (2 * Math.PI * i) / Math.max(taskList.length, 1) - Math.PI / 2;
    nodes.value.push({
      id: t.name,
      label: t.name.replace(/([A-Z])/g, ' $1').trim(),
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      vx: 0, vy: 0,
      type: 'task',
      data: t
    });
    // Signal edges
    if (t.on) {
      edges.push({ from: `sig_${t.on}`, to: t.name });
      if (!nodes.value.find(n => n.id === `sig_${t.on}`)) {
        const sa = angle - 0.3;
        nodes.value.push({ id: `sig_${t.on}`, label: t.on, x: cx + (r * 1.4) * Math.cos(sa), y: cy + (r * 1.4) * Math.sin(sa), vx: 0, vy: 0, type: 'signal' });
      }
    }
    if (t.emits) {
      for (const sig of t.emits) {
        edges.push({ from: t.name, to: `sig_out_${sig}` });
        if (!nodes.value.find(n => n.id === `sig_out_${sig}`)) {
          const sa = angle + 0.3;
          nodes.value.push({ id: `sig_out_${sig}`, label: sig, x: cx + (r * 1.4) * Math.cos(sa), y: cy + (r * 1.4) * Math.sin(sa), vx: 0, vy: 0, type: 'signal' });
        }
      }
    }
  });

  // Add services
  svcList.forEach((s, i) => {
    const angle = (2 * Math.PI * i) / Math.max(svcList.length, 1);
    nodes.value.push({
      id: s.id,
      label: s.name,
      x: cx + (r * 1.9) * Math.cos(angle),
      y: cy + (r * 1.9) * Math.sin(angle),
      vx: 0, vy: 0,
      type: 'service',
      data: s
    });
  });

  draw();
}

function nodeAt(wx, wy) {
  return nodes.value.find(n => Math.hypot(n.x - wx, n.y - wy) < 22);
}

function worldCoords(ex, ey) {
  const rect = canvas.value.getBoundingClientRect();
  const px = (ex - rect.left) * (canvas.value.width / rect.width);
  const py = (ey - rect.top) * (canvas.value.height / rect.height);
  return { x: (px - viewX) / viewScale, y: (py - viewY) / viewScale };
}

function onMouseDown(e) {
  if (!canvas.value) return;
  const { x, y } = worldCoords(e.clientX, e.clientY);
  const hit = nodeAt(x, y);
  if (hit) {
    dragging = hit;
    dragOffX = x - hit.x;
    dragOffY = y - hit.y;
  } else {
    isPanning = true;
    panStartX = e.clientX - viewX;
    panStartY = e.clientY - viewY;
  }
}

function onMouseMove(e) {
  if (!canvas.value) return;
  if (dragging) {
    const { x, y } = worldCoords(e.clientX, e.clientY);
    dragging.x = x - dragOffX;
    dragging.y = y - dragOffY;
    dragging.vx = 0; dragging.vy = 0;
    draw();
  } else if (isPanning) {
    viewX = e.clientX - panStartX;
    viewY = e.clientY - panStartY;
    draw();
  }
}

function onMouseUp() { dragging = null; isPanning = false; }

function onWheel(e) {
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  const rect = canvas.value.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (canvas.value.width / rect.width);
  const py = (e.clientY - rect.top) * (canvas.value.height / rect.height);
  viewX = px - (px - viewX) * factor;
  viewY = py - (py - viewY) * factor;
  viewScale = Math.max(0.2, Math.min(4, viewScale * factor));
  draw();
}

function resetView() { viewX = 0; viewY = 0; viewScale = 1; draw(); }

function draw() {
  if (!ctx || !canvas.value) return;
  const W = canvas.value.width, H = canvas.value.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(viewX, viewY);
  ctx.scale(viewScale, viewScale);

  // Draw edges
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1.5;
  for (const e of edges) {
    const from = nodes.value.find(n => n.id === e.from);
    const to = nodes.value.find(n => n.id === e.to);
    if (!from || !to) continue;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    // Arrow
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx - 8 * Math.cos(angle - 0.4), my - 8 * Math.sin(angle - 0.4));
    ctx.lineTo(mx - 8 * Math.cos(angle + 0.4), my - 8 * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fillStyle = COLORS.edge;
    ctx.fill();
  }

  // Draw nodes
  for (const n of nodes.value) {
    const color = COLORS[n.type] || COLORS.task;
    const r = n.type === 'task' ? 18 : n.type === 'signal' ? 12 : 14;

    ctx.beginPath();
    if (n.type === 'service') {
      ctx.rect(n.x - r, n.y - r, r * 2, r * 2);
    } else {
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = color + '33';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.fillStyle = COLORS.text;
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const words = n.label.split(' ');
    if (words.length > 1) {
      ctx.fillText(words[0], n.x, n.y - 5);
      ctx.fillText(words.slice(1).join(' '), n.x, n.y + 5);
    } else {
      ctx.fillText(n.label, n.x, n.y);
    }
  }

  ctx.restore();
}

function resizeCanvas() {
  if (!canvas.value) return;
  const parent = canvas.value.parentElement;
  canvas.value.width = parent.clientWidth || 600;
  canvas.value.height = parent.clientHeight || 400;
  draw();
}

function rebuild() { buildGraph(); }

watch(() => [props.tasks, props.services], () => {
  nextTick(buildGraph);
}, { deep: true });

onMounted(async () => {
  await nextTick();
  if (canvas.value) {
    ctx = canvas.value.getContext('2d');
    resizeCanvas();
    buildGraph();
  }
  window.addEventListener('resize', resizeCanvas);
});

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas);
  if (animFrame) cancelAnimationFrame(animFrame);
});
</script>
