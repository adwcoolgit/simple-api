import { Elysia } from 'elysia';
import { redis } from '../cache/redis';

// In-memory fallback when Redis is unavailable
const memoryStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(options: { windowMs: number; max: number; message?: string }) {
  const { windowMs, max, message = 'Too many requests, please try again later' } = options;

  return new Elysia()
    .onBeforeHandle(async ({ request, set }) => {
      const clientIP = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      '127.0.0.1'; // fallback for local dev

      const endpoint = new URL(request.url).pathname;
      const key = `${clientIP}:${endpoint}`;

      const now = Date.now();
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const resetTime = windowStart + windowMs;

      try {
        // Try Redis first
        const current = await redis.get(key);
        let count = current ? parseInt(current) : 0;

        if (count >= max) {
          const retryAfter = Math.ceil((resetTime - now) / 1000);
          set.status = 429;
          set.headers['Retry-After'] = retryAfter.toString();
          return { error: message };
        }

        count += 1;
        await redis.set(key, count.toString(), 'PX', windowMs);
      } catch (err) {
        // Fallback to in-memory store
        console.warn('Redis unavailable for rate limiting, using in-memory fallback:', err);

        const record = memoryStore.get(key);
        if (record && record.resetTime > now) {
          if (record.count >= max) {
            const retryAfter = Math.ceil((record.resetTime - now) / 1000);
            set.status = 429;
            set.headers['Retry-After'] = retryAfter.toString();
            return { error: message };
          }
          record.count += 1;
        } else {
          memoryStore.set(key, { count: 1, resetTime });
        }
      }
    });
}