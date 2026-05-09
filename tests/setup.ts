import { mock } from 'bun:test';
import mysql from 'mysql2/promise';

// Set test environment
process.env.DB_NAME = 'simple_api_test';

// Set environment to skip Redis for tests
process.env.REDIS_HOST = '';
process.env.REDIS_PORT = '';

// Setup test database
async function setupTestDatabase() {
  try {
    // Connect without specifying database to create it
    const connection = await mysql.createConnection({
      host: Bun.env.DB_HOST || 'localhost',
      user: Bun.env.DB_USER || 'root',
      password: Bun.env.DB_PASSWORD || '',
      port: parseInt(Bun.env.DB_PORT || '3306'),
    });

    // Create test database if it doesn't exist
    await connection.execute('CREATE DATABASE IF NOT EXISTS simple_api_test');
    await connection.end();

    // Connect to test database and run migrations
    const testConnection = await mysql.createConnection({
      host: Bun.env.DB_HOST || 'localhost',
      user: Bun.env.DB_USER || 'root',
      password: Bun.env.DB_PASSWORD || '',
      database: 'simple_api_test',
      port: parseInt(Bun.env.DB_PORT || '3306'),
    });

    // Read and execute migration file
    const fs = await import('fs');
    const path = await import('path');

    const migrationPath = path.join(process.cwd(), 'drizzle', '0000_nifty_apocalypse.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by statement-breakpoint and execute each statement
    const statements = migrationSQL.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s.length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        await testConnection.execute(statement);
      }
    }

    await testConnection.end();
    console.log('✅ Test database and migrations ready');
  } catch (error) {
    console.warn('⚠️ Could not setup test database:', error);
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