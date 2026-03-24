<template>
  <div style="display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden">
    <div class="log-toolbar">
      <span style="font-size:10px;color:var(--muted)">FLOW MAP — drag nodes · scroll to zoom</span>
      <div style="flex:1"></div>
      <button class="log-filter-btn" @click="load">↺ refresh</button>
      <button class="log-filter-btn" @click="resetView">⌂ reset</button>
    </div>
    <div style="flex:1;min-height:0;position:relative">
      <canvas ref="canvas"
        style="width:100%;height:100%;cursor:grab"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @wheel.prevent="onWheel"
      ></canvas>
      <div style="position:absolute;bottom:12px;right:12px;font-size:10px;color:var(--muted);line-height:1.8">
        <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--accent);margin-right:4px"></span>User task</div>
        <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--purple);margin-right:4px"></span>Meta task</div>
        <div><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--blue);margin-right:4px"></span>Service</div>
        <div><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--amber);margin-right:4px"></span>Signal</div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Placeholder for map logic and events
function load() {}
function resetView() {}
function onMouseDown() {}
function onMouseMove() {}
function onMouseUp() {}
function onWheel() {}
</script>
