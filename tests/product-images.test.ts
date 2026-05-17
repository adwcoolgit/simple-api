import './setup';
import { describe, it, expect, beforeEach, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { routes } from '../src/routes';
import { productImagesRoute } from '../src/routes/product-images-route';
import { db } from '../src/db';
import {
  users,
  sessions,
  products,
  productVariants,
  productImages,
} from '../src/db/schema';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const app = new Elysia().use(routes).use(productImagesRoute);

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
    await db.select().from(productImages).limit(1);
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
    await db.execute(sql`DELETE FROM product_images`);
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

describe('POST /api/product-images — Tambah Gambar Produk', () => {
  let testProductId: number;
  let testVariantId: number;

  beforeEach(async () => {
    if (!dbAvailable) return;
    const timestamp = Date.now();
    const [product] = await db
      .insert(products)
      .values({
        name: `Test Product-${timestamp}`,
        description: 'Test Description',
        isActive: true,
      })
      .$returningId();
    testProductId = product!.productId;

    const [variant] = await db
      .insert(productVariants)
      .values({
        productId: testProductId,
        sku: `TEST-SKU-${timestamp}`,
        variantName: 'Test Variant',
        isActive: true,
        isSellable: true,
      })
      .$returningId();
    testVariantId = variant!.id;
  });

  it('1. Tambah satu gambar dengan is_primary true', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
      images: [
        { image_url: 'https://example.com/image1.jpg', is_primary: true },
      ],
    });
    expect(res.status).toBe(201);
    expect(Array.isArray(res.json.data)).toBe(true);
    expect(res.json.data.length).toBe(1);
    expect(res.json.data[0].is_primary).toBe(true);
  });

  it('2. Tambah tiga gambar, satu primary', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
      images: [
        { image_url: 'https://example.com/image1.jpg', is_primary: false },
        { image_url: 'https://example.com/image2.jpg', is_primary: true },
        { image_url: 'https://example.com/image3.jpg', is_primary: false },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.json.data.length).toBe(3);
    const primaryCount = res.json.data.filter(
      (img: any) => img.is_primary
    ).length;
    expect(primaryCount).toBe(1);
  });

  it('3. Variant tidak ditemukan', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('POST', '/api/product-images', {
      variant_id: 99999,
      images: [
        { image_url: 'https://example.com/image.jpg', is_primary: true },
      ],
    });
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Variant tidak ditemukan');
  });

  it('4. Tanpa field variant_id', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('POST', '/api/product-images', {
      images: [
        { image_url: 'https://example.com/image.jpg', is_primary: true },
      ],
    });
    expect(res.status).toBe(422);
  });

  it('5. Tanpa field images', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
    });
    expect(res.status).toBe(422);
  });

  it('6. Array images kosong', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
      images: [],
    });
    expect(res.status).toBe(422);
  });

  it('7. Tanpa header Authorization', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
      images: [
        { image_url: 'https://example.com/image.jpg', is_primary: true },
      ],
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });
});

describe('GET /api/product-images/:variantId — List Gambar Variant', () => {
  let testProductId: number;
  let testVariantId: number;

  beforeEach(async () => {
    if (!dbAvailable) return;
    const timestamp = Date.now();
    const [product] = await db
      .insert(products)
      .values({
        name: `Test Product-${timestamp}`,
        description: 'Test Description',
        isActive: true,
      })
      .$returningId();
    testProductId = product!.productId;

    const [variant] = await db
      .insert(productVariants)
      .values({
        productId: testProductId,
        sku: `TEST-SKU-${timestamp}`,
        variantName: 'Test Variant',
        isActive: true,
        isSellable: true,
      })
      .$returningId();
    testVariantId = variant!.id;

    // Create test images
    await db.insert(productImages).values([
      {
        variantId: testVariantId,
        imageUrl: 'https://example.com/primary.jpg',
        isPrimary: true,
      },
      {
        variantId: testVariantId,
        imageUrl: 'https://example.com/secondary.jpg',
        isPrimary: false,
      },
    ]);
  });

  it('8. Variant memiliki gambar', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest(
      'GET',
      `/api/product-images/${testVariantId}`
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json.data)).toBe(true);
    expect(res.json.data.length).toBe(2);
    expect(res.json.data[0]).toHaveProperty('variant_id');
    expect(res.json.data[0]).toHaveProperty('image_url');
    expect(res.json.data[0]).toHaveProperty('is_primary');
  });

  it('9. Gambar primary di urutan pertama', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest(
      'GET',
      `/api/product-images/${testVariantId}`
    );
    expect(res.status).toBe(200);
    expect(res.json.data[0].is_primary).toBe(true);
  });

  it('10. Variant belum memiliki gambar', async () => {
    if (!dbAvailable) return;
    // Delete images
    await db.execute(
      sql`DELETE FROM product_images WHERE variant_id = ${testVariantId}`
    );
    const res = await makeAuthRequest(
      'GET',
      `/api/product-images/${testVariantId}`
    );
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual([]);
  });

  it('11. Variant tidak ditemukan', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('GET', '/api/product-images/99999');
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Variant tidak ditemukan');
  });

  it('12. Tanpa header Authorization', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest(
      'GET',
      `/api/product-images/${testVariantId}`
    );
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });
});

describe('GET /api/product-images/:variantId/current — Gambar Primary Variant', () => {
  let testProductId: number;
  let testVariantId: number;

  beforeEach(async () => {
    if (!dbAvailable) return;
    const timestamp = Date.now();
    const [product] = await db
      .insert(products)
      .values({
        name: `Test Product-${timestamp}`,
        description: 'Test Description',
        isActive: true,
      })
      .$returningId();
    testProductId = product!.productId;

    const [variant] = await db
      .insert(productVariants)
      .values({
        productId: testProductId,
        sku: `TEST-SKU-${timestamp}`,
        variantName: 'Test Variant',
        isActive: true,
        isSellable: true,
      })
      .$returningId();
    testVariantId = variant!.id;

    // Create test image
    await db.insert(productImages).values({
      variantId: testVariantId,
      imageUrl: 'https://example.com/primary.jpg',
      isPrimary: true,
    });
  });

  it('13. Variant memiliki gambar primary', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest(
      'GET',
      `/api/product-images/${testVariantId}/current`
    );
    expect(res.status).toBe(200);
    expect(res.json.data).toHaveProperty('id');
    expect(res.json.data).toHaveProperty('variant_id');
    expect(res.json.data).toHaveProperty('image_url');
    expect(res.json.data.is_primary).toBe(true);
  });

  it('14. Variant tidak memiliki gambar primary', async () => {
    if (!dbAvailable) return;
    // Delete primary image
    await db.execute(
      sql`DELETE FROM product_images WHERE variant_id = ${testVariantId} AND is_primary = true`
    );
    const res = await makeAuthRequest(
      'GET',
      `/api/product-images/${testVariantId}/current`
    );
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Gambar primary tidak ditemukan');
  });

  it('15. Variant tidak ditemukan', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest(
      'GET',
      '/api/product-images/99999/current'
    );
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Variant tidak ditemukan');
  });

  it('16. Tanpa header Authorization', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest(
      'GET',
      `/api/product-images/${testVariantId}/current`
    );
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });
});

describe('PATCH /api/product-images/:imageId/primary — Set Gambar Primary', () => {
  let testProductId: number;
  let testVariantId: number;
  let testImageId: number;

  beforeEach(async () => {
    if (!dbAvailable) return;
    const timestamp = Date.now();
    const [product] = await db
      .insert(products)
      .values({
        name: `Test Product-${timestamp}`,
        description: 'Test Description',
        isActive: true,
      })
      .$returningId();
    testProductId = product!.productId;

    const [variant] = await db
      .insert(productVariants)
      .values({
        productId: testProductId,
        sku: `TEST-SKU-${timestamp}`,
        variantName: 'Test Variant',
        isActive: true,
        isSellable: true,
      })
      .$returningId();
    testVariantId = variant!.id;

    // Create test images
    const imageIds = await db
      .insert(productImages)
      .values([
        {
          variantId: testVariantId,
          imageUrl: 'https://example.com/image1.jpg',
          isPrimary: false,
        },
        {
          variantId: testVariantId,
          imageUrl: 'https://example.com/image2.jpg',
          isPrimary: true,
        },
      ])
      .$returningId();
    testImageId = imageIds[0]!.id;
  });

  it('17. Set gambar non-primary menjadi primary', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest(
      'PATCH',
      `/api/product-images/${testImageId}/primary`,
      {
        variant_id: testVariantId,
      }
    );
    expect(res.status).toBe(200);
    expect(res.json.data).toBe('OK');
  });

  it('18. Hanya satu gambar primary setelah set', async () => {
    if (!dbAvailable) return;
    await makeAuthRequest(
      'PATCH',
      `/api/product-images/${testImageId}/primary`,
      {
        variant_id: testVariantId,
      }
    );
    const images = await db
      .select()
      .from(productImages)
      .where(eq(productImages.variantId, testVariantId));
    const primaryCount = images.filter((img) => img.isPrimary).length;
    expect(primaryCount).toBe(1);
  });

  it('19. Image ID tidak ditemukan', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest(
      'PATCH',
      '/api/product-images/99999/primary',
      {
        variant_id: testVariantId,
      }
    );
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Gambar tidak ditemukan');
  });

  it('20. Tanpa header Authorization', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest(
      'PATCH',
      `/api/product-images/${testImageId}/primary`,
      {
        variant_id: testVariantId,
      }
    );
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });
});

describe('DELETE /api/product-images/:imageId — Hapus Gambar Produk', () => {
  let testProductId: number;
  let testVariantId: number;
  let testImageId: number;

  beforeEach(async () => {
    if (!dbAvailable) return;
    const timestamp = Date.now();
    const [product] = await db
      .insert(products)
      .values({
        name: `Test Product-${timestamp}`,
        description: 'Test Description',
        isActive: true,
      })
      .$returningId();
    testProductId = product!.productId;

    const [variant] = await db
      .insert(productVariants)
      .values({
        productId: testProductId,
        sku: `TEST-SKU-${timestamp}`,
        variantName: 'Test Variant',
        isActive: true,
        isSellable: true,
      })
      .$returningId();
    testVariantId = variant!.id;

    // Create test image
    const [image] = await db
      .insert(productImages)
      .values({
        variantId: testVariantId,
        imageUrl: 'https://example.com/image.jpg',
        isPrimary: true,
      })
      .$returningId();
    testImageId = image!.id;
  });

  it('21. Hapus gambar yang ada', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest(
      'DELETE',
      `/api/product-images/${testImageId}`
    );
    expect(res.status).toBe(200);
    expect(res.json.data).toBe('OK');
  });

  it('22. Record benar-benar terhapus dari DB', async () => {
    if (!dbAvailable) return;
    await makeAuthRequest('DELETE', `/api/product-images/${testImageId}`);
    const images = await db
      .select()
      .from(productImages)
      .where(eq(productImages.id, testImageId));
    expect(images.length).toBe(0);
  });

  it('23. Image ID tidak ditemukan', async () => {
    if (!dbAvailable) return;
    const res = await makeAuthRequest('DELETE', '/api/product-images/99999');
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Gambar tidak ditemukan');
  });

  it('24. Tanpa header Authorization', async () => {
    if (!dbAvailable) return;
    const res = await makeRequest(
      'DELETE',
      `/api/product-images/${testImageId}`
    );
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });
});
