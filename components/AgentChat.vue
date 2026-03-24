<template>
  <div class="sidebar">
    <div class="sidebar-title">▸ Agent Chat</div>
    <div class="chat-messages">
      <div v-for="(m,i) in messages" :key="i" :class="'msg '+m.role">
        <div class="msg-label">{{m.role==='user'?'you':m.role==='agent'?'cadenza agent':'system'}}</div>
        <div class="msg-bubble" v-html="m.text.replace(/\n/g,'<br>')"></div>
      </div>
    </div>
    <div class="chat-input-area">
      <textarea
        class="chat-input"
        placeholder="Type your message..."
        :value="chatInput"
        @input="e => $emit('update:chatInput', e.target.value)"
        @keydown.enter.exact.prevent="$emit('send', chatInput)"
      ></textarea>
      <button class="send-btn" @click="$emit('send', chatInput)">➤</button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  messages: { type: Array, required: true },
  chatInput: { type: String, required: true }
});
const emit = defineEmits(['update:chatInput', 'send']);
</script>

<style scoped>
.sidebar {
  width: 320px;
  background: var(--sidebar-bg, #181c20);
  border-right: 1.5px solid var(--border, #23272e);
  display: flex;
  flex-direction: column;
  height: 100%;
}
.sidebar-title {
  font-weight: 700;
  font-size: 15px;
  padding: 16px 16px 8px 16px;
  border-bottom: 1px solid var(--border, #23272e);
}
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: var(--sidebar-bg, #181c20);
}
.msg {
  margin-bottom: 12px;
}
.msg-label {
  font-size: 11px;
  color: var(--muted, #888);
  margin-bottom: 2px;
}
.msg-bubble {
  background: var(--bubble-bg, #23272e);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--text, #fff);
  word-break: break-word;
}
.chat-input-area {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid var(--border, #23272e);
  background: var(--sidebar-bg, #181c20);
}
.chat-input {
  flex: 1;
  min-height: 32px;
  max-height: 80px;
  resize: none;
  border: none;
  background: var(--input-bg, #23272e);
  color: var(--text, #fff);
  border-radius: 6px;
  padding: 8px;
  font-size: 14px;
  margin-right: 8px;
}
.send-btn {
  background: var(--accent, #00e676);
  color: #181c20;
  border: none;
  border-radius: 6px;
  padding: 0 14px;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  height: 32px;
  transition: background 0.2s;
}
.send-btn:hover {
  background: var(--accent-hover, #00c853);
}
</style>
