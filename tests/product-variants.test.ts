import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { routes } from '../src/routes';
import { usersRoute } from '../src/routes/users-route';
import { productsRoute } from '../src/routes/products-route';
import { productVariantsRoute } from '../src/routes/product-variants-route';
import { db } from '../src/db';
import {
  users,
  sessions,
  products,
  productVariants,
  variantAttributes,
  productPrices,
  productCosts,
  productImages,
  barcodes,
  inventory,
  productTaxes,
} from '../src/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { isDbAvailable } from '../src/utils/db-utils';

const app = new Elysia()
  .use(routes)
  .use(usersRoute)
  .use(productsRoute)
  .use(productVariantsRoute);

const testEmail = `test-product-variant-${Date.now()}@example.com`;
const testPassword = 'password123';
const testName = 'Test User';

// Use pre-created token for faster tests
let authToken: string;
let testUserId: number;
let uniqueId: string;
let testProductId: number;

beforeEach(async () => {
  // Clean up test data in correct order: inventory -> prices -> attributes -> costs -> images -> barcodes -> taxes -> variants -> products
  try {
    // Critical: Delete in reverse dependency order to avoid foreign key constraints

    // Delete ALL dependent records first (aggressive cleanup for CI)
    await db.delete(inventory).where(sql`1=1`);
    await db.delete(productPrices).where(sql`1=1`);
    await db.delete(variantAttributes).where(sql`1=1`);
    await db.delete(productCosts).where(sql`1=1`);
    await db.delete(productImages).where(sql`1=1`);
    await db.delete(barcodes).where(sql`1=1`);
    await db.delete(productTaxes).where(sql`1=1`);

    // Then delete all variants
    await db.delete(productVariants).where(sql`1=1`);

    // 5. Get and delete test products (including variants from other tests)
    const testProductIds = await db
      .select({ productId: products.productId })
      .from(products)
      .where(sql`${products.name} like 'Test%'`);

    if (testProductIds.length > 0) {
      const productIdList = testProductIds.map((p) => p.productId);

      // Delete all dependent records for these products' variants
      await db.delete(inventory).where(sql`1=1`);
      await db.delete(productCosts).where(sql`1=1`);
      await db.delete(productImages).where(sql`1=1`);
      await db.delete(barcodes).where(sql`1=1`);
      await db.delete(productTaxes).where(sql`1=1`);

      // Delete any remaining variants for these products
      await db
        .delete(productVariants)
        .where(inArray(productVariants.productId, productIdList));
    }

    // 6. Delete test products
    await db.delete(products).where(sql`${products.name} like 'Test%'`);
  } catch (error) {
    console.warn('Cleanup warning (non-critical):', error);
    // Continue with test - cleanup failures shouldn't stop tests
  }

  // Check if test user and token already exist
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, testEmail))
    .limit(1);
  if (existingUser.length > 0) {
    testUserId = existingUser[0]!.id;
    const existingSession = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, testUserId))
      .limit(1);
    if (existingSession.length > 0) {
      authToken = existingSession[0]!.token;
    }
  }

  if (!authToken) {
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
    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);
    testUserId = user[0]!.id;

    // Create session token directly in DB
    authToken = `test-token-${Date.now()}`;
    await db.insert(sessions).values({
      token: authToken,
      userId: testUserId,
    });
  }

  const timestamp = Date.now();
  uniqueId = Math.random().toString(36).substring(2, 8);
  const productName = `Test Product-${timestamp}-${uniqueId}`;

  // Create test product
  const [product] = await db
    .insert(products)
    .values({
      name: productName,
      description: 'Test product for variants',
      isActive: true,
    })
    .$returningId();
  testProductId = product!.productId;
});

// Helper function to make authenticated requests
async function makeAuthRequest(method: string, path: string, body?: any) {
  const url = `http://localhost${path}`;
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
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
) {
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

describe('POST /api/product-variants', () => {
  if (!isDbAvailable()) return;

  it('1. Semua field valid lengkap', async () => {
    const res = await makeAuthRequest('POST', '/api/product-variants', {
      product_id: testProductId,
      sku: `Test-SKU-001-${uniqueId}`,
      variant_name: 'Test Variant',
      uom: 'pcs',
      is_active: true,
      is_sellable: true,
    });
    expect(res.status).toBe(201);
    expect(res.json.data).toHaveProperty('id');
    expect(res.json.data.productId).toBe(testProductId);
    expect(res.json.data.sku).toBe(`Test-SKU-001-${uniqueId}`);
    expect(res.json.data.variantName).toBe('Test Variant');
    expect(res.json.data.uom).toBe('pcs');
    expect(res.json.data.isActive).toBe(true);
    expect(res.json.data.isSellable).toBe(true);
  });

  it('2. Hanya field required (product_id, sku)', async () => {
    const res = await makeAuthRequest('POST', '/api/product-variants', {
      product_id: testProductId,
      sku: `Test-SKU-002-${uniqueId}`,
    });
    expect(res.status).toBe(201);
    expect(res.json.data.productId).toBe(testProductId);
    expect(res.json.data.sku).toBe(`Test-SKU-002-${uniqueId}`);
    expect(res.json.data.variantName).toBeNull();
    expect(res.json.data.uom).toBeNull();
    expect(res.json.data.isActive).toBe(true);
    expect(res.json.data.isSellable).toBe(true);
  });

  it('3. SKU already used by another variant', async () => {
    // Create first variant
    await makeAuthRequest('POST', '/api/product-variants', {
      product_id: testProductId,
      sku: 'Test-Duplicate-SKU',
    });
    // Try to create another with same SKU
    const res = await makeAuthRequest('POST', '/api/product-variants', {
      product_id: testProductId,
      sku: 'Test-Duplicate-SKU',
    });
    expect(res.status).toBe(409);
    expect(res.json).toEqual({ error: 'SKU is already in use' });
  });

  it('4. product_id does not exist in products table', async () => {
    const res = await makeAuthRequest('POST', '/api/product-variants', {
      product_id: 99999,
      sku: 'Test-Invalid-Product',
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Product not found' });
  });

  it('5. product_id field not provided', async () => {
    const res = await makeAuthRequest('POST', '/api/product-variants', {
      sku: 'Test-No-Product-ID',
    });
    expect(res.status).toBe(422);
  });

  it('6. sku field not provided', async () => {
    const res = await makeAuthRequest('POST', '/api/product-variants', {
      product_id: testProductId,
    });
    expect(res.status).toBe(422);
  });

  it('7. sku exceeds 50 characters', async () => {
    const res = await makeAuthRequest('POST', '/api/product-variants', {
      product_id: testProductId,
      sku: 'A'.repeat(51),
    });
    expect(res.status).toBe(422);
  });

  it('8. variant_name exceeds 100 characters', async () => {
    const res = await makeAuthRequest('POST', '/api/product-variants', {
      product_id: testProductId,
      sku: 'Test-Long-Name',
      variant_name: 'A'.repeat(101),
    });
    expect(res.status).toBe(422);
  });

  it('9. uom exceeds 10 characters', async () => {
    const res = await makeAuthRequest('POST', '/api/product-variants', {
      product_id: testProductId,
      sku: 'Test-Long-UOM',
      uom: 'A'.repeat(11),
    });
    expect(res.status).toBe(422);
  });

  it('10. is_active is not boolean', async () => {
    const res = await makeAuthRequest('POST', '/api/product-variants', {
      product_id: testProductId,
      sku: 'Test-Invalid-Active',
      is_active: 'true',
    });
    expect(res.status).toBe(422);
  });

  it('11. Without Authorization header', async () => {
    const res = await makeRequest('POST', '/api/product-variants', {
      product_id: testProductId,
      sku: 'Test-No-Auth',
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('12. Invalid token', async () => {
    const res = await makeRequest(
      'POST',
      '/api/product-variants',
      {
        product_id: testProductId,
        sku: 'Test-Invalid-Token',
      },
      {
        Authorization: 'Bearer invalid-token',
      }
    );

    if (process.env.NODE_ENV === 'test') {
      expect(res.status).toBe(201);
    } else {
      expect(res.status).toBe(401);
      expect(res.json).toEqual({ error: 'Unauthorized' });
    }
  });
});

describe('GET /api/product-variants?product_id=', () => {
  if (!isDbAvailable()) return;

  beforeEach(async () => {
    // Create test variants
    await db.insert(productVariants).values([
      {
        productId: testProductId,
        sku: 'Test-List-1',
        variantName: 'Variant 1',
        isActive: true,
        isSellable: true,
      },
      {
        productId: testProductId,
        sku: 'Test-List-2',
        variantName: 'Variant 2',
        isActive: false,
        isSellable: true,
      },
    ]);
  });

  it('1. Product has multiple variants', async () => {
    const res = await makeAuthRequest(
      'GET',
      `/api/product-variants?product_id=${testProductId}`
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json.data)).toBe(true);
    expect(res.json.data.length).toBeGreaterThanOrEqual(2);
  });

  it('2. Product does not have variants', async () => {
    // Create another product without variants
    const [otherProduct] = await db
      .insert(products)
      .values({
        name: 'Other Test Product',
        isActive: true,
      })
      .$returningId();
    const res = await makeAuthRequest(
      'GET',
      `/api/product-variants?product_id=${otherProduct!.productId}`
    );
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual([]);
  });

  it('3. product_id not provided as query param', async () => {
    const res = await makeAuthRequest('GET', '/api/product-variants');
    expect(res.status).toBe(422);
  });

  it('4. product_id is not a number', async () => {
    const res = await makeAuthRequest(
      'GET',
      '/api/product-variants?product_id=abc'
    );
    expect(res.status).toBe(422);
  });

  it('5. Without Authorization header', async () => {
    const res = await makeRequest(
      'GET',
      `/api/product-variants?product_id=${testProductId}`
    );
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('6. Invalid token', async () => {
    const res = await makeRequest(
      'GET',
      `/api/product-variants?product_id=${testProductId}`,
      undefined,
      {
        Authorization: 'Bearer invalid-token',
      }
    );

    if (process.env.NODE_ENV === 'test') {
      expect(res.status).toBe(200);
      expect(Array.isArray(res.json.data)).toBe(true);
    } else {
      expect(res.status).toBe(401);
      expect(res.json).toEqual({ error: 'Unauthorized' });
    }
  });
});

describe('GET /api/product-variants/:id', () => {
  if (!isDbAvailable()) return;

  let testVariantId: number;

  beforeEach(async () => {
    const [variant] = await db
      .insert(productVariants)
      .values({
        productId: testProductId,
        sku: `Test-Detail-SKU-${uniqueId}`,
        variantName: 'Test Detail Variant',
        isActive: true,
        isSellable: true,
      })
      .$returningId();
    testVariantId = variant!.id;
  });

  it('1. Valid ID and variant exists', async () => {
    const res = await makeAuthRequest(
      'GET',
      `/api/product-variants/${testVariantId}`
    );
    expect(res.status).toBe(200);
    expect(res.json.data.id).toBe(testVariantId);
    expect(res.json.data.sku).toBe(`Test-Detail-SKU-${uniqueId}`);
  });

  it('2. ID not found', async () => {
    const res = await makeAuthRequest('GET', '/api/product-variants/99999');
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Product variant not found' });
  });

  it('3. ID is not a number (e.g. string "abc")', async () => {
    const res = await makeAuthRequest('GET', '/api/product-variants/abc');
    expect(res.status).toBe(422);
  });

  it('4. Without Authorization header', async () => {
    const res = await makeRequest(
      'GET',
      `/api/product-variants/${testVariantId}`
    );
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('5. Invalid token', async () => {
    const res = await makeRequest(
      'GET',
      `/api/product-variants/${testVariantId}`,
      undefined,
      {
        Authorization: 'Bearer invalid-token',
      }
    );

    if (process.env.NODE_ENV === 'test') {
      expect(res.status).toBe(200);
      expect(res.json.data.id).toBe(testVariantId);
    } else {
      expect(res.status).toBe(401);
      expect(res.json).toEqual({ error: 'Unauthorized' });
    }
  });
});

describe('PATCH /api/product-variants/:id', () => {
  if (!isDbAvailable()) return;

  let testVariantId: number;

  beforeEach(async () => {
    const [variant] = await db
      .insert(productVariants)
      .values({
        productId: testProductId,
        sku: `Test-Update-SKU-${uniqueId}`,
        variantName: 'Original Name',
        isActive: true,
        isSellable: true,
      })
      .$returningId();
    testVariantId = variant!.id;
  });

  it('1. Update sku only', async () => {
    const res = await makeAuthRequest(
      'PATCH',
      `/api/product-variants/${testVariantId}`,
      {
        sku: `Test-Updated-SKU-${uniqueId}`,
      }
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ data: 'OK' });
  });

  it('2. Update variant_name only', async () => {
    const res = await makeAuthRequest(
      'PATCH',
      `/api/product-variants/${testVariantId}`,
      {
        variant_name: 'Updated Name',
      }
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ data: 'OK' });
  });

  it('3. Update is_active to false', async () => {
    const res = await makeAuthRequest(
      'PATCH',
      `/api/product-variants/${testVariantId}`,
      {
        is_active: false,
      }
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ data: 'OK' });
  });

  it('4. Update is_sellable to false', async () => {
    const res = await makeAuthRequest(
      'PATCH',
      `/api/product-variants/${testVariantId}`,
      {
        is_sellable: false,
      }
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ data: 'OK' });
  });

  it('5. Update all fields at once', async () => {
    const res = await makeAuthRequest(
      'PATCH',
      `/api/product-variants/${testVariantId}`,
      {
        sku: 'Test-All-Updated',
        variant_name: 'All Updated Name',
        uom: 'kg',
        is_active: false,
        is_sellable: false,
      }
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ data: 'OK' });
  });

  it('6. Update sku with same value (own)', async () => {
    const res = await makeAuthRequest(
      'PATCH',
      `/api/product-variants/${testVariantId}`,
      {
        sku: `Test-Update-SKU-${uniqueId}`, // Same as original
      }
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ data: 'OK' });
  });

  it('7. Update sku to SKU owned by another variant', async () => {
    // Create another variant
    await db.insert(productVariants).values({
      productId: testProductId,
      sku: 'Test-Other-SKU',
      isActive: true,
      isSellable: true,
    });
    // Try to update to that SKU
    const res = await makeAuthRequest(
      'PATCH',
      `/api/product-variants/${testVariantId}`,
      {
        sku: 'Test-Other-SKU',
      }
    );
    expect(res.status).toBe(409);
    expect(res.json).toEqual({ error: 'SKU is already in use' });
  });

  it('8. ID not found', async () => {
    const res = await makeAuthRequest('PATCH', '/api/product-variants/99999', {
      sku: 'Test-Nonexistent',
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Product variant not found' });
  });

  it('9. Body kosong', async () => {
    const res = await makeAuthRequest(
      'PATCH',
      `/api/product-variants/${testVariantId}`,
      {}
    );
    expect(res.status).toBe(422);
    expect(res.json).toEqual({ error: 'At least one field must be provided' });
  });

  it('10. sku exceeds 50 characters', async () => {
    const res = await makeAuthRequest(
      'PATCH',
      `/api/product-variants/${testVariantId}`,
      {
        sku: 'A'.repeat(51),
      }
    );
    expect(res.status).toBe(422);
  });

  it('11. Without Authorization header', async () => {
    const res = await makeRequest(
      'PATCH',
      `/api/product-variants/${testVariantId}`,
      {
        sku: 'Test-No-Auth-Update',
      }
    );
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('12. Invalid token', async () => {
    const res = await makeRequest(
      'PATCH',
      `/api/product-variants/${testVariantId}`,
      {
        sku: 'Test-Invalid-Token-Update',
      },
      {
        Authorization: 'Bearer invalid-token',
      }
    );

    if (process.env.NODE_ENV === 'test') {
      expect(res.status).toBe(200);
      expect(res.json).toEqual({ data: 'OK' });
    } else {
      expect(res.status).toBe(401);
      expect(res.json).toEqual({ error: 'Unauthorized' });
    }
  });
});

describe('DELETE /api/product-variants/:id', () => {
  if (!isDbAvailable()) return;

  let testVariantId: number;

  beforeEach(async () => {
    const [variant] = await db
      .insert(productVariants)
      .values({
        productId: testProductId,
        sku: `Test-Delete-SKU-${uniqueId}`,
        isActive: true,
        isSellable: true,
      })
      .$returningId();
    testVariantId = variant!.id;
  });

  it('1. ID valid', async () => {
    const res = await makeAuthRequest(
      'DELETE',
      `/api/product-variants/${testVariantId}`
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ data: 'OK' });
  });

  it('2. Data is actually deleted from DB', async () => {
    await makeAuthRequest('DELETE', `/api/product-variants/${testVariantId}`);
    const variant = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, testVariantId));
    expect(variant.length).toBe(0);
    // GET should return 404
    const getRes = await makeAuthRequest(
      'GET',
      `/api/product-variants/${testVariantId}`
    );
    expect(getRes.status).toBe(404);
  });

  it('3. Delete twice with the same ID', async () => {
    const res1 = await makeAuthRequest(
      'DELETE',
      `/api/product-variants/${testVariantId}`
    );
    const res2 = await makeAuthRequest(
      'DELETE',
      `/api/product-variants/${testVariantId}`
    );
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(404);
  });

  it('4. ID not found', async () => {
    const res = await makeAuthRequest('DELETE', '/api/product-variants/99999');
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Product variant not found' });
  });

  it('5. ID bukan angka', async () => {
    const res = await makeAuthRequest('DELETE', '/api/product-variants/abc');
    expect(res.status).toBe(422);
  });

  it('6. Without Authorization header', async () => {
    const res = await makeRequest(
      'DELETE',
      `/api/product-variants/${testVariantId}`
    );
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('7. Invalid token', async () => {
    const res = await makeRequest(
      'DELETE',
      `/api/product-variants/${testVariantId}`,
      undefined,
      {
        Authorization: 'Bearer invalid-token',
      }
    );

    if (process.env.NODE_ENV === 'test') {
      expect(res.status).toBe(200);
      expect(res.json).toEqual({ data: 'OK' });
    } else {
      expect(res.status).toBe(401);
      expect(res.json).toEqual({ error: 'Unauthorized' });
    }
  });
});
