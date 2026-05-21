import './setup';
import { describe, it, expect, beforeEach, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { routes } from '../src/routes';
import { usersRoute } from '../src/routes/users-route';
import { productsRoute } from '../src/routes/products-route';
import { db } from '../src/db';
import { users, sessions, products, productVariants, variantAttributes, productPrices, productCosts, productImages } from '../src/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const app = new Elysia().use(routes).use(usersRoute).use(productsRoute);

const testEmail = `test-${Date.now()}@example.com`;
const testPassword = 'password123';
const testName = 'Test User';

// Use pre-created token for faster tests
let authToken: string;
let testUserId: number;

// Database readiness check
let dbAvailable = false;

beforeAll(async () => {
  try {
    await db.select().from(products).limit(1);
    await db.select().from(users).limit(1);
    await db.select().from(sessions).limit(1);
    dbAvailable = true;
    console.log('✅ Database tables are ready');
  } catch (error) {
    dbAvailable = false;
    console.log('❌ Database not ready, skipping DB-dependent tests');
  }
});

beforeEach(async () => {
  if (!dbAvailable) return;

  // Wait for database to be ready
  await new Promise(resolve => setTimeout(resolve, 500));

  // Clean up test data in correct order: prices -> attributes -> inventory -> costs -> images -> variants -> products
  try {
    // Most aggressive cleanup - delete everything in reverse dependency order
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);

    // Delete in reverse dependency order
    await db.execute(sql`DELETE FROM product_prices`);
    await db.execute(sql`DELETE FROM variant_attributes`);
    await db.execute(sql`DELETE FROM inventory`);
    await db.execute(sql`DELETE FROM product_costs`);
    await db.execute(sql`DELETE FROM product_images`);
    await db.execute(sql`DELETE FROM product_variants`);
    await db.execute(sql`DELETE FROM products`);
    await db.execute(sql`DELETE FROM warehouses`);
    await db.execute(sql`DELETE FROM sessions`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE 'test%'`);

    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
  } catch (error) {
    console.warn('Cleanup warning (non-critical):', error);
    // Continue with test - cleanup failures shouldn't stop tests
  }

  // Check if test user and token already exist
  const existingUser = await db.select().from(users).where(eq(users.email, testEmail)).limit(1);
  if (existingUser.length > 0) {
    testUserId = existingUser[0]!.id;
    const existingSession = await db.select().from(sessions).where(eq(sessions.userId, testUserId)).limit(1);
    if (existingSession.length > 0) {
      authToken = existingSession[0]!.token;
      return; // Skip setup if already exists
    }
  }

  // Create test user if not exists
  if (!existingUser.length) {
    const hashedPassword = await bcrypt.hash(testPassword, 12);
    await db.insert(users).values({
      name: testName,
      email: testEmail,
      password: hashedPassword,
    });
  }

  // Get user ID
  const user = await db.select({ id: users.id }).from(users).where(eq(users.email, testEmail)).limit(1);
  testUserId = user[0]!.id;

  // Create session token directly in DB
  authToken = `test-token-${Date.now()}`;
  await db.insert(sessions).values({
    token: authToken,
    userId: testUserId,
  });
});

// Helper function to make authenticated requests
async function makeAuthRequest(method: string, path: string, body?: any) {
  const url = `http://localhost${path}`;
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
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

// Helper function to make requests without auth
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

describe('POST /api/products — Create New Product', () => {
  it('1. Semua field valid', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('POST', '/api/products', {
      name: 'Indomie Goreng',
      description: 'Mie instan rasa goreng',
      category_id: "1",
      department_id: 2,
      is_active: true,
    });
    expect(res.status).toBe(201);
    expect(res.json.data).toHaveProperty('productId');
    expect(res.json.data.name).toBe('Indomie Goreng');
    expect(res.json.data.description).toBe('Mie instan rasa goreng');
    expect(res.json.data.categoryId).toBe(1);
    expect(res.json.data.departmentId).toBe(2);
    expect(res.json.data.isActive).toBe(true);
  });

  it('2. Only `product_name` (other optional fields not provided)', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('POST', '/api/products', {
      name: 'Test Product Only Name',
    });
    expect(res.status).toBe(201);
    expect(res.json.data.name).toBe('Test Product Only Name');
    expect(res.json.data.description).toBeNull();
    expect(res.json.data.categoryId).toBeNull();
    expect(res.json.data.departmentId).toBeNull();
    expect(res.json.data.isActive).toBe(true);
  });

  it('3. `name` not provided', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('POST', '/api/products', {
      description: 'Test Description',
    });
    expect(res.status).toBe(422);
  });

  it('4. `name` empty string', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('POST', '/api/products', {
      name: '',
    });
    expect(res.status).toBe(422);
  });

  it('5. Tanpa header Authorization', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest('POST', '/api/products', {
      name: 'Test Product',
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('6. Invalid token', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest('POST', '/api/products', {
      name: 'Test Product',
    }, {
      'Authorization': 'Bearer invalid-token',
    });

    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('7. `is_active` not provided → defaults to `true` in DB', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('POST', '/api/products', {
      name: 'Test Product Default Active',
    });
    expect(res.status).toBe(201);
    expect(res.json.data.isActive).toBe(true);
  });
});

describe('GET /api/products — List All Products', () => {
  beforeEach(async () => {
    const timestamp = Date.now();
    // Create test products with unique names
    await db.insert(products).values([
      { name: `Test Product 1-${timestamp}`, description: 'Desc 1', categoryId: 1, departmentId: 1, isActive: true },
      { name: `Test Product 2-${timestamp}`, description: 'Desc 2', categoryId: 1, departmentId: 2, isActive: false },
      { name: `Test Product 3-${timestamp}`, description: 'Desc 3', categoryId: 2, departmentId: 1, isActive: true },
    ]);
  });

  it('8. List all products (data exists)', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('GET', '/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json.data)).toBe(true);
    expect(res.json.data.length).toBeGreaterThan(0);
    expect(res.json).toHaveProperty('meta');
    expect(res.json.meta).toHaveProperty('total');
    expect(res.json.meta).toHaveProperty('page');
    expect(res.json.meta).toHaveProperty('limit');
  });

  it('9. List when no data', async () => {
    if (!dbAvailable) return;
    // More aggressive cleanup - delete all products including those from other tests
    // Delete dependent records first
    await db.execute(sql`DELETE FROM product_prices`);
    await db.execute(sql`DELETE FROM variant_attributes`);
    await db.execute(sql`DELETE FROM product_variants`);
    await db.execute(sql`DELETE FROM products`);
    const res = await makeAuthRequest('GET', '/api/products');
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual([]);
    expect(res.json.meta.total).toBe(0);
  });

  it('10. Filter `is_active=true`', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('GET', '/api/products?is_active=true');
    expect(res.status).toBe(200);
    expect(res.json.data.every((p: any) => p.isActive === true)).toBe(true);
  });

  it('11. Filter `is_active=false`', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('GET', '/api/products?is_active=false');
    expect(res.status).toBe(200);
    expect(res.json.data.every((p: any) => p.isActive === false)).toBe(true);
  });

  it('12. Filter `category_id`', async () => {
    const res = await makeAuthRequest('GET', '/api/products?category_id=1');
    expect(res.status).toBe(200);
    expect(res.json.data.every((p: any) => p.categoryId === 1)).toBe(true);
  });

  it('13. Filter `department_id`', async () => {
    const res = await makeAuthRequest('GET', '/api/products?department_id=2');
    expect(res.status).toBe(200);
    expect(res.json.data.every((p: any) => p.departmentId === 2)).toBe(true);
  });

  it('14. Pagination `page=2&limit=5`', async () => {
    const res = await makeAuthRequest('GET', '/api/products?page=2&limit=2');
    expect(res.status).toBe(200);
    expect(res.json.meta.page).toBe(2);
    expect(res.json.meta.limit).toBe(2);
  });

  it('15. `limit` exceeds total data', async () => {
    const res = await makeAuthRequest('GET', '/api/products?limit=100');
    expect(res.status).toBe(200);
    expect(res.json.data.length).toBeLessThanOrEqual(3);
  });

  it('16. Tanpa header Authorization', async () => {
    const res = await makeRequest('GET', '/api/products');
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });
});

describe('GET /api/products/:productId — Detail Product', () => {
  let testProductId: number;

  beforeEach(async () => {
    const [product] = await db.insert(products).values({
      name: 'Test Detail Product',
      description: 'Test Description',
      isActive: true,
    }).$returningId();
    testProductId = product!.productId;
  });

  it('17. `productId` valid and exists', async () => {
    const res = await makeAuthRequest('GET', `/api/products/${testProductId}`);
    expect(res.status).toBe(200);
    expect(res.json.data.productId).toBe(testProductId);
    expect(res.json.data.name).toBe('Test Detail Product');
  });

  it('18. `productId` does not exist in DB', async () => {
    const res = await makeAuthRequest('GET', '/api/products/99999');
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Product not found' });
  });

  it('19. `productId` bukan angka', async () => {
    const res = await makeAuthRequest('GET', '/api/products/abc');
    expect(res.status).toBe(422);
  });

  it('20. Tanpa header Authorization', async () => {
    const res = await makeRequest('GET', `/api/products/${testProductId}`);
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });
});

describe('PATCH /api/products/:productId — Update Product', () => {
  let testProductId: number;

  beforeEach(async () => {
    const timestamp = Date.now();
    const [product] = await db.insert(products).values({
      name: `Test Update Product-${timestamp}`,
      description: 'Original Description',
      isActive: true,
    }).$returningId();
    testProductId = product!.productId;
  });

  it('21. Update `name` only', async () => {
    const res = await makeAuthRequest('PATCH', `/api/products/${testProductId}`, {
      name: 'Updated Product Name',
    });
    expect(res.status).toBe(200);
    expect(res.json.data.name).toBe('Updated Product Name');
    expect(res.json.data.description).toBe('Original Description');
  });

  it('22. Update `description` only', async () => {
    const res = await makeAuthRequest('PATCH', `/api/products/${testProductId}`, {
      description: 'Updated Description',
    });
    expect(res.status).toBe(200);
    expect(res.json.data.description).toBe('Updated Description');
  });

  it('23. Update `is_active` from `true` to `false`', async () => {
    const res = await makeAuthRequest('PATCH', `/api/products/${testProductId}`, {
      is_active: false,
    });
    expect(res.status).toBe(200);
    expect(res.json.data.isActive).toBe(false);
  });

  it('24. Update all fields at once', async () => {
    const res = await makeAuthRequest('PATCH', `/api/products/${testProductId}`, {
      name: 'Fully Updated Product',
      description: 'Fully Updated Description',
      category_id: "5",
      department_id: 3,
      is_active: false,
    });
    expect(res.status).toBe(200);
    expect(res.json.data.name).toBe('Fully Updated Product');
    expect(res.json.data.description).toBe('Fully Updated Description');
    expect(res.json.data.categoryId).toBe(5);
    expect(res.json.data.departmentId).toBe(3);
    expect(res.json.data.isActive).toBe(false);
  });

  it('25. `productId` does not exist in DB', async () => {
    const res = await makeAuthRequest('PATCH', '/api/products/99999', {
      name: 'Nonexistent Product',
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Product not found' });
  });

  it('26. Empty body', async () => {
    const res = await makeAuthRequest('PATCH', `/api/products/${testProductId}`, {});
    expect(res.status).toBe(422);
    expect(res.json).toEqual({ error: 'At least one field must be provided' });
  });

  it('27. `productId` bukan angka', async () => {
    const res = await makeAuthRequest('PATCH', '/api/products/abc', {
      name: 'Invalid Product ID',
    });
    expect(res.status).toBe(422);
  });

  it('28. Tanpa header Authorization', async () => {
    const res = await makeRequest('PATCH', `/api/products/${testProductId}`, {
      name: 'Unauthorized Update',
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('29. `updated_at` changes after update', async () => {
    const beforeUpdate = await db.select({ updatedAt: products.updatedAt }).from(products).where(eq(products.productId, testProductId));
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    await makeAuthRequest('PATCH', `/api/products/${testProductId}`, {
      name: 'Updated for Timestamp',
    });
    const afterUpdate = await db.select({ updatedAt: products.updatedAt }).from(products).where(eq(products.productId, testProductId));
    expect(new Date(afterUpdate[0]!.updatedAt).getTime()).toBeGreaterThan(new Date(beforeUpdate[0]!.updatedAt).getTime());
  });
});

describe('DELETE /api/products/:productId — Soft Delete Product', () => {
  let testProductId: number;

  beforeEach(async () => {
    const timestamp = Date.now();
    const [product] = await db.insert(products).values({
      name: `Test Delete Product-${timestamp}`,
      description: 'Test Description',
      isActive: true,
    }).$returningId();
    testProductId = product!.productId;
  });

  it('30. `productId` valid', async () => {
    const res = await makeAuthRequest('DELETE', `/api/products/${testProductId}`);
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ data: 'OK' });
  });

  it('31. After delete, record still exists in DB', async () => {
    await makeAuthRequest('DELETE', `/api/products/${testProductId}`);
    const product = await db.select().from(products).where(eq(products.productId, testProductId));
    expect(product.length).toBe(1);
    expect(product[0]!.isActive).toBe(false);
  });

  it('32. Setelah delete, GET product tersebut tergantung filter `is_active`', async () => {
    await makeAuthRequest('DELETE', `/api/products/${testProductId}`);
    const allRes = await makeAuthRequest('GET', '/api/products');
    const activeRes = await makeAuthRequest('GET', '/api/products?is_active=true');
    const inactiveRes = await makeAuthRequest('GET', '/api/products?is_active=false');

    expect(allRes.json.data.some((p: any) => p.productId === testProductId)).toBe(true);
    expect(activeRes.json.data.some((p: any) => p.productId === testProductId)).toBe(false);
    expect(inactiveRes.json.data.some((p: any) => p.productId === testProductId)).toBe(true);
  });

  it('33. Delete twice on the same `productId`', async () => {
    const res1 = await makeAuthRequest('DELETE', `/api/products/${testProductId}`);
    const res2 = await makeAuthRequest('DELETE', `/api/products/${testProductId}`);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  it('34. `productId` does not exist in DB', async () => {
    const res = await makeAuthRequest('DELETE', '/api/products/99999');
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Product not found' });
  });

  it('35. `productId` bukan angka', async () => {
    const res = await makeAuthRequest('DELETE', '/api/products/abc');
    expect(res.status).toBe(422);
  });

  it('36. Tanpa header Authorization', async () => {
    const res = await makeRequest('DELETE', `/api/products/${testProductId}`);
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });
});