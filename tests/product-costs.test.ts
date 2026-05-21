import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  mock,
} from 'bun:test';
import { Elysia } from 'elysia';
import { productCostsRoute } from '../src/routes/product-costs-route';
import { db } from '../src/db';
import {
  users,
  sessions,
  products,
  productVariants,
  productCosts,
  productImages,
} from '../src/db/schema';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

// Mock Redis
mock.module('ioredis', () => ({
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
  },
}));

// Mock rate limit
mock.module('../src/middleware/rate-limit', () => ({
  rateLimit: () => (app: any) => app, // no-op middleware
}));

// Setup test database
let dbAvailable = false;

beforeAll(async () => {
  try {
    await db.select().from(users).limit(1);
    dbAvailable = true;
    console.log('Database available for tests');
  } catch (err) {
    dbAvailable = false;
    console.log('Database not available, skipping DB-dependent tests');
  }
});

const app = new Elysia().use(productCostsRoute);

const testEmail = 'productcosttest@example.com';
const testPassword = 'password123';
const testName = 'Product Cost Test User';
let testToken: string;
let testUserId: number;
let testProductId: number;
let testVariantId: number;
let testCostId: number;

beforeEach(async () => {
  if (!dbAvailable) return;

  // Cleanup test data
  try {
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    await db.delete(productCosts).where(sql`1=1`);
    await db.delete(productImages).where(sql`1=1`);
    await db.delete(productVariants).where(sql`1=1`);
    await db.delete(products).where(sql`1=1`);
    await db.delete(sessions).where(sql`1=1`);
    await db.delete(users).where(sql`1=1`);
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
  } catch (error) {
    console.log('Before cleanup error:', error);
  }

  // Create test user
  const hashedPassword = await bcrypt.hash(testPassword, 12);
  testUserId = Math.floor(Math.random() * 1000000);
  await db.insert(users).values({
    id: testUserId,
    name: testName,
    email: testEmail,
    password: hashedPassword,
  });

  // Create session token
  testToken = `test-token-${Date.now()}`;
  await db.insert(sessions).values({
    token: testToken,
    userId: testUserId,
  });

  // Create test product
  testProductId = Math.floor(Math.random() * 1000000);
  await db.insert(products).values({
    productId: testProductId,
    name: 'Test Product for Costs',
    description: 'Test Description',
    isActive: true,
  });

  // Create test variant
  testVariantId = Math.floor(Math.random() * 1000000);
  await db.insert(productVariants).values({
    id: testVariantId,
    productId: testProductId,
    sku: `TEST-COST-VARIANT-${Date.now()}`,
    variantName: 'Test Variant for Costs',
    isActive: true,
    isSellable: true,
  });
});

afterEach(async () => {
  if (!dbAvailable) return;
  // Cleanup after tests
  try {
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    await db.delete(productCosts).where(sql`1=1`);
    await db.delete(productImages).where(sql`1=1`);
    await db.delete(productVariants).where(sql`1=1`);
    await db.delete(products).where(sql`1=1`);
    await db.delete(sessions).where(sql`1=1`);
    await db.delete(users).where(sql`1=1`);
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
  } catch (error) {
    console.log('Cleanup error:', error);
  }
});

// Helper function to make authenticated requests
async function makeAuthRequest(method: string, path: string, body?: any) {
  const url = `http://localhost${path}`;
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${testToken}`,
    },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  const req = new Request(url, init);
  const res = await app.handle(req);
  const json = (await res.json().catch(() => ({}) as any)) as any;
  return { status: res.status, json };
}

// Helper function to make requests without auth
async function makeRequest(
  method: string,
  path: string,
  body?: any,
  headers?: Record<string, string>
): Promise<{ status: number; json: any }> {
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
  const json = (await res.json().catch(() => ({}) as any)) as any;
  return { status: res.status, json };
}

describe('POST /api/product-costs', () => {
  it('1. Create product cost with all valid fields', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/product-costs', {
      variant_id: testVariantId,
      cost_price: 150000.0,
      effective_date: '2026-01-01T00:00:00.000Z',
    });
    expect(res.status).toBe(201);
    expect(res.json.data).toHaveProperty('id');
    expect(res.json.data.variant_id).toBe(testVariantId);
    expect(Number(res.json.data.cost_price)).toBe(150000);
    expect(res.json.data.effective_date).toBe('2026-01-01T00:00:00.000Z');
    expect(res.json.data.created_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    );
  });

  it('2. Return 404 when variant not found', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/product-costs', {
      variant_id: 99999,
      cost_price: 150000.0,
      effective_date: '2026-01-01T00:00:00.000Z',
    });
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Variant not found');
  });

  it('3. Return 422 when cost_price is negative', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/product-costs', {
      variant_id: testVariantId,
      cost_price: -1000.0,
      effective_date: '2026-01-01T00:00:00.000Z',
    });
    expect(res.status).toBe(422);
  });

  it('4. Return 422 when cost_price not provided', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/product-costs', {
      variant_id: testVariantId,
      effective_date: '2026-01-01T00:00:00.000Z',
    });
    expect(res.status).toBe(422);
  });

  it('5. Return 422 when effective_date not provided', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/product-costs', {
      variant_id: testVariantId,
      cost_price: 150000.0,
    });
    expect(res.status).toBe(422);
  });

  it('6. Return 401 when Authorization header not present', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest('POST', '/api/product-costs', {
      variant_id: testVariantId,
      cost_price: 150000.0,
      effective_date: '2026-01-01T00:00:00.000Z',
    });
    expect(res.status).toBe(401);
  });

  it('7. Return 401 when token is invalid', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest(
      'POST',
      '/api/product-costs',
      {
        variant_id: testVariantId,
        cost_price: 150000.0,
        effective_date: '2026-01-01T00:00:00.000Z',
      },
      {
        Authorization: 'Bearer invalid-token',
      }
    );
    expect(res.status).toBe(401);
  });

  it('8. Allow multiple cost records for the same variant', async () => {
    if (!dbAvailable) return;

    // Create first cost
    await makeAuthRequest('POST', '/api/product-costs', {
      variant_id: testVariantId,
      cost_price: 100000.0,
      effective_date: '2026-01-01T00:00:00.000Z',
    });

    // Create second cost
    const res = await makeAuthRequest('POST', '/api/product-costs', {
      variant_id: testVariantId,
      cost_price: 120000.0,
      effective_date: '2026-07-01T00:00:00.000Z',
    });
    expect(res.status).toBe(201);
  });
});

describe('GET /api/product-costs/:variantId', () => {
  beforeEach(async () => {
    if (!dbAvailable) return;

    // Create test costs
    await db.insert(productCosts).values([
      {
        variantId: testVariantId,
        costPrice: '150000.00',
        effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        variantId: testVariantId,
        costPrice: '120000.00',
        effectiveDate: new Date('2026-06-01T00:00:00.000Z'),
      },
    ]);
  });

  it('9. Return all cost records for existing variant', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest(
      'GET',
      `/api/product-costs/${testVariantId}`
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json.data)).toBe(true);
    expect(res.json.data.length).toBeGreaterThan(0);
    expect(res.json.data[0]).toHaveProperty('variant_id');
    expect(res.json.data[0]).toHaveProperty('cost_price');
    expect(res.json.data[0]).toHaveProperty('effective_date');
    expect(res.json.data[0]).toHaveProperty('created_at');
  });

  it('10. Return 404 when variant not found', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('GET', '/api/product-costs/99999');
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Variant not found');
  });

  it('11. Return 401 when Authorization header not present', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest('GET', `/api/product-costs/${testVariantId}`);
    expect(res.status).toBe(401);
  });

  it('12. Return 401 when token is invalid', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest(
      'GET',
      `/api/product-costs/${testVariantId}`,
      undefined,
      {
        Authorization: 'Bearer invalid-token',
      }
    );
    expect(res.status).toBe(401);
  });

  it('13. Return empty array when variant exists but has no cost data', async () => {
    if (!dbAvailable) return;

    // Delete costs
    await db.delete(productCosts).where(sql`1=1`);

    const res = await makeAuthRequest(
      'GET',
      `/api/product-costs/${testVariantId}`
    );
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual([]);
  });
});

describe('GET /api/product-costs/:variantId/current', () => {
  it('14. Return latest cost with effective_date in the past', async () => {
    if (!dbAvailable) return;

    // Create cost with past date
    await db.insert(productCosts).values({
      variantId: testVariantId,
      costPrice: '150000.00',
      effectiveDate: new Date(Date.now() - 86400000), // 1 day ago
    });

    const res = await makeAuthRequest(
      'GET',
      `/api/product-costs/${testVariantId}/current`
    );
    expect(res.status).toBe(200);
    expect(res.json.data.variant_id).toBe(testVariantId);
    expect(Number(res.json.data.cost_price)).toBe(150000);
  });

  it('15. Return 404 when no active cost found', async () => {
    if (!dbAvailable) return;

    // Create cost with future date
    await db.insert(productCosts).values({
      variantId: testVariantId,
      costPrice: '150000.00',
      effectiveDate: new Date(Date.now() + 86400000), // 1 day in future
    });

    const res = await makeAuthRequest(
      'GET',
      `/api/product-costs/${testVariantId}/current`
    );
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Current cost not found');
  });

  it('16. Return 404 when variant has no cost data', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest(
      'GET',
      `/api/product-costs/${testVariantId}/current`
    );
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Current cost not found');
  });

  it('17. Return 404 when variant not found', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest(
      'GET',
      '/api/product-costs/99999/current'
    );
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Variant not found');
  });

  it('18. Return 401 when Authorization header not present', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest(
      'GET',
      `/api/product-costs/${testVariantId}/current`
    );
    expect(res.status).toBe(401);
  });

  it('19. Return 401 when token is invalid', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest(
      'GET',
      `/api/product-costs/${testVariantId}/current`,
      undefined,
      {
        Authorization: 'Bearer invalid-token',
      }
    );
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/product-costs/:id', () => {
  beforeEach(async () => {
    if (!dbAvailable) return;

    testCostId = Math.floor(Math.random() * 1000000);
    await db.insert(productCosts).values({
      id: testCostId,
      variantId: testVariantId,
      costPrice: '150000.00',
      effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
    });
  });

  it('20. Update cost_price only', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest(
      'PATCH',
      `/api/product-costs/${testCostId}`,
      {
        cost_price: 175000.0,
      }
    );
    expect(res.status).toBe(200);
    expect(res.json.data).toBe('OK');
  });

  it('21. Update effective_date only', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest(
      'PATCH',
      `/api/product-costs/${testCostId}`,
      {
        effective_date: '2026-06-01T00:00:00.000Z',
      }
    );
    expect(res.status).toBe(200);
    expect(res.json.data).toBe('OK');
  });

  it('22. Update all fields', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest(
      'PATCH',
      `/api/product-costs/${testCostId}`,
      {
        cost_price: 175000.0,
        effective_date: '2026-06-01T00:00:00.000Z',
      }
    );
    expect(res.status).toBe(200);
    expect(res.json.data).toBe('OK');
  });

  it('23. Return 404 when record not found', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('PATCH', '/api/product-costs/99999', {
      cost_price: 200000.0,
    });
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Data not found');
  });

  it('24. Return 422 when request body is empty', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest(
      'PATCH',
      `/api/product-costs/${testCostId}`,
      {}
    );
    expect(res.status).toBe(422);
  });

  it('25. Return 422 when cost_price is negative', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest(
      'PATCH',
      `/api/product-costs/${testCostId}`,
      {
        cost_price: -1000.0,
      }
    );
    expect(res.status).toBe(422);
  });

  it('26. Return 401 when Authorization header not present', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest('PATCH', `/api/product-costs/${testCostId}`, {
      cost_price: 200000.0,
    });
    expect(res.status).toBe(401);
  });

  it('27. Return 401 when token is invalid', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest(
      'PATCH',
      `/api/product-costs/${testCostId}`,
      {
        cost_price: 200000.0,
      },
      {
        Authorization: 'Bearer invalid-token',
      }
    );
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/product-costs/:id', () => {
  beforeEach(async () => {
    if (!dbAvailable) return;

    testCostId = Math.floor(Math.random() * 1000000);
    await db.insert(productCosts).values({
      id: testCostId,
      variantId: testVariantId,
      costPrice: '150000.00',
      effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
    });
  });

  it('28. Successfully delete existing record', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest(
      'DELETE',
      `/api/product-costs/${testCostId}`
    );
    expect(res.status).toBe(200);
    expect(res.json.data).toBe('OK');
  });

  it('29. Return 404 when record not found', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('DELETE', '/api/product-costs/99999');
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Data not found');
  });

  it('30. Return 401 when Authorization header not present', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest('DELETE', `/api/product-costs/${testCostId}`);
    expect(res.status).toBe(401);
  });

  it('31. Return 401 when token is invalid', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest(
      'DELETE',
      `/api/product-costs/${testCostId}`,
      undefined,
      {
        Authorization: 'Bearer invalid-token',
      }
    );
    expect(res.status).toBe(401);
  });
});
