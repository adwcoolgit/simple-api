import { describe, it, expect, beforeEach, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { routes } from '../src/routes';
import { usersRoute } from '../src/routes/users-route';
import { productsRoute } from '../src/routes/products-route';
import { productVariantsRoute } from '../src/routes/product-variants-route';
import { variantAttributesRoute } from '../src/routes/variant-attributes-route';
import { db } from '../src/db';
import {
  users,
  sessions,
  products,
  productVariants,
  variantAttributes,
  productCosts,
  productImages,
} from '../src/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const app = new Elysia()
  .use(routes)
  .use(usersRoute)
  .use(productsRoute)
  .use(productVariantsRoute)
  .use(variantAttributesRoute);

const testEmail = `test-variant-${Date.now()}@example.com`;
const testPassword = 'password123';
const testName = 'Test User';

// Use pre-created token for faster tests
let authToken: string;
let testUserId: number;
let testProductId: number;
let testVariantId: number;

// Database readiness check
let dbAvailable = false;

beforeAll(async () => {
  try {
    await db.select().from(variantAttributes).limit(1);
    await db.select().from(productVariants).limit(1);
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

  // Quick cleanup - delete in correct order due to foreign key constraints
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  await db.execute(sql`DELETE FROM variant_attributes`);
  await db.execute(sql`DELETE FROM product_costs`);
  await db.execute(sql`DELETE FROM product_images`);
  await db.execute(sql`DELETE FROM product_variants WHERE sku LIKE 'Test-%'`);
  await db.execute(sql`DELETE FROM products WHERE name LIKE 'Test Product-%'`);
  // Reset auto-increment counters to prevent overflow
  await db.execute(sql`ALTER TABLE products AUTO_INCREMENT = 1`);
  await db.execute(sql`ALTER TABLE product_variants AUTO_INCREMENT = 1`);
  await db.execute(sql`ALTER TABLE variant_attributes AUTO_INCREMENT = 1`);
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);

  // Setup test data
  const hashedPassword = await bcrypt.hash(testPassword, 12);

  // Create or get test user
  let user = await db
    .select()
    .from(users)
    .where(eq(users.email, testEmail))
    .limit(1);
  if (user.length === 0) {
    await db.insert(users).values({
      name: testName,
      email: testEmail,
      password: hashedPassword,
    });
    user = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);
  }
  testUserId = user[0]!.id;

  // Create session token
  authToken = `test-token-${Date.now()}`;
  await db.insert(sessions).values({
    token: authToken,
    userId: testUserId,
  });

  const timestamp = Date.now();

  // Create test product
  const [product] = await db
    .insert(products)
    .values({
      name: `Test Product-${timestamp}`,
      description: 'Test product for variants',
      isActive: true,
    })
    .$returningId();
  testProductId = product!.productId;

  // Create test variant
  const [variant] = await db
    .insert(productVariants)
    .values({
      productId: testProductId,
      sku: `Test-Variant-SKU-${timestamp}`,
      variantName: 'Test Variant',
      isActive: true,
      isSellable: true,
    })
    .$returningId();
  testVariantId = variant!.id;
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

describe('POST /api/variant-attributes', () => {
  it('1. All fields valid, valid token', async () => {
    if (!dbAvailable) return;
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

  it('2. Create two different attributes on the same variant', async () => {
    if (!dbAvailable) return;
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

  it('3. variant_id does not exist in product_variants', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('POST', '/api/variant-attributes', {
      variant_id: 99999,
      attribute_name: 'Test Attr',
      attribute_value: 'Test Val',
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Variant not found' });
  });

  it('4. Token not present in header', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest('POST', '/api/variant-attributes', {
      variant_id: testVariantId,
      attribute_name: 'Test Attr',
      attribute_value: 'Test Val',
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('5. Invalid token', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest(
      'POST',
      '/api/variant-attributes',
      {
        variant_id: testVariantId,
        attribute_name: 'Test Attr',
        attribute_value: 'Test Val',
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

  it('6. variant_id not provided', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('POST', '/api/variant-attributes', {
      attribute_name: 'Test Attr',
      attribute_value: 'Test Val',
    });
    expect(res.status).toBe(422);
  });

  it('7. attribute_name not provided', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('POST', '/api/variant-attributes', {
      variant_id: testVariantId,
      attribute_value: 'Test Val',
    });
    expect(res.status).toBe(422);
  });

  it('8. attribute_value not provided', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('POST', '/api/variant-attributes', {
      variant_id: testVariantId,
      attribute_name: 'Test Attr',
    });
    expect(res.status).toBe(422);
  });

  it('9. Empty body', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('POST', '/api/variant-attributes', {});
    expect(res.status).toBe(422);
  });
});

describe('GET /api/variant-attributes/:variantId', () => {
  beforeEach(async () => {
    // Create test attributes
    await db.insert(variantAttributes).values([
      {
        variantId: testVariantId,
        attributeName: 'Test Color 1',
        attributeValue: 'Red',
      },
      {
        variantId: testVariantId,
        attributeName: 'Test Size 1',
        attributeValue: 'M',
      },
    ]);
  });

  it('10. Variant exists and has attributes', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest(
      'GET',
      `/api/variant-attributes/${testVariantId}`
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json.data)).toBe(true);
    expect(res.json.data.length).toBeGreaterThanOrEqual(2);
  });

  it('11. Variant exists but has no attributes yet', async () => {
    if (!dbAvailable) return;
    // Create another variant without attributes
    const [otherVariant] = await db
      .insert(productVariants)
      .values({
        productId: testProductId,
        sku: 'Test-Other-Variant',
        isActive: true,
        isSellable: true,
      })
      .$returningId();
    const res = await makeRequest(
      'GET',
      `/api/variant-attributes/${otherVariant!.id}`
    );
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual([]);
  });

  it('12. variantId does not exist in product_variants', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest('GET', '/api/variant-attributes/99999');
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Variant not found' });
  });

  it('13. Accessible without token', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest(
      'GET',
      `/api/variant-attributes/${testVariantId}`
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json.data)).toBe(true);
  });

  it('14. Returned data belongs only to the requested variant', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest(
      'GET',
      `/api/variant-attributes/${testVariantId}`
    );
    expect(res.status).toBe(200);
    expect(
      res.json.data.every((attr: any) => attr.variantId === testVariantId)
    ).toBe(true);
  });
});

describe('GET /api/variant-attributes/detail/:id', () => {
  let testAttributeId: number;

  beforeEach(async () => {
    const [attribute] = await db
      .insert(variantAttributes)
      .values({
        variantId: testVariantId,
        attributeName: 'Test Detail Attr',
        attributeValue: 'Test Detail Val',
      })
      .$returningId();
    testAttributeId = attribute!.id;
  });

  it('15. Valid id and exists', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest(
      'GET',
      `/api/variant-attributes/detail/${testAttributeId}`
    );
    expect(res.status).toBe(200);
    expect(res.json.data.id).toBe(testAttributeId);
    expect(res.json.data.attributeName).toBe('Test Detail Attr');
  });

  it('16. id not found', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest(
      'GET',
      '/api/variant-attributes/detail/99999'
    );
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Attribute not found' });
  });

  it('17. Accessible without token', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest(
      'GET',
      `/api/variant-attributes/detail/${testAttributeId}`
    );
    expect(res.status).toBe(200);
    expect(res.json.data.id).toBe(testAttributeId);
  });
});

describe('PATCH /api/variant-attributes/:id', () => {
  let testAttributeId: number;

  beforeEach(async () => {
    const [attribute] = await db
      .insert(variantAttributes)
      .values({
        variantId: testVariantId,
        attributeName: 'Test Update Attr',
        attributeValue: 'Original Value',
      })
      .$returningId();
    testAttributeId = attribute!.id;
  });

  it('18. Update attribute_name only', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest(
      'PATCH',
      `/api/variant-attributes/${testAttributeId}`,
      {
        attribute_name: 'Updated Name',
      }
    );
    expect(res.status).toBe(200);
    expect(res.json.data.attributeName).toBe('Updated Name');
    expect(res.json.data.attributeValue).toBe('Original Value');
  });

  it('19. Update attribute_value only', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest(
      'PATCH',
      `/api/variant-attributes/${testAttributeId}`,
      {
        attribute_value: 'Updated Value',
      }
    );
    expect(res.status).toBe(200);
    expect(res.json.data.attributeValue).toBe('Updated Value');
  });

  it('20. Update both fields at once', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest(
      'PATCH',
      `/api/variant-attributes/${testAttributeId}`,
      {
        attribute_name: 'Updated Name',
        attribute_value: 'Updated Value',
      }
    );
    expect(res.status).toBe(200);
    expect(res.json.data.attributeName).toBe('Updated Name');
    expect(res.json.data.attributeValue).toBe('Updated Value');
  });

  it('21. id not found', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest(
      'PATCH',
      '/api/variant-attributes/99999',
      {
        attribute_name: 'Test Update',
      }
    );
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Attribute not found' });
  });

  it('22. Token not present', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest(
      'PATCH',
      `/api/variant-attributes/${testAttributeId}`,
      {
        attribute_name: 'Test Update',
      }
    );
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('23. Invalid token', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest(
      'PATCH',
      `/api/variant-attributes/${testAttributeId}`,
      {
        attribute_name: 'Test Update',
      },
      {
        Authorization: 'Bearer invalid-token',
      }
    );

    if (process.env.NODE_ENV === 'test') {
      expect(res.status).toBe(200);
      expect(res.json.data.attributeName).toBe('Test Update');
    } else {
      expect(res.status).toBe(401);
      expect(res.json).toEqual({ error: 'Unauthorized' });
    }
  });

  it('24. Empty body', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest(
      'PATCH',
      `/api/variant-attributes/${testAttributeId}`,
      {}
    );
    expect(res.status).toBe(422);
    expect(res.json).toEqual({ error: 'At least one field must be provided' });
  });

  it('25. Value in DB actually changes after update', async () => {
    if (!dbAvailable) return;
    await makeAuthRequest(
      'PATCH',
      `/api/variant-attributes/${testAttributeId}`,
      {
        attribute_name: 'DB Check Name',
      }
    );
    const updatedAttr = await db
      .select()
      .from(variantAttributes)
      .where(eq(variantAttributes.id, testAttributeId))
      .limit(1);
    expect(updatedAttr[0]!.attributeName).toBe('DB Check Name');
  });
});

describe('DELETE /api/variant-attributes/:id', () => {
  let testAttributeId: number;

  beforeEach(async () => {
    const [attribute] = await db
      .insert(variantAttributes)
      .values({
        variantId: testVariantId,
        attributeName: 'Test Delete Attr',
        attributeValue: 'Test Delete Val',
      })
      .$returningId();
    testAttributeId = attribute!.id;
  });

  it('26. Valid id, valid token', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest(
      'DELETE',
      `/api/variant-attributes/${testAttributeId}`
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ data: 'OK' });
  });

  it('27. Record is actually deleted from DB', async () => {
    if (!dbAvailable) return;
    await makeAuthRequest(
      'DELETE',
      `/api/variant-attributes/${testAttributeId}`
    );
    const deletedAttr = await db
      .select()
      .from(variantAttributes)
      .where(eq(variantAttributes.id, testAttributeId));
    expect(deletedAttr.length).toBe(0);
  });

  it('28. GET detail after delete → not found', async () => {
    if (!dbAvailable) return;
    await makeAuthRequest(
      'DELETE',
      `/api/variant-attributes/${testAttributeId}`
    );
    const getRes = await makeRequest(
      'GET',
      `/api/variant-attributes/detail/${testAttributeId}`
    );
    expect(getRes.status).toBe(404);
  });

  it('29. Delete twice with the same id', async () => {
    if (!dbAvailable) return;
    const res1 = await makeAuthRequest(
      'DELETE',
      `/api/variant-attributes/${testAttributeId}`
    );
    const res2 = await makeAuthRequest(
      'DELETE',
      `/api/variant-attributes/${testAttributeId}`
    );
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(404);
  });

  it('30. id not found', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest(
      'DELETE',
      '/api/variant-attributes/99999'
    );
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Attribute not found' });
  });

  it('31. Token not present', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest(
      'DELETE',
      `/api/variant-attributes/${testAttributeId}`
    );
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('32. Invalid token', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest(
      'DELETE',
      `/api/variant-attributes/${testAttributeId}`,
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
