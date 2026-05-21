import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { routes } from '../src/routes';
import { usersRoute } from '../src/routes/users-route';
import { productsRoute } from '../src/routes/products-route';
import { productVariantsRoute } from '../src/routes/product-variants-route';
import { productTaxesRoute } from '../src/routes/product-taxes-route';
import { db } from '../src/db';
import { users, sessions, products, productVariants, productTaxes, inventory, productPrices, variantAttributes, productCosts, productImages, barcodes } from '../src/db/schema';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { isDbAvailable } from '../src/utils/db-utils';

const app = new Elysia().use(routes).use(usersRoute).use(productsRoute).use(productVariantsRoute).use(productTaxesRoute);

let testEmail: string;
const testPassword = 'password123';
const testName = 'Test User';

// Use pre-created token for faster tests
let authToken: string;
let testUserId: number;
let testVariantId: number;

beforeEach(async () => {
  // Generate unique email for this test run
  testEmail = `test-product-taxes-${Date.now()}-${Math.random().toString(36).substring(2)}@example.com`;

  // Clean up test data in correct order: inventory -> prices -> attributes -> costs -> images -> barcodes -> taxes -> variants -> products
  try {
    await db.delete(inventory).where(sql`1=1`);
    await db.delete(productPrices).where(sql`1=1`);
    await db.delete(variantAttributes).where(sql`1=1`);
    await db.delete(productCosts).where(sql`1=1`);
    await db.delete(productImages).where(sql`1=1`);
    await db.delete(barcodes).where(sql`1=1`);
    await db.delete(productTaxes).where(sql`1=1`);
    await db.delete(productVariants).where(sql`${productVariants.sku} like 'Test%'`);
    await db.delete(products).where(sql`${products.name} like 'Test%'`);

    // Delete sessions first (references users)
    await db.delete(sessions).where(sql`${sessions.token} like 'test-token%'`);
    // Then delete users
    await db.delete(users).where(sql`${users.email} like 'test%'`);
  } catch (error) {
    console.warn('Cleanup warning (non-critical):', error);
    // Continue with test - cleanup failures shouldn't stop tests
  }

  // Create test user and token
  const hashedPassword = await bcrypt.hash(testPassword, 12);
  await db.insert(users).values({
    name: testName,
    email: testEmail,
    password: hashedPassword,
  });

  const user = await db.select({ id: users.id }).from(users).where(eq(users.email, testEmail)).limit(1);
  testUserId = user[0]!.id;

  authToken = `test-token-${Date.now()}`;
  await db.insert(sessions).values({
    token: authToken,
    userId: testUserId,
  });

  // Create test product and variant
  const [product] = await db.insert(products).values({
    name: `Test Product-${Date.now()}`,
    description: 'Test product for taxes',
    isActive: true,
  }).$returningId();

  const [variant] = await db.insert(productVariants).values({
    productId: product!.productId,
    sku: `TEST-SKU-${Date.now()}`,
    variantName: 'Test Variant',
    isActive: true,
    isSellable: true,
  }).$returningId();

  testVariantId = variant!.id;
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

describe('POST /api/product-taxes — Add Tax Configuration', () => {
  if (!isDbAvailable()) return;

  it('1. Data lengkap dan valid (tax_code + is_inclusive)', async () => {
    const res = await makeAuthRequest('POST', '/api/product-taxes', {
      variant_id: testVariantId,
      tax_code: 'PPN-11',
      is_inclusive: false,
    });
    expect(res.status).toBe(201);
    expect(res.json.data).toHaveProperty('id');
    expect(res.json.data.variant_id).toBe(testVariantId);
    expect(res.json.data.tax_code).toBe('PPN-11');
    expect(res.json.data.is_inclusive).toBe(false);
  });

  it('2. Tanpa tax_code (opsional)', async () => {
    const res = await makeAuthRequest('POST', '/api/product-taxes', {
      variant_id: testVariantId,
      is_inclusive: true,
    });
    expect(res.status).toBe(201);
    expect(res.json.data.variant_id).toBe(testVariantId);
    expect(res.json.data.tax_code).toBeNull();
    expect(res.json.data.is_inclusive).toBe(true);
  });

  it('3. Tanpa is_inclusive', async () => {
    const res = await makeAuthRequest('POST', '/api/product-taxes', {
      variant_id: testVariantId,
      tax_code: 'PPN-12',
    });
    expect(res.status).toBe(201);
    expect(res.json.data.variant_id).toBe(testVariantId);
    expect(res.json.data.tax_code).toBe('PPN-12');
    expect(res.json.data.is_inclusive).toBe(false); // default value
  });

  it('4. variant_id does not exist in product_variants table', async () => {
    const res = await makeAuthRequest('POST', '/api/product-taxes', {
      variant_id: 99999,
      tax_code: 'PPN-11',
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Variant not found' });
  });

  it('5. variant_id already has tax configuration', async () => {
    // Create first tax configuration
    await makeAuthRequest('POST', '/api/product-taxes', {
      variant_id: testVariantId,
      tax_code: 'PPN-11',
    });

    // Try to create another for the same variant
    const res = await makeAuthRequest('POST', '/api/product-taxes', {
      variant_id: testVariantId,
      tax_code: 'PPN-12',
    });
    expect(res.status).toBe(409);
    expect(res.json).toEqual({ error: 'Variant already has a tax configuration' });
  });

  it('6. variant_id field not provided', async () => {
    const res = await makeAuthRequest('POST', '/api/product-taxes', {
      tax_code: 'PPN-11',
    });
    expect(res.status).toBe(422);
  });

  it('7. tax_code exceeds 20 characters', async () => {
    const res = await makeAuthRequest('POST', '/api/product-taxes', {
      variant_id: testVariantId,
      tax_code: 'A'.repeat(21),
    });
    expect(res.status).toBe(422);
  });

  it('8. is_inclusive bukan boolean', async () => {
    const res = await makeAuthRequest('POST', '/api/product-taxes', {
      variant_id: testVariantId,
      tax_code: 'PPN-11',
      is_inclusive: 'true',
    });
    expect(res.status).toBe(422);
  });

  it('9. variant_id bukan integer', async () => {
    const res = await makeAuthRequest('POST', '/api/product-taxes', {
      variant_id: 'invalid',
      tax_code: 'PPN-11',
    });
    expect(res.status).toBe(422);
  });

  it('10. Invalid token', async () => {
    const res = await makeRequest('POST', '/api/product-taxes', {
      variant_id: testVariantId,
      tax_code: 'PPN-11',
    }, {
      'Authorization': 'Bearer invalid-token',
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('11. Tanpa header Authorization', async () => {
    const res = await makeRequest('POST', '/api/product-taxes', {
      variant_id: testVariantId,
      tax_code: 'PPN-11',
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });
});

describe('GET /api/product-taxes/:variantId — Get Tax by Variant', () => {
  if (!isDbAvailable()) return;

  it('1. variantId valid and has tax configuration', async () => {
    // Create tax configuration first
    await makeAuthRequest('POST', '/api/product-taxes', {
      variant_id: testVariantId,
      tax_code: 'PPN-11',
      is_inclusive: false,
    });

    const res = await makeAuthRequest('GET', `/api/product-taxes/${testVariantId}`);
    expect(res.status).toBe(200);
    expect(res.json.data.variant_id).toBe(testVariantId);
    expect(res.json.data.tax_code).toBe('PPN-11');
    expect(res.json.data.is_inclusive).toBe(false);
  });

  it('2. variantId valid but has no tax configuration yet', async () => {
    const res = await makeAuthRequest('GET', `/api/product-taxes/${testVariantId}`);
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Tax configuration not found for this variant' });
  });

  it('3. variantId does not exist in product_variants', async () => {
    const res = await makeAuthRequest('GET', '/api/product-taxes/99999');
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Tax configuration not found for this variant' });
  });

  it('4. variantId bukan integer (misal string acak)', async () => {
    const res = await makeAuthRequest('GET', '/api/product-taxes/abc');
    expect(res.status).toBe(422);
  });

  it('5. Invalid token', async () => {
    const res = await makeRequest('GET', `/api/product-taxes/${testVariantId}`, undefined, {
      'Authorization': 'Bearer invalid-token',
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('6. Tanpa header Authorization', async () => {
    const res = await makeRequest('GET', `/api/product-taxes/${testVariantId}`);
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('7. Returned data matches the created one', async () => {
    await makeAuthRequest('POST', '/api/product-taxes', {
      variant_id: testVariantId,
      tax_code: 'PPN-12',
      is_inclusive: true,
    });

    const res = await makeAuthRequest('GET', `/api/product-taxes/${testVariantId}`);
    expect(res.status).toBe(200);
    expect(res.json.data.variant_id).toBe(testVariantId);
    expect(res.json.data.tax_code).toBe('PPN-12');
    expect(res.json.data.is_inclusive).toBe(true);
  });
});

describe('PATCH /api/product-taxes/:id — Update Tax Configuration', () => {
  if (!isDbAvailable()) return;

  let testTaxId: number;

  beforeEach(async () => {
    const res = await makeAuthRequest('POST', '/api/product-taxes', {
      variant_id: testVariantId,
      tax_code: 'PPN-11',
      is_inclusive: false,
    });
    testTaxId = res.json.data.id;
  });

  it('1. Update tax_code only', async () => {
    const res = await makeAuthRequest('PATCH', `/api/product-taxes/${testTaxId}`, {
      tax_code: 'PPN-12',
    });
    expect(res.status).toBe(200);
    expect(res.json.data.tax_code).toBe('PPN-12');
    expect(res.json.data.is_inclusive).toBe(false); // unchanged
  });

  it('2. Update is_inclusive only', async () => {
    const res = await makeAuthRequest('PATCH', `/api/product-taxes/${testTaxId}`, {
      is_inclusive: true,
    });
    expect(res.status).toBe(200);
    expect(res.json.data.tax_code).toBe('PPN-11'); // unchanged
    expect(res.json.data.is_inclusive).toBe(true);
  });

  it('3. Update both fields at once', async () => {
    const res = await makeAuthRequest('PATCH', `/api/product-taxes/${testTaxId}`, {
      tax_code: 'PPN-13',
      is_inclusive: true,
    });
    expect(res.status).toBe(200);
    expect(res.json.data.tax_code).toBe('PPN-13');
    expect(res.json.data.is_inclusive).toBe(true);
  });

  it('4. Update tax_code to null (remove tax code)', async () => {
    const res = await makeAuthRequest('PATCH', `/api/product-taxes/${testTaxId}`, {
      tax_code: null,
    });
    expect(res.status).toBe(200);
    expect(res.json.data.tax_code).toBeNull();
  });

  it('5. id not found', async () => {
    const res = await makeAuthRequest('PATCH', '/api/product-taxes/99999', {
      tax_code: 'PPN-12',
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Tax configuration not found for this variant' });
  });

  it('6. Empty body', async () => {
    const res = await makeAuthRequest('PATCH', `/api/product-taxes/${testTaxId}`, {});
    expect(res.status).toBe(422);
  });

  it('7. tax_code exceeds 20 characters', async () => {
    const res = await makeAuthRequest('PATCH', `/api/product-taxes/${testTaxId}`, {
      tax_code: 'A'.repeat(21),
    });
    expect(res.status).toBe(422);
  });

  it('8. is_inclusive bukan boolean', async () => {
    const res = await makeAuthRequest('PATCH', `/api/product-taxes/${testTaxId}`, {
      is_inclusive: 'true',
    });
    expect(res.status).toBe(422);
  });

  it('9. Invalid token', async () => {
    const res = await makeRequest('PATCH', `/api/product-taxes/${testTaxId}`, {
      tax_code: 'PPN-12',
    }, {
      'Authorization': 'Bearer invalid-token',
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('10. Tanpa header Authorization', async () => {
    const res = await makeRequest('PATCH', `/api/product-taxes/${testTaxId}`, {
      tax_code: 'PPN-12',
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });
});

describe('DELETE /api/product-taxes/:id — Delete Tax Configuration', () => {
  if (!isDbAvailable()) return;

  let testTaxId: number;

  beforeEach(async () => {
    const res = await makeAuthRequest('POST', '/api/product-taxes', {
      variant_id: testVariantId,
      tax_code: 'PPN-11',
      is_inclusive: false,
    });
    testTaxId = res.json.data.id;
  });

  it('1. id valid', async () => {
    const res = await makeAuthRequest('DELETE', `/api/product-taxes/${testTaxId}`);
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ data: 'OK' });
  });

  it('2. Record is actually deleted from DB after delete', async () => {
    await makeAuthRequest('DELETE', `/api/product-taxes/${testTaxId}`);
    const tax = await db.select().from(productTaxes).where(eq(productTaxes.id, testTaxId));
    expect(tax.length).toBe(0);
  });

  it('3. GET /api/product-taxes/:variantId after delete → 404', async () => {
    await makeAuthRequest('DELETE', `/api/product-taxes/${testTaxId}`);
    const getRes = await makeAuthRequest('GET', `/api/product-taxes/${testVariantId}`);
    expect(getRes.status).toBe(404);
  });

  it('4. Delete twice with the same id', async () => {
    const res1 = await makeAuthRequest('DELETE', `/api/product-taxes/${testTaxId}`);
    const res2 = await makeAuthRequest('DELETE', `/api/product-taxes/${testTaxId}`);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(404);
  });

  it('5. id not found', async () => {
    const res = await makeAuthRequest('DELETE', '/api/product-taxes/99999');
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Tax configuration not found for this variant' });
  });

  it('6. id bukan integer', async () => {
    const res = await makeAuthRequest('DELETE', '/api/product-taxes/abc');
    expect(res.status).toBe(422);
  });

  it('7. Invalid token', async () => {
    const res = await makeRequest('DELETE', `/api/product-taxes/${testTaxId}`, undefined, {
      'Authorization': 'Bearer invalid-token',
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('8. Tanpa header Authorization', async () => {
    const res = await makeRequest('DELETE', `/api/product-taxes/${testTaxId}`);
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });
});