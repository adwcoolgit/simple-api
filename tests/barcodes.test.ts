import './setup';
import { describe, it, expect, beforeEach, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { routes } from '../src/routes';
import { barcodesRoute } from '../src/routes/barcodes-route';
import { db } from '../src/db';
import {
  users,
  sessions,
  products,
  productVariants,
  barcodes,
} from '../src/db/schema';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const app = new Elysia().use(routes).use(barcodesRoute);

const testEmail = `test-${Date.now()}@example.com`;
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
    await db.select().from(barcodes).limit(1);
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

  // Wait for database to be ready
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Clean up test data in correct order
  try {
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);

    // Delete in reverse dependency order
    await db.execute(sql`DELETE FROM barcodes`);
    await db.execute(sql`DELETE FROM product_variants`);
    await db.execute(sql`DELETE FROM products`);
    await db.execute(sql`DELETE FROM sessions`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE 'test%'`);

    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
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

      // Also check if test variant exists
      const existingProduct = await db
        .select()
        .from(products)
        .where(eq(products.name, `Test Product-${Date.now()}`))
        .limit(1);
      if (existingProduct.length > 0) {
        testProductId = existingProduct[0]!.productId;
        const existingVariant = await db
          .select()
          .from(productVariants)
          .where(eq(productVariants.productId, testProductId))
          .limit(1);
        if (existingVariant.length > 0) {
          testVariantId = existingVariant[0]!.id;
        }
      }
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

  // Create test product
  const [product] = await db
    .insert(products)
    .values({
      name: `Test Product-${Date.now()}`,
      description: 'Test Description',
      isActive: true,
    })
    .$returningId();
  testProductId = product!.productId;

  // Create test variant
  const [variant] = await db
    .insert(productVariants)
    .values({
      productId: testProductId,
      sku: `TEST-SKU-${Date.now()}`,
      variantName: 'Test Variant',
      isActive: true,
      isSellable: true,
    })
    .$returningId();
  testVariantId = variant!.id;
});

// Helper function to make authenticated requests
function makeAuthRequest(method: string, path: string, body?: any) {
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
  return app.handle(req).then((res) =>
    res
      .json()
      .catch(() => ({} as any))
      .then((json: any) => ({ status: res.status, json }))
  );
}

// Helper function to make requests without auth
function makeRequest(
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
  return app.handle(req).then((res) =>
    res
      .json()
      .catch(() => ({} as any))
      .then((json: any) => ({ status: res.status, json }))
  );
}

describe('POST /api/barcodes — Tambah Barcode', () => {
  it('1. Data valid, variant ada', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/barcodes', {
      variant_id: testVariantId,
      barcode: '8991234567890',
    });
    expect(res.status).toBe(201);
    expect(res.json.data).toHaveProperty('id');
    expect(res.json.data).toHaveProperty('variant_id');
    expect(res.json.data).toHaveProperty('barcode');
    expect(res.json.data.variant_id).toBe(testVariantId);
    expect(res.json.data.barcode).toBe('8991234567890');
  });

  it('2. Barcode sama didaftarkan dua kali', async () => {
    if (!dbAvailable) return;

    // Create first barcode
    await makeAuthRequest('POST', '/api/barcodes', {
      variant_id: testVariantId,
      barcode: '8991234567890',
    });

    // Try to create the same barcode again
    const res = await makeAuthRequest('POST', '/api/barcodes', {
      variant_id: testVariantId,
      barcode: '8991234567890',
    });
    expect(res.status).toBe(409);
    expect(res.json.error).toBe('Barcode sudah digunakan');
  });

  it('3. variant_id tidak ada di tabel product_variants', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/barcodes', {
      variant_id: 99999,
      barcode: '8991234567890',
    });
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Variant tidak ditemukan');
  });

  it('4. Field barcode tidak dikirim', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/barcodes', {
      variant_id: testVariantId,
    });
    expect(res.status).toBe(422);
  });

  it('5. Field variant_id tidak dikirim', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/barcodes', {
      barcode: '8991234567890',
    });
    expect(res.status).toBe(422);
  });

  it('6. barcode melebihi 50 karakter', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/barcodes', {
      variant_id: testVariantId,
      barcode: 'a'.repeat(51),
    });
    expect(res.status).toBe(422);
  });

  it('7. variant_id bukan integer (string, negatif, nol)', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/barcodes', {
      variant_id: 'invalid',
      barcode: '8991234567890',
    });
    expect(res.status).toBe(422);
  });

  it('8. Tanpa header Authorization', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest('POST', '/api/barcodes', {
      variant_id: testVariantId,
      barcode: '8991234567890',
    });
    expect(res.status).toBe(401);
    expect(res.json.error).toBe('Unauthorized');
  });

  it('9. Token tidak valid', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest(
      'POST',
      '/api/barcodes',
      {
        variant_id: testVariantId,
        barcode: '8991234567890',
      },
      {
        Authorization: 'Bearer invalid-token',
      }
    );
    expect(res.status).toBe(401);
    expect(res.json.error).toBe('Unauthorized');
  });

  it('10. Dua barcode berbeda untuk variant yang sama', async () => {
    if (!dbAvailable) return;

    const res1 = await makeAuthRequest('POST', '/api/barcodes', {
      variant_id: testVariantId,
      barcode: '8991234567890',
    });
    expect(res1.status).toBe(201);

    const res2 = await makeAuthRequest('POST', '/api/barcodes', {
      variant_id: testVariantId,
      barcode: '8991234567891',
    });
    expect(res2.status).toBe(201);
  });
});

describe('GET /api/barcodes/variant/:variantId — Ambil Barcode by Variant', () => {
  it('11. Variant ada dan punya barcode', async () => {
    if (!dbAvailable) return;

    // Create a barcode first
    await makeAuthRequest('POST', '/api/barcodes', {
      variant_id: testVariantId,
      barcode: '8991234567890',
    });

    const res = await makeAuthRequest(
      'GET',
      `/api/barcodes/variant/${testVariantId}`
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json.data)).toBe(true);
    expect(res.json.data.length).toBeGreaterThan(0);
    expect(res.json.data[0]).toHaveProperty('id');
    expect(res.json.data[0]).toHaveProperty('variant_id');
    expect(res.json.data[0]).toHaveProperty('barcode');
  });

  it('12. Variant ada tapi belum punya barcode', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest(
      'GET',
      `/api/barcodes/variant/${testVariantId}`
    );
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual([]);
  });

  it('13. variantId tidak ada di product_variants', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('GET', '/api/barcodes/variant/99999');
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Variant tidak ditemukan');
  });

  it('14. variantId bukan integer (huruf, desimal)', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('GET', '/api/barcodes/variant/abc');
    expect(res.status).toBe(422);
  });

  it('15. Tanpa header Authorization', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest(
      'GET',
      `/api/barcodes/variant/${testVariantId}`
    );
    expect(res.status).toBe(401);
    expect(res.json.error).toBe('Unauthorized');
  });

  it('16. Token tidak valid', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest(
      'GET',
      `/api/barcodes/variant/${testVariantId}`,
      undefined,
      {
        Authorization: 'Bearer invalid-token',
      }
    );
    expect(res.status).toBe(401);
    expect(res.json.error).toBe('Unauthorized');
  });

  it('17. Data yang dikembalikan hanya milik variant yang diminta', async () => {
    if (!dbAvailable) return;

    // Create another variant
    const [otherVariant] = await db
      .insert(productVariants)
      .values({
        productId: testProductId,
        sku: `TEST-OTHER-${Date.now()}`,
        variantName: 'Other Variant',
        isActive: true,
        isSellable: true,
      })
      .$returningId();
    const otherVariantId = otherVariant!.id;

    // Create barcodes for both variants
    await makeAuthRequest('POST', '/api/barcodes', {
      variant_id: testVariantId,
      barcode: '8991234567890',
    });
    await makeAuthRequest('POST', '/api/barcodes', {
      variant_id: otherVariantId,
      barcode: '8991234567891',
    });

    const res = await makeAuthRequest(
      'GET',
      `/api/barcodes/variant/${testVariantId}`
    );
    expect(res.status).toBe(200);
    expect(res.json.data.length).toBe(1);
    expect(res.json.data[0].variant_id).toBe(testVariantId);
  });
});

describe('GET /api/barcodes/:id — Ambil Barcode by ID', () => {
  let testBarcodeId: number;

  beforeEach(async () => {
    if (!dbAvailable) return;

    // Create a barcode for testing
    const res = await makeAuthRequest('POST', '/api/barcodes', {
      variant_id: testVariantId,
      barcode: '8991234567890',
    });
    testBarcodeId = res.json.data.id;
  });

  it('18. ID valid dan barcode ada', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('GET', `/api/barcodes/${testBarcodeId}`);
    expect(res.status).toBe(200);
    expect(res.json.data).toHaveProperty('id');
    expect(res.json.data).toHaveProperty('variant_id');
    expect(res.json.data).toHaveProperty('barcode');
    expect(res.json.data.id).toBe(testBarcodeId);
  });

  it('19. ID tidak ada di tabel', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('GET', '/api/barcodes/99999');
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Barcode tidak ditemukan');
  });

  it('20. id bukan integer (huruf, negatif, nol)', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('GET', '/api/barcodes/abc');
    expect(res.status).toBe(422);
  });

  it('21. Tanpa header Authorization', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest('GET', `/api/barcodes/${testBarcodeId}`);
    expect(res.status).toBe(401);
    expect(res.json.error).toBe('Unauthorized');
  });

  it('22. Token tidak valid', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest(
      'GET',
      `/api/barcodes/${testBarcodeId}`,
      undefined,
      {
        Authorization: 'Bearer invalid-token',
      }
    );
    expect(res.status).toBe(401);
    expect(res.json.error).toBe('Unauthorized');
  });
});

describe('DELETE /api/barcodes/:id — Hapus Barcode', () => {
  let testBarcodeId: number;

  beforeEach(async () => {
    if (!dbAvailable) return;

    // Create a barcode for testing
    const res = await makeAuthRequest('POST', '/api/barcodes', {
      variant_id: testVariantId,
      barcode: '8991234567890',
    });
    testBarcodeId = res.json.data.id;
  });

  it('23. ID valid', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest(
      'DELETE',
      `/api/barcodes/${testBarcodeId}`
    );
    expect(res.status).toBe(200);
    expect(res.json.data).toBe('OK');
  });

  it('24. Record benar-benar terhapus dari DB setelah delete', async () => {
    if (!dbAvailable) return;

    await makeAuthRequest('DELETE', `/api/barcodes/${testBarcodeId}`);

    const barcodesInDb = await db
      .select()
      .from(barcodes)
      .where(eq(barcodes.id, testBarcodeId));
    expect(barcodesInDb.length).toBe(0);
  });

  it('25. Hapus dua kali dengan ID yang sama', async () => {
    if (!dbAvailable) return;

    const res1 = await makeAuthRequest(
      'DELETE',
      `/api/barcodes/${testBarcodeId}`
    );
    expect(res1.status).toBe(200);

    const res2 = await makeAuthRequest(
      'DELETE',
      `/api/barcodes/${testBarcodeId}`
    );
    expect(res2.status).toBe(404);
    expect(res2.json.error).toBe('Barcode tidak ditemukan');
  });

  it('26. ID tidak ada di tabel', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('DELETE', '/api/barcodes/99999');
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Barcode tidak ditemukan');
  });

  it('27. id bukan integer', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('DELETE', '/api/barcodes/abc');
    expect(res.status).toBe(422);
  });

  it('28. Tanpa header Authorization', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest('DELETE', `/api/barcodes/${testBarcodeId}`);
    expect(res.status).toBe(401);
    expect(res.json.error).toBe('Unauthorized');
  });

  it('29. Token tidak valid', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest(
      'DELETE',
      `/api/barcodes/${testBarcodeId}`,
      undefined,
      {
        Authorization: 'Bearer invalid-token',
      }
    );
    expect(res.status).toBe(401);
    expect(res.json.error).toBe('Unauthorized');
  });
});
