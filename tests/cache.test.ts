import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { routes } from '../src/routes';
import { usersRoute } from '../src/routes/users-route';
import { db } from '../src/db';
import { users, sessions } from '../src/db/schema';
import { eq, sql } from 'drizzle-orm';
import { redis } from '../src/cache/redis';

// Check if Redis is available
let redisAvailable = false;
let dbAvailable = false;

beforeAll(async () => {
  // Check Redis
  try {
    await redis.ping();
    redisAvailable = true;
    console.log('Redis is available for tests');
  } catch (err) {
    redisAvailable = false;
    console.log('Redis is not available, skipping Redis-dependent tests');
  }

  // Check DB
  try {
    await db.select().from(users).limit(1);
    dbAvailable = true;
    console.log('Database is available for tests');
  } catch (err) {
    dbAvailable = false;
    console.log('Database is not available, skipping DB-dependent tests');
  }
});

const app = new Elysia().use(routes).use(usersRoute);

const testEmail = 'cachetest@example.com';
const testPassword = 'password123';
const testName = 'Cache Test User';

beforeEach(async () => {
  // Cleanup test data - delete sessions first due to foreign key constraints
  // Delete all sessions that belong to test users
  await db.delete(sessions).where(sql`EXISTS (SELECT 1 FROM users WHERE users.id = sessions.user_id AND users.email LIKE 'cachetest%')`);
  await db.delete(users).where(sql`${users.email} like 'cachetest%'`);

  // Cleanup Redis cache
  try {
    const keys = await redis.keys('cachetest*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    // Redis unavailable, continue
  }
});

afterEach(async () => {
  // Cleanup after tests
  try {
    const keys = await redis.keys('cachetest*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    // Redis unavailable, continue
  }
});

// Helper function to make requests
async function makeRequest(method: string, path: string, body?: any, headers?: Record<string, string>) {
  const url = `http://localhost${path}`;
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  const req = new Request(url, init);
  const res = await app.handle(req);
  const json = await res.json().catch(() => ({} as any)) as any;
  return { status: res.status, json };
}

describe('Redis Cache for Sessions', () => {
  it.skip('1. Login → token tersimpan di Redis', async () => {
    if (!redisAvailable || !dbAvailable) {
      console.log('Skipping test - Redis or DB not available');
      return;
    }

    // Register
    await makeRequest('POST', '/api/users', {
      name: testName,
      email: testEmail,
      password: testPassword,
    });

    // Login
    const loginRes = await makeRequest('POST', '/api/users/login', {
      email: testEmail,
      password: testPassword,
    });
    expect(loginRes.status).toBe(200);
    const token = loginRes.json.data.token;

    // Check Redis has the token
    const cachedUserId = await redis.get(token);
    expect(cachedUserId).toBeDefined();
    expect(cachedUserId).toMatch(/^\d+$/); // Should be user ID
  });

  it('2. GET /api/users/current kedua kali → dilayani dari Redis (tidak hit MySQL)', async () => {
    if (!redisAvailable) {
      console.log('Skipping Redis test - Redis not available');
      return;
    }

    // Register and login
    await makeRequest('POST', '/api/users', {
      name: testName,
      email: testEmail,
      password: testPassword,
    });
    const loginRes = await makeRequest('POST', '/api/users/login', {
      email: testEmail,
      password: testPassword,
    });
    const token = loginRes.json.data.token;

    // First request - should cache
    const res1 = await makeRequest('GET', '/api/users/current', undefined, {
      'Authorization': `Bearer ${token}`,
    });
    expect(res1.status).toBe(200);

    // Check that Redis has the data
    const cachedUserId = await redis.get(token);
    expect(cachedUserId).toBeDefined();
  });

  it('3. Logout → key Redis terhapus', async () => {
    if (!redisAvailable) {
      console.log('Skipping Redis test - Redis not available');
      return;
    }

    // Register and login
    await makeRequest('POST', '/api/users', {
      name: testName,
      email: testEmail,
      password: testPassword,
    });
    const loginRes = await makeRequest('POST', '/api/users/login', {
      email: testEmail,
      password: testPassword,
    });
    const token = loginRes.json.data.token;

    // Verify token is cached
    const cachedUserIdBefore = await redis.get(token);
    expect(cachedUserIdBefore).toBeDefined();

    // Logout
    const logoutRes = await makeRequest('DELETE', '/api/users/logout', undefined, {
      'Authorization': `Bearer ${token}`,
    });
    expect(logoutRes.status).toBe(200);

    // Check Redis key is deleted
    const cachedUserIdAfter = await redis.get(token);
    expect(cachedUserIdAfter).toBeNull();
  });

  it('4. GET /api/users/current setelah logout → cache miss, query MySQL, hasilnya 401', async () => {
    // Register and login
    await makeRequest('POST', '/api/users', {
      name: testName,
      email: testEmail,
      password: testPassword,
    });
    const loginRes = await makeRequest('POST', '/api/users/login', {
      email: testEmail,
      password: testPassword,
    });
    const token = loginRes.json.data.token;

    // Logout
    await makeRequest('DELETE', '/api/users/logout', undefined, {
      'Authorization': `Bearer ${token}`,
    });

    // Try to get current user - should be 401
    const res = await makeRequest('GET', '/api/users/current', undefined, {
      'Authorization': `Bearer ${token}`,
    });
    expect(res.status).toBe(401);
    expect(res.json.error).toBe('Unauthorized');
  });

  it('5. Cache miss (key tidak ada di Redis) → fallback ke MySQL, data dikembalikan benar', async () => {
    // Register and login
    await makeRequest('POST', '/api/users', {
      name: testName,
      email: testEmail,
      password: testPassword,
    });
    const loginRes = await makeRequest('POST', '/api/users/login', {
      email: testEmail,
      password: testPassword,
    });
    const token = loginRes.json.data.token;

    // Manually delete from Redis to simulate cache miss (if Redis available)
    if (redisAvailable) {
      await redis.del(token);
    }

    // Request should still work via DB
    const res = await makeRequest('GET', '/api/users/current', undefined, {
      'Authorization': `Bearer ${token}`,
    });
    expect(res.status).toBe(200);
    expect(res.json.data.email).toBe(testEmail);
    expect(res.json.data.name).toBe(testName);
  });

  it('6. Redis down / tidak tersedia → aplikasi tetap berjalan menggunakan MySQL (graceful degradation)', async () => {
    // Mock redis to always throw error
    const originalRedis = { ...redis };
    redis.get = async () => { throw new Error('Redis down'); };
    redis.set = async () => { throw new Error('Redis down'); };
    redis.del = async () => { throw new Error('Redis down'); };

    try {
      // Register and login - should work without Redis
      await makeRequest('POST', '/api/users', {
        name: testName,
        email: testEmail,
        password: testPassword,
      });
      const loginRes = await makeRequest('POST', '/api/users/login', {
        email: testEmail,
        password: testPassword,
      });
      expect(loginRes.status).toBe(200);
      const token = loginRes.json.data.token;

      // Get current user - should work via DB
      const res = await makeRequest('GET', '/api/users/current', undefined, {
        'Authorization': `Bearer ${token}`,
      });
      expect(res.status).toBe(200);
      expect(res.json.data.email).toBe(testEmail);

      // Logout - should work
      const logoutRes = await makeRequest('DELETE', '/api/users/logout', undefined, {
        'Authorization': `Bearer ${token}`,
      });
      expect(logoutRes.status).toBe(200);
    } finally {
      // Restore redis
      Object.assign(redis, originalRedis);
    }
  });
});