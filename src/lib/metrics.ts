// Simple in-memory metrics storage
interface EndpointMetrics {
  totalRequests: number;
  totalErrors: number;
  totalLatency: number; // sum of latencies for average calculation
  averageLatency: number;
}

const metricsStore = new Map<string, EndpointMetrics>();

export function recordRequest(endpoint: string, status: number, latency: number) {
  const existing = metricsStore.get(endpoint) || {
    totalRequests: 0,
    totalErrors: 0,
    totalLatency: 0,
    averageLatency: 0,
  };

  existing.totalRequests += 1;
  existing.totalLatency += latency;

  if (status >= 400) {
    existing.totalErrors += 1;
  }

  existing.averageLatency = existing.totalLatency / existing.totalRequests;

  metricsStore.set(endpoint, existing);
}

export function getMetrics() {
  const metrics: Record<string, EndpointMetrics> = {};
  for (const [endpoint, data] of metricsStore.entries()) {
    metrics[endpoint] = { ...data };
  }
  return metrics;
}