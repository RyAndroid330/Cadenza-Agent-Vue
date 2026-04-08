// useLogs.ts — SSE log stream connection and filtering
import { ref, computed, onUnmounted } from 'vue';

export interface LogEntry {
  ts: number;
  type: string;
  message: string;
  data?: any;
}

export type LogFilter = 'all' | 'plan' | 'code' | 'deploy' | 'test' | 'fix' | 'error' | 'done';

export const LOG_FILTERS: LogFilter[] = ['all', 'plan', 'code', 'deploy', 'test', 'fix', 'error'];

const BUFFER_MAX = 500;

export function useLogs() {
  const logs = ref<LogEntry[]>([]);
  const filter = ref<LogFilter>('all');
  const connState = ref<'connecting' | 'connected' | 'disconnected'>('connecting');

  const filteredLogs = computed(() =>
    logs.value.filter(e =>
      filter.value === 'all' || e.type === filter.value
    )
  );

  let es: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (es) es.close();
    connState.value = 'connecting';

    const url = typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:3010/api/logs'
      : '/api/logs';

    es = new EventSource(url);
    let opened = false;

    es.onopen = () => {
      opened = true;
      connState.value = 'connected';
    };

    es.onmessage = (e) => {
      try {
        const entry: LogEntry = JSON.parse(e.data);
        logs.value.push(entry);
        if (logs.value.length > BUFFER_MAX) logs.value.shift();
      } catch {}
    };

    es.onerror = () => {
      connState.value = 'disconnected';
      es?.close();
      es = null;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 3000);
    };

    // Timeout fallback for detecting failed connections
    setTimeout(() => {
      if (!opened && connState.value === 'connecting') {
        connState.value = 'disconnected';
      }
    }, 2000);
  }

  function disconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (es) { es.close(); es = null; }
  }

  function clearLogs() {
    logs.value = [];
  }

  function setFilter(f: LogFilter) {
    filter.value = f;
  }

  onUnmounted(disconnect);

  return {
    logs,
    filteredLogs,
    filter,
    connState,
    connect,
    disconnect,
    clearLogs,
    setFilter
  };
}
