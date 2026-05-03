import { Elysia } from 'elysia';
import { getMetrics } from '../lib/metrics';

export const routes = new Elysia()
  .get('/health', () => ({ status: 'ok' }), {
    detail: { summary: 'Health check endpoint' },
  })
  .get('/metrics', () => getMetrics(), {
    detail: { summary: 'Metrics endpoint for internal monitoring' },
  });
