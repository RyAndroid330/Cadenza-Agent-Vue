<template>
  <div class="sidebar">
    <div class="sidebar-title">
      ▸ Agent Chat
      <span v-if="focusedIds.size > 0" class="focus-badge" @click="focusOpen = true" title="Focused — click to edit">
        ⊙ {{ focusedIds.size }}
      </span>
      <button class="ui-auto-toggle" :class="{ 'ui-auto-on': uiAuto }" @click="uiAuto = !uiAuto" :title="uiAuto ? 'UI Auto: agent decides layout/theme' : 'UI Manual: you choose layout/theme'">
        UI {{ uiAuto ? 'auto' : 'manual' }}
      </button>
    </div>

    <div class="chat-messages" ref="msgEl">
      <div v-for="(m,i) in messages" :key="i" :class="'msg msg-'+m.role">
        <div class="msg-label">{{ m.role === 'user' ? 'you' : 'cadenza' }}</div>
        <div class="msg-bubble" v-html="m.text.replace(/\n/g,'<br>')"></div>
      </div>
      <div v-if="busy" class="live-log-feed">
        <div class="live-log-header"><span class="live-dot"></span>working</div>
        <div v-for="(l,i) in liveLogs" :key="i" :class="'live-log-line lt-'+l.type">
          <span class="live-log-type">{{ l.type }}</span>
          <span class="live-log-msg">{{ l.message }}</span>
        </div>
      </div>
    </div>

    <div class="chat-input-area">
      <button class="focus-btn" :class="{ 'focus-btn-active': focusedIds.size > 0 }" @click="focusOpen = true" title="Agent Focus">⊙</button>
      <textarea
        class="chat-input"
        :class="{ 'input-busy': busy || fetchingFeatures }"
        :placeholder="busy ? 'Agent is working...' : fetchingFeatures ? 'Thinking...' : 'Type a request...'"
        :disabled="busy || fetchingFeatures"
        :value="chatInput"
        @input="e => $emit('update:chatInput', e.target.value)"
        @keydown.enter.exact.prevent="!busy && !fetchingFeatures && handleSend()"
      ></textarea>
      <button v-if="busy" class="stop-btn" @click="$emit('cancel')">■</button>
      <button v-else class="send-btn" :class="{ 'send-thinking': fetchingFeatures }" :disabled="fetchingFeatures" @click="handleSend">
        {{ fetchingFeatures ? '…' : '➤' }}
      </button>
    </div>

    <!-- ── Focus dialog ── -->
    <Teleport to="body">
      <div v-if="focusOpen" class="overlay" @click.self="focusOpen = false">
        <div class="dialog">
          <div class="dialog-hdr">
            <span>Agent Focus</span>
            <button class="close-btn" @click="focusOpen = false">✕</button>
          </div>
          <div class="dialog-body">
            <div v-if="!groups.length" class="dialog-empty">No services deployed yet.</div>
            <template v-else>
              <p class="dialog-hint">Select services to focus on. Leave empty for free agent mode.</p>
              <div v-for="g in groups" :key="g.groupId" class="focus-group">
                <label class="focus-group-row">
                  <input type="checkbox" :checked="isGroupChecked(g)" :indeterminate.prop="isGroupIndeterminate(g)" @change="toggleGroup(g)" />
                  <span class="focus-group-label">{{ g.label }}</span>
                  <span class="focus-group-pill">{{ g.services.length }}</span>
                </label>
                <div v-for="svc in g.services" :key="svc.id" class="focus-svc-row">
                  <label>
                    <input type="checkbox" :checked="focusedIds.has(svc.id)" @change="toggleService(svc.id)" />
                    <span :class="'focus-type-dot t-' + svc.type">{{ svc.type[0].toUpperCase() }}</span>
                    <span class="focus-svc-name">{{ svc.name.replace(/_/g, ' ') }}</span>
                    <span v-if="svc.port" class="focus-svc-port">:{{ svc.port }}</span>
                  </label>
                </div>
              </div>
            </template>
          </div>
          <div class="dialog-ftr">
            <button class="btn-secondary" :disabled="focusedIds.size === 0" @click="clearFocus">Clear</button>
            <button class="btn-primary" @click="focusOpen = false">Done</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Feature selection dialog ── -->
    <Teleport to="body">
      <div v-if="featureOpen" class="overlay" @click.self="cancelFeatures">
        <div class="dialog feature-dialog">
          <div class="dialog-hdr">
            <span>What should <em class="accent-name">{{ featureAppType }}</em> include?</span>
            <button class="close-btn" @click="cancelFeatures">✕</button>
          </div>
          <div class="dialog-body">
            <p class="dialog-hint">Check the features you want. Uncheck anything you don't need.</p>
            <div class="feature-list">
              <label v-for="(f, i) in featureItems" :key="i" class="feature-row">
                <input type="checkbox" v-model="f.checked" />
                <span class="feature-label">{{ f.label }}</span>
              </label>
            </div>
            <div class="custom-features">
              <div v-for="(val, i) in customInputs" :key="i" class="custom-row">
                <input
                  class="custom-input"
                  type="text"
                  :placeholder="customInputs.length === 1 && i === 0 ? 'Add a custom feature...' : 'Another feature...'"
                  :value="val"
                  @input="onCustomInput(i, $event.target.value)"
                />
                <button v-if="val" class="custom-remove" @click="removeCustomInput(i)" title="Remove">✕</button>
              </div>
            </div>
          </div>
          <div class="dialog-ftr">
            <button class="btn-secondary" @click="cancelFeatures">Cancel</button>
            <button class="btn-primary" @click="approveFeatures">
              {{ uiAuto ? 'Build it ➤' : 'Next: UI →' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── UI preferences dialog ── -->
    <Teleport to="body">
      <div v-if="uiPrefOpen" class="overlay" @click.self="uiPrefOpen = false">
        <div class="dialog ui-dialog">
          <div class="dialog-hdr">
            <span>UI Preferences</span>
            <button class="close-btn" @click="uiPrefOpen = false">✕</button>
          </div>
          <div class="dialog-body">
            <p class="dialog-hint">Configure the layout and visual style for your app.</p>

            <!-- Layout -->
            <div class="pref-section">
              <div class="pref-section-title">Layout</div>
              <div class="pref-grid">
                <label class="pref-row" v-for="opt in layoutOpts" :key="opt.key">
                  <input type="checkbox" v-model="uiPrefs.layout[opt.key]" />
                  <span class="pref-label">{{ opt.label }}</span>
                </label>
              </div>
            </div>

            <!-- Theme -->
            <div class="pref-section">
              <div class="pref-section-title">Theme</div>
              <div class="pref-grid">
                <label class="pref-row">
                  <input type="radio" name="theme" value="dark"  v-model="uiPrefs.defaultTheme" /> Dark
                </label>
                <label class="pref-row">
                  <input type="radio" name="theme" value="light" v-model="uiPrefs.defaultTheme" /> Light
                </label>
                <label class="pref-row">
                  <input type="checkbox" v-model="uiPrefs.themeSwitcher" />
                  <span class="pref-label">Theme switcher toggle</span>
                </label>
              </div>
            </div>

            <!-- Style -->
            <div class="pref-section">
              <div class="pref-section-title">Style</div>
              <div class="pref-grid">
                <label class="pref-row" v-for="opt in styleOpts" :key="opt.key">
                  <input type="checkbox" v-model="uiPrefs.style[opt.key]" />
                  <span class="pref-label">{{ opt.label }}</span>
                </label>
              </div>
              <div class="pref-row pref-inline-select" style="margin-top:6px">
                <span class="pref-label">Corners</span>
                <select class="pref-select" v-model="uiPrefs.corners">
                  <option value="sharp">Sharp</option>
                  <option value="rounded">Rounded</option>
                  <option value="pill">Very rounded</option>
                </select>
              </div>
              <div class="pref-row pref-inline-select" style="margin-top:6px">
                <span class="pref-label">Font</span>
                <select class="pref-select" v-model="uiPrefs.font">
                  <option value="mono">Monospace</option>
                  <option value="sans">Sans-serif</option>
                  <option value="serif">Serif</option>
                </select>
              </div>
            </div>

            <!-- Colors -->
            <div class="pref-section">
              <div class="pref-section-title">
                <label class="pref-row" style="gap:8px">
                  <input type="checkbox" v-model="uiPrefs.customColors" />
                  Custom colors
                </label>
              </div>
              <div v-if="uiPrefs.customColors" class="color-grid">
                <div v-for="c in colorDefs" :key="c.key" class="color-row">
                  <label class="color-swatch-wrap" :title="c.label">
                    <input type="color" class="color-swatch" v-model="uiPrefs.colors[c.key]" />
                    <span class="color-swatch-preview" :style="{ background: uiPrefs.colors[c.key] }"></span>
                  </label>
                  <span class="color-label">{{ c.label }}</span>
                  <span class="color-hex">{{ uiPrefs.colors[c.key] }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="dialog-ftr">
            <button class="btn-secondary" @click="uiPrefOpen = false">Skip</button>
            <button class="btn-primary" @click="approveUiPrefs">Build it ➤</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue';

const props = defineProps({
  messages:  { type: Array,   required: true },
  chatInput: { type: String,  required: true },
  busy:      { type: Boolean, default: false },
  liveLogs:  { type: Array,   default: () => [] },
  services:  { type: Array,   default: () => [] }
});
const emit = defineEmits(['update:chatInput', 'send', 'cancel']); // send(text, focusIds, uiSpec|null)

// ── Auto-scroll ───────────────────────────────────────────────────────────────
const msgEl = ref(null);
watch([() => props.messages.length, () => props.liveLogs.length], () => {
  nextTick(() => { if (msgEl.value) msgEl.value.scrollTop = msgEl.value.scrollHeight; });
});

// ── Focus dialog ──────────────────────────────────────────────────────────────
const focusOpen  = ref(false);
const focusedIds = ref(new Set());

const groups = computed(() => {
  const map = new Map();
  for (const svc of props.services) {
    if (!map.has(svc.groupId)) map.set(svc.groupId, { groupId: svc.groupId, services: [], label: '' });
    map.get(svc.groupId).services.push(svc);
  }
  for (const g of map.values()) {
    const raw = g.services[0]?.name || g.groupId;
    g.label = raw.replace(/[_\s]*(db|api|backend|frontend|ui|service|store|database)\s*$/i, '').replace(/_/g, ' ').trim() || g.groupId;
  }
  return [...map.values()];
});

function isGroupChecked(g)       { return g.services.every(s => focusedIds.value.has(s.id)); }
function isGroupIndeterminate(g) { const n = g.services.filter(s => focusedIds.value.has(s.id)).length; return n > 0 && n < g.services.length; }
function toggleGroup(g)    { const all = isGroupChecked(g); const next = new Set(focusedIds.value); g.services.forEach(s => all ? next.delete(s.id) : next.add(s.id)); focusedIds.value = next; }
function toggleService(id) { const next = new Set(focusedIds.value); next.has(id) ? next.delete(id) : next.add(id); focusedIds.value = next; }
function clearFocus()      { focusedIds.value = new Set(); }

// ── Feature dialog ────────────────────────────────────────────────────────────
const fetchingFeatures = ref(false);
const featureOpen      = ref(false);
const featureAppType   = ref('');
const featureItems     = ref([]);
const customInputs     = ref(['']);
const pendingMessage   = ref('');
const pendingFocusIds  = ref([]);

function onCustomInput(i, value) {
  customInputs.value[i] = value;
  if (i === customInputs.value.length - 1 && value.trim()) customInputs.value.push('');
}
function removeCustomInput(i) {
  customInputs.value.splice(i, 1);
  if (!customInputs.value.length) customInputs.value = [''];
}
function cancelFeatures() { featureOpen.value = false; }

function approveFeatures() {
  const selected = featureItems.value.filter(f => f.checked).map(f => f.label);
  const customs  = customInputs.value.map(v => v.trim()).filter(Boolean);
  const all      = [...selected, ...customs];
  const msg = all.length ? `${pendingMessage.value} — include these features: ${all.join(', ')}` : pendingMessage.value;
  featureOpen.value = false;
  pendingMessage.value = msg;
  if (uiAuto.value) {
    emit('update:chatInput', '');
    emit('send', msg, pendingFocusIds.value, null);
  } else {
    openUiPrefs();
  }
}

// ── UI Auto toggle ────────────────────────────────────────────────────────────
const uiAuto = ref(true);

// ── UI preferences dialog ─────────────────────────────────────────────────────
const uiPrefOpen = ref(false);

const layoutOpts = [
  { key: 'nav',          label: 'Navigation bar' },
  { key: 'header',       label: 'Header / hero' },
  { key: 'leftSidebar',  label: 'Left sidebar' },
  { key: 'rightSidebar', label: 'Right sidebar' },
  { key: 'footer',       label: 'Footer' },
];

const styleOpts = [
  { key: 'animations',   label: 'Animations & transitions' },
  { key: 'responsive',   label: 'Responsive / mobile-friendly' },
  { key: 'glassmorphism',label: 'Glassmorphism / frosted glass' },
  { key: 'shadows',      label: 'Drop shadows' },
  { key: 'icons',        label: 'Icons (emoji or SVG)' },
];

const colorDefs = [
  { key: 'bg',        label: 'Background' },
  { key: 'surface',   label: 'Surface / card' },
  { key: 'accent',    label: 'Accent / primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'text',      label: 'Text' },
  { key: 'border',    label: 'Border' },
];

const uiPrefs = reactive({
  layout: { nav: false, header: true, leftSidebar: false, rightSidebar: false, footer: false },
  defaultTheme: 'dark',
  themeSwitcher: false,
  style: { animations: true, responsive: true, glassmorphism: false, shadows: true, icons: false },
  corners: 'rounded',
  font: 'sans',
  customColors: false,
  colors: { bg: '#080b10', surface: '#0e1318', accent: '#3de0a0', secondary: '#8b6dff', text: '#e8f4f0', border: '#1e2a35' },
});

function openUiPrefs() {
  uiPrefOpen.value = true;
}

function buildUiSpec() {
  // Returns a structured object — NOT appended to the message text
  const spec = {
    layout: layoutOpts.filter(o => uiPrefs.layout[o.key]).map(o => o.label),
    defaultTheme: uiPrefs.defaultTheme,
    themeSwitcher: uiPrefs.themeSwitcher,
    style: styleOpts.filter(o => uiPrefs.style[o.key]).map(o => o.label),
    corners: uiPrefs.corners,
    font: uiPrefs.font,
    colors: uiPrefs.customColors ? { ...uiPrefs.colors } : null,
  };
  return spec;
}

function approveUiPrefs() {
  uiPrefOpen.value = false;
  emit('update:chatInput', '');
  emit('send', pendingMessage.value, pendingFocusIds.value, buildUiSpec());
}

// ── Send handler ──────────────────────────────────────────────────────────────
async function handleSend() {
  if (props.busy || fetchingFeatures.value) return;
  const text = props.chatInput.trim();
  if (!text) return;

  pendingFocusIds.value = [...focusedIds.value];
  fetchingFeatures.value = true;
  try {
    const res  = await fetch('/api/suggest-features', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    if (data.isNew && data.features?.length) {
      pendingMessage.value = text;
      featureAppType.value = data.appType || 'your app';
      featureItems.value   = data.features.map(f => ({ label: f.label, checked: !!f.checked }));
      customInputs.value   = [''];
      featureOpen.value    = true;
    } else if (!uiAuto.value && data.isNew) {
      // New app but no features suggested — go straight to UI prefs
      pendingMessage.value = text;
      emit('update:chatInput', '');
      openUiPrefs();
    } else {
      emit('update:chatInput', '');
      emit('send', text, pendingFocusIds.value, null);
    }
  } catch {
    emit('update:chatInput', '');
    emit('send', text, pendingFocusIds.value);
  } finally {
    fetchingFeatures.value = false;
  }
}
</script>

<style scoped>
.sidebar {
  width: 320px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  height: 100%;
  flex-shrink: 0;
}
.sidebar-title {
  font-weight: 700;
  font-size: 13px;
  padding: 10px 12px 8px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  font-family: var(--font-ui);
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
}
.focus-badge {
  background: rgba(61,224,160,0.15);
  border: 1px solid rgba(61,224,160,0.35);
  color: var(--accent);
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 10px;
  cursor: pointer;
  font-family: var(--font-mono);
  letter-spacing: 0;
  transition: background 0.15s;
  white-space: nowrap;
}
.focus-badge:hover { background: rgba(61,224,160,0.25); }

/* UI Auto toggle pill */
.ui-auto-toggle {
  margin-left: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: 10px;
  font-family: var(--font-mono);
  letter-spacing: 0.5px;
  padding: 2px 8px;
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.ui-auto-toggle:hover { color: var(--text); border-color: var(--muted); }
.ui-auto-on {
  background: rgba(61,224,160,0.12);
  border-color: rgba(61,224,160,0.4);
  color: var(--accent);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.chat-messages::-webkit-scrollbar { width: 3px; }
.chat-messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

.msg-label { font-size: 10px; color: var(--muted); margin-bottom: 3px; font-family: var(--font-mono); letter-spacing: 0.5px; }
.msg-bubble { border-radius: 8px; padding: 8px 11px; font-size: 13px; line-height: 1.5; word-break: break-word; }
.msg-user .msg-label { text-align: right; }
.msg-user .msg-bubble { background: rgba(61,224,160,0.1); border: 1px solid rgba(61,224,160,0.2); color: var(--text); text-align: right; }
.msg-system .msg-bubble { background: var(--panel); border: 1px solid var(--border); color: var(--muted); }

.live-log-feed { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; font-family: var(--font-mono); }
.live-log-header { display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--accent); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px; }
.live-dot { width: 6px; height: 6px; background: var(--accent); border-radius: 50%; animation: pulse 1s infinite; }
.live-log-line { display: flex; gap: 7px; font-size: 11px; line-height: 1.4; opacity: 0.85; }
.live-log-type { flex-shrink: 0; width: 44px; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; padding-top: 1px; }
.live-log-msg { color: var(--muted); word-break: break-word; }
.lt-plan .live-log-type  { color: var(--blue); }
.lt-code .live-log-type  { color: var(--purple); }
.lt-deploy .live-log-type{ color: var(--accent); }
.lt-test .live-log-type  { color: var(--blue); }
.lt-fix .live-log-type   { color: var(--amber); }
.lt-error .live-log-type { color: var(--red); }
.lt-done .live-log-type  { color: var(--accent); }

.chat-input-area { display: flex; align-items: flex-end; gap: 6px; padding: 10px 12px; border-top: 1px solid var(--border); }
.focus-btn { background: var(--panel); color: var(--muted); border: 1px solid var(--border); border-radius: 6px; width: 32px; height: 36px; font-size: 15px; cursor: pointer; flex-shrink: 0; transition: color 0.15s, border-color 0.15s, background 0.15s; }
.focus-btn:hover { color: var(--accent); border-color: var(--accent); }
.focus-btn-active { color: var(--accent); border-color: var(--accent); background: rgba(61,224,160,0.08); }
.chat-input { flex: 1; min-height: 36px; max-height: 100px; resize: none; border: 1px solid var(--border); background: var(--panel); color: var(--text); border-radius: 6px; padding: 8px 10px; font-size: 13px; font-family: var(--font-mono); outline: none; transition: border-color 0.15s, opacity 0.2s; }
.chat-input:focus { border-color: var(--accent); }
.chat-input.input-busy { opacity: 0.4; }
.send-btn { background: var(--accent); color: var(--bg); border: none; border-radius: 6px; padding: 0 13px; font-size: 16px; font-weight: bold; cursor: pointer; height: 36px; flex-shrink: 0; transition: background 0.15s; }
.send-btn:hover:not(:disabled) { background: #2ec88a; }
.send-btn.send-thinking { background: var(--panel); color: var(--muted); border: 1px solid var(--border); font-size: 18px; cursor: default; }
.stop-btn { background: var(--red); color: #fff; border: none; border-radius: 6px; padding: 0 13px; font-size: 14px; font-weight: bold; cursor: pointer; height: 36px; flex-shrink: 0; transition: background 0.15s; }
.stop-btn:hover { background: #e0344f; }

/* ── Shared overlay / dialog ─────────────────────────────────── */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 1000; display: flex; align-items: center; justify-content: center; }
.dialog { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; width: 340px; max-height: 78vh; display: flex; flex-direction: column; box-shadow: 0 8px 40px rgba(0,0,0,0.5); }
.feature-dialog { width: 380px; }
.ui-dialog { width: 400px; }
.dialog-hdr { display: flex; align-items: center; justify-content: space-between; padding: 13px 16px 11px; border-bottom: 1px solid var(--border); font-family: var(--font-ui); font-weight: 700; font-size: 13px; letter-spacing: 1px; color: var(--text); gap: 8px; }
.accent-name { font-style: normal; color: var(--accent); }
.close-btn { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 13px; padding: 0 2px; line-height: 1; flex-shrink: 0; transition: color 0.15s; }
.close-btn:hover { color: var(--text); }
.dialog-body { flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.dialog-body::-webkit-scrollbar { width: 3px; }
.dialog-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
.dialog-hint { font-size: 11px; color: var(--muted); line-height: 1.5; margin: 0; }
.dialog-empty { font-size: 12px; color: var(--muted); text-align: center; padding: 20px 0; }
.dialog-ftr { display: flex; justify-content: flex-end; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--border); flex-shrink: 0; }
.btn-secondary { background: none; border: 1px solid var(--border); color: var(--muted); border-radius: 6px; padding: 5px 14px; font-size: 12px; cursor: pointer; transition: color 0.15s, border-color 0.15s; }
.btn-secondary:not(:disabled):hover { color: var(--red); border-color: var(--red); }
.btn-secondary:disabled { opacity: 0.35; cursor: default; }
.btn-primary { background: var(--accent); color: var(--bg); border: none; border-radius: 6px; padding: 5px 18px; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: background 0.15s; }
.btn-primary:hover { background: #2ec88a; }

/* ── Focus dialog ────────────────────────────────────────────── */
.focus-group { background: var(--panel); border: 1px solid var(--border); border-radius: 7px; overflow: hidden; }
.focus-group-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; cursor: pointer; border-bottom: 1px solid var(--border); background: var(--bg); }
.focus-group-row input[type="checkbox"] { accent-color: var(--accent); cursor: pointer; }
.focus-group-label { flex: 1; font-size: 12px; font-family: var(--font-ui); font-weight: 600; color: var(--text); text-transform: capitalize; }
.focus-group-pill { font-size: 10px; color: var(--muted); background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1px 6px; font-family: var(--font-mono); }
.focus-svc-row { padding: 5px 10px 5px 14px; border-bottom: 1px solid rgba(30,42,53,0.6); }
.focus-svc-row:last-child { border-bottom: none; }
.focus-svc-row label { display: flex; align-items: center; gap: 7px; cursor: pointer; }
.focus-svc-row input[type="checkbox"] { accent-color: var(--accent); cursor: pointer; }
.focus-type-dot { font-size: 9px; font-weight: 700; width: 16px; height: 16px; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.t-frontend { background: rgba(59,184,255,0.15); color: var(--blue); }
.t-backend  { background: rgba(139,109,255,0.15); color: var(--purple); }
.t-db       { background: rgba(255,179,64,0.15); color: var(--amber); }
.focus-svc-name { flex: 1; font-size: 12px; color: var(--text); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.focus-svc-port { font-size: 10px; color: var(--muted); font-family: var(--font-mono); flex-shrink: 0; }

/* ── Feature dialog ──────────────────────────────────────────── */
.feature-list { display: flex; flex-direction: column; gap: 1px; background: var(--panel); border: 1px solid var(--border); border-radius: 7px; padding: 4px 8px; }
.feature-row { display: flex; align-items: center; gap: 8px; padding: 5px 4px; cursor: pointer; border-radius: 5px; transition: background 0.1s; }
.feature-row:hover { background: rgba(255,255,255,0.03); }
.feature-row input[type="checkbox"] { accent-color: var(--accent); cursor: pointer; flex-shrink: 0; }
.feature-label { font-size: 12px; color: var(--text); font-family: var(--font-mono); }
.custom-features { display: flex; flex-direction: column; gap: 6px; }
.custom-row { display: flex; align-items: center; gap: 6px; }
.custom-input { flex: 1; background: var(--panel); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 6px 10px; font-size: 12px; font-family: var(--font-mono); outline: none; transition: border-color 0.15s; }
.custom-input:focus { border-color: var(--accent); }
.custom-input::placeholder { color: var(--muted); }
.custom-remove { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 11px; padding: 2px 4px; border-radius: 4px; transition: color 0.15s; flex-shrink: 0; }
.custom-remove:hover { color: var(--red); }

/* ── UI preferences dialog ───────────────────────────────────── */
.pref-section { display: flex; flex-direction: column; gap: 6px; }
.pref-section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); font-family: var(--font-ui); font-weight: 700; padding-bottom: 2px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
.pref-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; }
.pref-row { display: flex; align-items: center; gap: 7px; padding: 4px 6px; border-radius: 5px; cursor: pointer; transition: background 0.1s; font-size: 12px; color: var(--text); font-family: var(--font-mono); }
.pref-row:hover { background: rgba(255,255,255,0.03); }
.pref-row input[type="checkbox"],
.pref-row input[type="radio"] { accent-color: var(--accent); cursor: pointer; flex-shrink: 0; }
.pref-label { flex: 1; }
.pref-inline-select { display: flex; align-items: center; gap: 10px; }
.pref-select { background: var(--panel); border: 1px solid var(--border); color: var(--text); border-radius: 5px; padding: 3px 8px; font-size: 12px; font-family: var(--font-mono); outline: none; cursor: pointer; flex: 1; }
.pref-select:focus { border-color: var(--accent); }

/* Color pickers */
.color-grid { display: flex; flex-direction: column; gap: 5px; padding: 6px 0 0; }
.color-row { display: flex; align-items: center; gap: 10px; }
.color-swatch-wrap { display: flex; align-items: center; cursor: pointer; position: relative; }
.color-swatch { position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
.color-swatch-preview { width: 24px; height: 24px; border-radius: 5px; border: 2px solid var(--border); flex-shrink: 0; transition: border-color 0.15s; }
.color-swatch-wrap:hover .color-swatch-preview { border-color: var(--accent); }
.color-label { font-size: 12px; color: var(--text); font-family: var(--font-mono); flex: 1; }
.color-hex { font-size: 10px; color: var(--muted); font-family: var(--font-mono); }
</style>
