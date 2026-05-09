import { mock } from 'bun:test';
import mysql from 'mysql2/promise';

// Set test environment
process.env.DB_NAME = 'simple_api_test';

// Set environment to skip Redis for tests
process.env.REDIS_HOST = '';
process.env.REDIS_PORT = '';

// Setup test database
async function setupTestDatabase() {
  console.log('🔄 Checking database connection...');

  try {
    // Try to connect with different host options
    let testConnection;
    const hosts = ['localhost', '127.0.0.1'];
    let connected = false;

    for (const host of hosts) {
      try {
        console.log(`Trying to connect to MySQL at ${host}:3306...`);
        testConnection = await mysql.createConnection({
          host: host,
          user: Bun.env.DB_USER || 'root',
          password: Bun.env.DB_PASSWORD || '',
          database: 'simple_api_test',
          port: parseInt(Bun.env.DB_PORT || '3306'),
          connectTimeout: 5000,
        });

        // Test the connection with a simple query
        await testConnection.execute('SELECT 1');
        console.log(`✅ Connected to MySQL at ${host}:3306`);
        connected = true;
        break;
      } catch (hostError) {
        console.log(`❌ Failed to connect to ${host}:3306`);
        if (testConnection) {
          try {
            await testConnection.end();
          } catch {}
        }
      }
    }

    if (!connected) {
      throw new Error('Could not connect to MySQL on any host');
    }

    await testConnection!.end();
    console.log('✅ Test database connection verified');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('💡 Make sure MySQL is running on localhost:3306');
    console.error('💡 Default credentials: root / (empty password)');
    console.error('💡 Or set DB_HOST, DB_USER, DB_PASSWORD environment variables');

    // Don't exit - allow tests to run in mock mode or skip database tests
    console.log('⚠️ Continuing with tests that may not require database...');
  }
}

// Run setup before tests
await setupTestDatabase();

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