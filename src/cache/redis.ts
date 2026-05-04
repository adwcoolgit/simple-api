import Redis from 'ioredis';

// Create Redis connection with basic configuration
const redis = new Redis({
  host: Bun.env.REDIS_HOST || 'localhost',
  port: parseInt(Bun.env.REDIS_PORT || '6379'),
  password: Bun.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
});

// Handle connection errors gracefully
redis.on('error', (err) => {
  console.warn('Redis connection error:', err.message);
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

export { redis };