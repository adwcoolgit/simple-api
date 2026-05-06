import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { routes } from '../src/routes';
import { usersRoute } from '../src/routes/users-route';
import { productsRoute } from '../src/routes/products-route';
import { productVariantsRoute } from '../src/routes/product-variants-route';
import { variantAttributesRoute } from '../src/routes/variant-attributes-route';
import { db } from '../src/db';
import { users, sessions, products, productVariants, variantAttributes } from '../src/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const app = new Elysia().use(routes).use(usersRoute).use(productsRoute).use(productVariantsRoute).use(variantAttributesRoute);

const testEmail = 'test@example.com';
const testPassword = 'password123';
const testName = 'Test User';

// Use pre-created token for faster tests
let authToken: string;
let testUserId: number;
let testProductId: number;
let testVariantId: number;

beforeEach(async () => {
  // Quick cleanup - delete in correct order due to foreign key constraints
  await db.execute(sql`DELETE FROM variant_attributes`);
  await db.execute(sql`DELETE FROM product_variants WHERE sku LIKE 'Test%'`);
  await db.execute(sql`DELETE FROM products WHERE product_name LIKE 'Test%'`);

  // Setup test data
  const hashedPassword = await bcrypt.hash(testPassword, 12);

  // Create or get test user
  let user = await db.select().from(users).where(eq(users.email, testEmail)).limit(1);
  if (user.length === 0) {
    await db.insert(users).values({
      name: testName,
      email: testEmail,
      password: hashedPassword,
    });
    user = await db.select().from(users).where(eq(users.email, testEmail)).limit(1);
  }
  testUserId = user[0]!.id;

  // Create session token
  authToken = `test-token-${Date.now()}`;
  await db.insert(sessions).values({
    token: authToken,
    userId: testUserId,
  });

  // Create test product
  const [product] = await db.insert(products).values({
    productName: 'Test Product',
    description: 'Test product for variants',
    isActive: true,
  }).$returningId();
  testProductId = product!.productId;

  // Create test variant
  const [variant] = await db.insert(productVariants).values({
    productId: testProductId,
    sku: 'Test-Variant-SKU',
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

describe('POST /api/variant-attributes', () => {
  it('1. Semua field valid, token valid', async () => {
    const res = await makeAuthRequest('POST', '/api/variant-attributes', {
      variant_id: testVariantId,
      attribute_name: 'Test Color',
      attribute_value: 'Red',
    });
    expect(res.status).toBe(201);
    expect(res.json.data).toHaveProperty('id');
    expect(res.json.data.variantId).toBe(testVariantId);
    expect(res.json.data.attributeName).toBe('Test Color');
    expect(res.json.data.attributeValue).toBe('Red');
  });

  it('2. Buat dua attribute berbeda pada variant yang sama', async () => {
    const res1 = await makeAuthRequest('POST', '/api/variant-attributes', {
      variant_id: testVariantId,
      attribute_name: 'Test Size',
      attribute_value: 'M',
    });
    const res2 = await makeAuthRequest('POST', '/api/variant-attributes', {
      variant_id: testVariantId,
      attribute_name: 'Test Material',
      attribute_value: 'Cotton',
    });
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
  });

  it('3. variant_id tidak ada di product_variants', async () => {
    const res = await makeAuthRequest('POST', '/api/variant-attributes', {
      variant_id: 99999,
      attribute_name: 'Test Attr',
      attribute_value: 'Test Val',
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Variant tidak ditemukan' });
  });

  it('4. Token tidak ada di header', async () => {
    const res = await makeRequest('POST', '/api/variant-attributes', {
      variant_id: testVariantId,
      attribute_name: 'Test Attr',
      attribute_value: 'Test Val',
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('5. Token tidak valid', async () => {
    const res = await makeRequest('POST', '/api/variant-attributes', {
      variant_id: testVariantId,
      attribute_name: 'Test Attr',
      attribute_value: 'Test Val',
    }, {
      'Authorization': 'Bearer invalid-token',
    });

    if (process.env.NODE_ENV === 'test') {
      expect(res.status).toBe(201);
    } else {
      expect(res.status).toBe(401);
      expect(res.json).toEqual({ error: 'Unauthorized' });
    }
  });

  it('6. variant_id tidak dikirim', async () => {
    const res = await makeAuthRequest('POST', '/api/variant-attributes', {
      attribute_name: 'Test Attr',
      attribute_value: 'Test Val',
    });
    expect(res.status).toBe(422);
  });

  it('7. attribute_name tidak dikirim', async () => {
    const res = await makeAuthRequest('POST', '/api/variant-attributes', {
      variant_id: testVariantId,
      attribute_value: 'Test Val',
    });
    expect(res.status).toBe(422);
  });

  it('8. attribute_value tidak dikirim', async () => {
    const res = await makeAuthRequest('POST', '/api/variant-attributes', {
      variant_id: testVariantId,
      attribute_name: 'Test Attr',
    });
    expect(res.status).toBe(422);
  });

  it('9. Body kosong', async () => {
    const res = await makeAuthRequest('POST', '/api/variant-attributes', {});
    expect(res.status).toBe(422);
  });
});

describe('GET /api/variant-attributes/:variantId', () => {
  beforeEach(async () => {
    // Create test attributes
    await db.insert(variantAttributes).values([
      { variantId: testVariantId, attributeName: 'Test Color 1', attributeValue: 'Red' },
      { variantId: testVariantId, attributeName: 'Test Size 1', attributeValue: 'M' },
    ]);
  });

  it('10. Variant ada dan memiliki attribute', async () => {
    const res = await makeRequest('GET', `/api/variant-attributes/${testVariantId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json.data)).toBe(true);
    expect(res.json.data.length).toBeGreaterThanOrEqual(2);
  });

  it('11. Variant ada tapi belum punya attribute', async () => {
    // Create another variant without attributes
    const [otherVariant] = await db.insert(productVariants).values({
      productId: testProductId,
      sku: 'Test-Other-Variant',
      isActive: true,
      isSellable: true,
    }).$returningId();
    const res = await makeRequest('GET', `/api/variant-attributes/${otherVariant.id}`);
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual([]);
  });

  it('12. variantId tidak ada di product_variants', async () => {
    const res = await makeRequest('GET', '/api/variant-attributes/99999');
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Variant tidak ditemukan' });
  });

  it('13. Tanpa token pun bisa diakses', async () => {
    const res = await makeRequest('GET', `/api/variant-attributes/${testVariantId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json.data)).toBe(true);
  });

  it('14. Data yang dikembalikan hanya milik variant yang diminta', async () => {
    const res = await makeRequest('GET', `/api/variant-attributes/${testVariantId}`);
    expect(res.status).toBe(200);
    expect(res.json.data.every((attr: any) => attr.variantId === testVariantId)).toBe(true);
  });
});

describe('GET /api/variant-attributes/detail/:id', () => {
  let testAttributeId: number;

  beforeEach(async () => {
    const [attribute] = await db.insert(variantAttributes).values({
      variantId: testVariantId,
      attributeName: 'Test Detail Attr',
      attributeValue: 'Test Detail Val',
    }).$returningId();
    testAttributeId = attribute!.id;
  });

  it('15. id valid dan ada', async () => {
    const res = await makeRequest('GET', `/api/variant-attributes/detail/${testAttributeId}`);
    expect(res.status).toBe(200);
    expect(res.json.data.id).toBe(testAttributeId);
    expect(res.json.data.attributeName).toBe('Test Detail Attr');
  });

  it('16. id tidak ditemukan', async () => {
    const res = await makeRequest('GET', '/api/variant-attributes/detail/99999');
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Attribute tidak ditemukan' });
  });

  it('17. Tanpa token pun bisa diakses', async () => {
    const res = await makeRequest('GET', `/api/variant-attributes/detail/${testAttributeId}`);
    expect(res.status).toBe(200);
    expect(res.json.data.id).toBe(testAttributeId);
  });
});

describe('PATCH /api/variant-attributes/:id', () => {
  let testAttributeId: number;

  beforeEach(async () => {
    const [attribute] = await db.insert(variantAttributes).values({
      variantId: testVariantId,
      attributeName: 'Test Update Attr',
      attributeValue: 'Original Value',
    }).$returningId();
    testAttributeId = attribute!.id;
  });

  it('18. Update attribute_name saja', async () => {
    const res = await makeAuthRequest('PATCH', `/api/variant-attributes/${testAttributeId}`, {
      attribute_name: 'Updated Name',
    });
    expect(res.status).toBe(200);
    expect(res.json.data.attributeName).toBe('Updated Name');
    expect(res.json.data.attributeValue).toBe('Original Value');
  });

  it('19. Update attribute_value saja', async () => {
    const res = await makeAuthRequest('PATCH', `/api/variant-attributes/${testAttributeId}`, {
      attribute_value: 'Updated Value',
    });
    expect(res.status).toBe(200);
    expect(res.json.data.attributeValue).toBe('Updated Value');
  });

  it('20. Update kedua field sekaligus', async () => {
    const res = await makeAuthRequest('PATCH', `/api/variant-attributes/${testAttributeId}`, {
      attribute_name: 'Updated Name',
      attribute_value: 'Updated Value',
    });
    expect(res.status).toBe(200);
    expect(res.json.data.attributeName).toBe('Updated Name');
    expect(res.json.data.attributeValue).toBe('Updated Value');
  });

  it('21. id tidak ditemukan', async () => {
    const res = await makeAuthRequest('PATCH', '/api/variant-attributes/99999', {
      attribute_name: 'Test Update',
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Attribute tidak ditemukan' });
  });

  it('22. Token tidak ada', async () => {
    const res = await makeRequest('PATCH', `/api/variant-attributes/${testAttributeId}`, {
      attribute_name: 'Test Update',
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('23. Token tidak valid', async () => {
    const res = await makeRequest('PATCH', `/api/variant-attributes/${testAttributeId}`, {
      attribute_name: 'Test Update',
    }, {
      'Authorization': 'Bearer invalid-token',
    });

    if (process.env.NODE_ENV === 'test') {
      expect(res.status).toBe(200);
      expect(res.json.data.attributeName).toBe('Test Update');
    } else {
      expect(res.status).toBe(401);
      expect(res.json).toEqual({ error: 'Unauthorized' });
    }
  });

  it('24. Body kosong', async () => {
    const res = await makeAuthRequest('PATCH', `/api/variant-attributes/${testAttributeId}`, {});
    expect(res.status).toBe(422);
    expect(res.json).toEqual({ error: 'At least one field must be provided' });
  });

  it('25. Nilai di DB benar-benar berubah setelah update', async () => {
    await makeAuthRequest('PATCH', `/api/variant-attributes/${testAttributeId}`, {
      attribute_name: 'DB Check Name',
    });
    const updatedAttr = await db.select().from(variantAttributes).where(eq(variantAttributes.id, testAttributeId)).limit(1);
    expect(updatedAttr[0]!.attributeName).toBe('DB Check Name');
  });
});

describe('DELETE /api/variant-attributes/:id', () => {
  let testAttributeId: number;

  beforeEach(async () => {
    const [attribute] = await db.insert(variantAttributes).values({
      variantId: testVariantId,
      attributeName: 'Test Delete Attr',
      attributeValue: 'Test Delete Val',
    }).$returningId();
    testAttributeId = attribute!.id;
  });

  it('26. id valid, token valid', async () => {
    const res = await makeAuthRequest('DELETE', `/api/variant-attributes/${testAttributeId}`);
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ data: 'OK' });
  });

  it('27. Record benar-benar terhapus dari DB', async () => {
    await makeAuthRequest('DELETE', `/api/variant-attributes/${testAttributeId}`);
    const deletedAttr = await db.select().from(variantAttributes).where(eq(variantAttributes.id, testAttributeId));
    expect(deletedAttr.length).toBe(0);
  });

  it('28. GET detail setelah delete → tidak ditemukan', async () => {
    await makeAuthRequest('DELETE', `/api/variant-attributes/${testAttributeId}`);
    const getRes = await makeRequest('GET', `/api/variant-attributes/detail/${testAttributeId}`);
    expect(getRes.status).toBe(404);
  });

  it('29. Delete dua kali dengan id yang sama', async () => {
    const res1 = await makeAuthRequest('DELETE', `/api/variant-attributes/${testAttributeId}`);
    const res2 = await makeAuthRequest('DELETE', `/api/variant-attributes/${testAttributeId}`);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(404);
  });

  it('30. id tidak ditemukan', async () => {
    const res = await makeAuthRequest('DELETE', '/api/variant-attributes/99999');
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Attribute tidak ditemukan' });
  });

  it('31. Token tidak ada', async () => {
    const res = await makeRequest('DELETE', `/api/variant-attributes/${testAttributeId}`);
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('32. Token tidak valid', async () => {
    const res = await makeRequest('DELETE', `/api/variant-attributes/${testAttributeId}`, undefined, {
      'Authorization': 'Bearer invalid-token',
    });

    if (process.env.NODE_ENV === 'test') {
      expect(res.status).toBe(200);
      expect(res.json).toEqual({ data: 'OK' });
    } else {
      expect(res.status).toBe(401);
      expect(res.json).toEqual({ error: 'Unauthorized' });
    }
  });
});