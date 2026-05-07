import { mock } from 'bun:test';

// Set environment to skip Redis
process.env.REDIS_HOST = '';
process.env.REDIS_PORT = '';

mock('ioredis', () => ({
  default: class MockRedis {
    constructor() {
      // Mock constructor
    }
    async connect() {
      // Do nothing, pretend connected
    }
    async get(key: string) {
      // Return null to simulate cache miss
      return null;
    }
    async set(key: string, value: any) {
      // Do nothing
    }
    async del(key: string) {
      // Do nothing
    }
    async exists(key: string) {
      return 0; // not exists
    }
    async expire(key: string, ttl: number) {
      // Do nothing
    }
    async ttl(key: string) {
      return -1; // not set
    }
    async incr(key: string) {
      return 1;
    }
    async decr(key: string) {
      return 0;
    }
    on(event: string, callback: Function) {
      // Do nothing
    }
    // Add more methods as needed
  }
}));

// Mock rate limit to no-op
mock('../src/middleware/rate-limit', () => ({
  rateLimit: () => (app: any) => app, // no-op middleware
}));