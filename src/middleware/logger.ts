import { Elysia } from 'elysia';
import pino from 'pino';
import { recordRequest } from '../lib/metrics';

const logger = pino({
  level: 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  }),
});

export const loggerMiddleware = new Elysia()
  .onRequest(({ request }) => {
    (request as any).startTime = Date.now();
  })
  .onAfterHandle(({ request, set }) => {
    const startTime = (request as any).startTime;
    const latency = Date.now() - startTime;
    const path = new URL(request.url).pathname;
    const status = set.status || 200;

    // Record metrics
    recordRequest(path, Number(status), latency);

    logger.info({
      method: request.method,
      path,
      status,
      latency_ms: latency,
      timestamp: new Date().toISOString(),
    });
  })
  .onError(({ request, set, error }) => {
    const startTime = (request as any).startTime || Date.now();
    const latency = Date.now() - startTime;
    const path = new URL(request.url).pathname;
    const status = set.status || 500;

    // Record metrics
    recordRequest(path, Number(status), latency);

    logger.error({
      method: request.method,
      path,
      status,
      latency_ms: latency,
      timestamp: new Date().toISOString(),
      error: (error as Error)?.message || String(error),
    });
  });