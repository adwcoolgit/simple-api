import Redis from 'ioredis';

const redis = new Redis({
  host: Bun.env.REDIS_HOST || 'localhost',
  port: parseInt(Bun.env.REDIS_PORT || '6379'),
  password: Bun.env.REDIS_PASSWORD || undefined,
  lazyConnect: true, // Don't connect immediately
  retryDelayOnFailover: 100, // Faster retry
  maxRetriesPerRequest: 3, // Fail faster
  connectTimeout: 1000, // 1 second timeout
  commandTimeout: 500, // 0.5 second command timeout
});

// Handle connection errors gracefully
redis.on('error', (err) => {
  console.warn('Redis connection error:', err.message);
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

export { redis };