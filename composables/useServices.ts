// useServices.ts — Service list polling and management
import { ref } from 'vue';

export interface Service {
  id: string;
  name: string;
  type: 'frontend' | 'backend' | 'db';
  status: 'generating' | 'deploying' | 'running' | 'verified' | 'degraded' | 'error' | 'stopped';
  port?: number;
  groupId?: string;
  filePath?: string;
  description?: string;
  retries?: number;
  _fixRetries?: number;
}

export function useServices() {
  const services = ref<Service[]>([]);
  const loading = ref(false);
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function fetchServices() {
    loading.value = true;
    try {
      const res = await fetch('/api/services');
      const data = await res.json();
      services.value = Array.isArray(data) ? data : [];
    } catch (e: any) {
      console.error('[useServices] fetch failed:', e.message);
    } finally {
      loading.value = false;
    }
  }

  async function retryService(serviceId: string) {
    try {
      await fetch(`/api/retry/${serviceId}`, { method: 'POST' });
      setTimeout(fetchServices, 1000);
    } catch {}
  }

  async function stopService(serviceId: string) {
    try {
      await fetch(`/api/services/${serviceId}/stop`, { method: 'POST' });
      await fetchServices();
    } catch {}
  }

  async function startService(serviceId: string) {
    try {
      await fetch(`/api/services/${serviceId}/start`, { method: 'POST' });
      setTimeout(fetchServices, 1500);
    } catch {}
  }

  async function deleteService(serviceId: string) {
    try {
      await fetch(`/api/services/${serviceId}`, { method: 'DELETE' });
      await fetchServices();
    } catch {}
  }

  function startPolling(intervalMs = 4000) {
    fetchServices();
    pollTimer = setInterval(fetchServices, intervalMs);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  return { services, loading, fetchServices, retryService, stopService, startService, deleteService, startPolling, stopPolling };
}
