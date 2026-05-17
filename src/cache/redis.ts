import Redis from 'ioredis';

// Create Redis connection with robust configuration
const redis = new Redis({
  host: Bun.env.REDIS_HOST || 'localhost',
  port: parseInt(Bun.env.REDIS_PORT || '6379'),
  password: Bun.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  enableReadyCheck: false,
  maxRetriesPerRequest: 3,
  reconnectOnError: (err) => {
    console.warn('Redis reconnect on error:', err.message);
    return err.message.includes('READONLY');
  },
});

// Handle connection events
redis.on('error', (err) => {
  console.warn('Redis connection error:', err.message);
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

redis.on('ready', () => {
  console.log('Redis connection ready');
});

redis.on('close', () => {
  console.log('Redis connection closed');
});

// Test connection on startup (optional, non-blocking)
setTimeout(async () => {
  try {
    await redis.ping();
    console.log('Redis ping successful');
  } catch (err) {
    console.warn('Redis ping failed on startup:', err);
  }
}, 1000);

export { redis };
