// useAgent.ts — Chat messages and agent interaction
import { ref } from 'vue';

export interface ChatMessage {
  role: 'user' | 'system';
  text: string;
}

export function useAgent() {
  const messages = ref<ChatMessage[]>([
    { role: 'system', text: 'Welcome to Cadenza Agent! Type a request to deploy a new service.' }
  ]);
  const chatInput = ref('');
  const sending = ref(false);

  async function send(message: string, focusIds?: string[], uiSpec?: object | null) {
    const text = message.trim();
    if (!text || sending.value) return;
    messages.value.push({ role: 'user', text });
    chatInput.value = '';
    sending.value = true;
    messages.value.push({ role: 'system', text: '⚙ Processing...' });
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          focusIds: focusIds?.length ? focusIds : undefined,
          uiSpec: uiSpec || undefined
        })
      });
      const data = await res.json();
      // Replace the "Processing..." message
      messages.value.pop();
      if (data.ok) {
        messages.value.push({ role: 'system', text: `Agent started (${data.agentId})\nWatch the Logs tab for real-time progress.` });
      } else {
        messages.value.push({ role: 'system', text: 'Error: ' + (data.error || 'Unknown error') });
      }
    } catch (e: any) {
      messages.value.pop();
      messages.value.push({ role: 'system', text: 'Network error: ' + e.message });
    } finally {
      sending.value = false;
    }
  }

  async function sendCommand(command: string) {
    await send(command);
  }

  async function handleRetry(serviceId: string) {
    try {
      const res = await fetch(`/api/retry/${serviceId}`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        messages.value.push({ role: 'system', text: `Retry triggered for service ${serviceId}` });
      }
    } catch (e: any) {
      messages.value.push({ role: 'system', text: 'Retry failed: ' + e.message });
    }
  }

  async function cancelAgent() {
    try {
      await fetch('/api/agent/cancel', { method: 'POST' });
    } catch {}
  }

  async function confirmDelete(serviceId: string, groupId: string): Promise<boolean> {
    if (!confirm(`Delete group "${groupId}"?\nThis stops all its processes.`)) return false;
    try {
      await fetch(`/api/services/${serviceId}`, { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  }

  return { messages, chatInput, sending, send, sendCommand, handleRetry, confirmDelete, cancelAgent };
}
