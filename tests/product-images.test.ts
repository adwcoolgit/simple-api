import { describe, it, expect, beforeEach, afterEach, beforeAll, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { productImagesRoute } from '../src/routes/product-images-route';
import { db } from '../src/db';
import { users, sessions, products, productVariants, productImages } from '../src/db/schema';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

// Mock Redis
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

// Mock rate limit
mock('../src/middleware/rate-limit', () => ({
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

const app = new Elysia()
  .use(productImagesRoute);

const testEmail = 'productimagestest@example.com';
const testPassword = 'password123';
const testName = 'Product Images Test User';
let testToken: string;
let testUserId: string;
let testProductId: string;
let testVariantId: number;
let testImageId: number;

beforeEach(async () => {
  if (!dbAvailable) return;

  // Cleanup test data
  try {
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
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
  testUserId = randomUUID();
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
  testProductId = randomUUID();
  await db.insert(products).values({
    productId: testProductId,
    name: 'Test Product for Images',
    description: 'Test Description',
    isActive: true,
  });

  // Create test variant
  testVariantId = Math.floor(Math.random() * 1000000);
  await db.insert(productVariants).values({
    id: testVariantId,
    productId: testProductId,
    sku: `TEST-IMG-SKU-${Date.now()}`,
    variantName: 'Test Variant for Images',
    isActive: true,
    isSellable: true,
  });
});

afterEach(async () => {
  if (!dbAvailable) return;
  // Cleanup after tests
  try {
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
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
      'Authorization': `Bearer ${testToken}`,
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
async function makeRequest(method: string, path: string, body?: any, headers?: Record<string, string>): Promise<{ status: number; json: any }> {
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

describe('POST /api/product-images', () => {
  it('1. Array berisi 1 gambar dengan is_primary: true', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
      images: [
        { image_url: 'https://example.com/images/test.jpg', is_primary: true },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.json.data).toHaveLength(1);
    expect(res.json.data[0].is_primary).toBe(true);
  });

  it('2. Array berisi 3 gambar, tepat 1 is_primary: true', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
      images: [
        { image_url: 'https://example.com/images/test1.jpg', is_primary: false },
        { image_url: 'https://example.com/images/test2.jpg', is_primary: true },
        { image_url: 'https://example.com/images/test3.jpg', is_primary: false },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.json.data).toHaveLength(3);
    const primaryCount = res.json.data.filter((img: any) => img.is_primary).length;
    expect(primaryCount).toBe(1);
  });

  it('3. Return 404 ketika variant tidak ditemukan', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/product-images', {
      variant_id: 99999,
      images: [
        { image_url: 'https://example.com/images/test.jpg', is_primary: true },
      ],
    });
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Variant tidak ditemukan');
  });

  it('4. Tidak ada satupun item dengan is_primary: true', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
      images: [
        { image_url: 'https://example.com/images/test1.jpg', is_primary: false },
        { image_url: 'https://example.com/images/test2.jpg', is_primary: false },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.json.data).toHaveLength(2);
    const primaryCount = res.json.data.filter((img: any) => img.is_primary).length;
    expect(primaryCount).toBe(0);
  });

  it('5. Dua item atau lebih memiliki is_primary: true', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
      images: [
        { image_url: 'https://example.com/images/test1.jpg', is_primary: true },
        { image_url: 'https://example.com/images/test2.jpg', is_primary: true },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.json.data).toHaveLength(2);
    const primaryCount = res.json.data.filter((img: any) => img.is_primary).length;
    expect(primaryCount).toBe(2);
  });

  it('6. Field variant_id tidak dikirim', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/product-images', {
      images: [
        { image_url: 'https://example.com/images/test.jpg', is_primary: true },
      ],
    });
    expect(res.status).toBe(422);
  });

  it('7. Field images tidak dikirim', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
    });
    expect(res.status).toBe(422);
  });

  it('8. Array images kosong', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
      images: [],
    });
    expect(res.status).toBe(422);
  });

  it('9. Salah satu item tidak memiliki image_url', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
      images: [
        { image_url: 'https://example.com/images/test.jpg', is_primary: true },
        { is_primary: false },
      ],
    });
    expect(res.status).toBe(422);
  });

  it('10. image_url salah satu item bukan format URL valid', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
      images: [
        { image_url: 'not-a-url', is_primary: true },
      ],
    });
    expect(res.status).toBe(422);
  });

  it('11. Salah satu item tidak memiliki is_primary', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
      images: [
        { image_url: 'https://example.com/images/test.jpg' },
      ],
    });
    expect(res.status).toBe(422);
  });

  it('12. Tanpa token', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
      images: [
        { image_url: 'https://example.com/images/test.jpg', is_primary: true },
      ],
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/product-images/:variantId', () => {
  beforeEach(async () => {
    if (!dbAvailable) return;

    // Create test images
    await db.insert(productImages).values([
      {
        variantId: testVariantId,
        imageUrl: 'https://example.com/img1.jpg',
        isPrimary: false,
      },
      {
        variantId: testVariantId,
        imageUrl: 'https://example.com/img2.jpg',
        isPrimary: true,
      },
    ]);
  });

  it('13. Variant punya beberapa gambar', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest('GET', `/api/product-images/${testVariantId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json.data)).toBe(true);
    expect(res.json.data.length).toBeGreaterThan(0);
    expect(res.json.data[0]).toHaveProperty('variant_id');
    expect(res.json.data[0]).toHaveProperty('image_url');
    expect(res.json.data[0]).toHaveProperty('is_primary');
    expect(res.json.data[0]).toHaveProperty('created_at');
  });

  it('14. Gambar primary muncul paling atas', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest('GET', `/api/product-images/${testVariantId}`);
    expect(res.status).toBe(200);
    expect(res.json.data[0].is_primary).toBe(true);
  });

  it('15. Variant belum punya gambar', async () => {
    if (!dbAvailable) return;

    // Delete images
    await db.delete(productImages).where(sql`1=1`);

    const res = await makeRequest('GET', `/api/product-images/${testVariantId}`);
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual([]);
  });

  it('16. Variant tidak ditemukan', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest('GET', '/api/product-images/99999');
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Variant tidak ditemukan');
  });

  it('17. Tanpa token', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest('GET', `/api/product-images/${testVariantId}`);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/product-images/:imageId/primary', () => {
  beforeEach(async () => {
    if (!dbAvailable) return;

    // Create test images
    const imageIds = await db.insert(productImages).values([
      {
        variantId: testVariantId,
        imageUrl: 'https://example.com/img1.jpg',
        isPrimary: false,
      },
      {
        variantId: testVariantId,
        imageUrl: 'https://example.com/img2.jpg',
        isPrimary: true,
      },
    ]).$returningId();
    testImageId = imageIds[0];
  });

  it('18. Set gambar yang bukan primary menjadi primary', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('PATCH', `/api/product-images/${testImageId}/primary`, {
      variant_id: testVariantId,
    });
    expect(res.status).toBe(200);
    expect(res.json.data).toBe('OK');
  });

  it('19. Set gambar yang sudah primary (idempotent)', async () => {
    if (!dbAvailable) return;

    await db.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, testImageId));

    const res = await makeAuthRequest('PATCH', `/api/product-images/${testImageId}/primary`, {
      variant_id: testVariantId,
    });
    expect(res.status).toBe(200);
    expect(res.json.data).toBe('OK');
  });

  it('20. Setelah set primary, hanya satu gambar yang is_primary = true di variant tersebut', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('PATCH', `/api/product-images/${testImageId}/primary`, {
      variant_id: testVariantId,
    });
    expect(res.status).toBe(200);

    const images = await db.select().from(productImages).where(eq(productImages.variantId, testVariantId));
    const primaryCount = images.filter(img => img.isPrimary).length;
    expect(primaryCount).toBe(1);
  });

  it('21. imageId tidak ada', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('PATCH', '/api/product-images/99999/primary', {
      variant_id: testVariantId,
    });
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Gambar tidak ditemukan');
  });

  it('22. imageId milik variant lain', async () => {
    if (!dbAvailable) return;

    // Create another variant
    const otherVariantId = Math.floor(Math.random() * 1000000);
    await db.insert(productVariants).values({
      id: otherVariantId,
      productId: testProductId,
      sku: `TEST-OTHER-${Date.now()}`,
      variantName: 'Other Variant',
      isActive: true,
      isSellable: true,
    });

    const [otherImage] = await db.insert(productImages).values({
      variantId: otherVariantId,
      imageUrl: 'https://example.com/other.jpg',
      isPrimary: false,
    }).$returningId();

    const res = await makeAuthRequest('PATCH', `/api/product-images/${otherImage}/primary`, {
      variant_id: testVariantId,
    });
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Gambar tidak ditemukan');
  });

  it('23. Tanpa token', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest('PATCH', `/api/product-images/${testImageId}/primary`, {
      variant_id: testVariantId,
    });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/product-images/:imageId', () => {
  beforeEach(async () => {
    if (!dbAvailable) return;

    // Create test image
    const imageIds = await db.insert(productImages).values({
      variantId: testVariantId,
      imageUrl: 'https://example.com/test.jpg',
      isPrimary: true,
    }).$returningId();
    testImageId = imageIds[0];
  });

  it('24. Hapus gambar yang ada', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('DELETE', `/api/product-images/${testImageId}`);
    expect(res.status).toBe(200);
    expect(res.json.data).toBe('OK');
  });

  it('25. Record benar-benar terhapus dari DB', async () => {
    if (!dbAvailable) return;

    await makeAuthRequest('DELETE', `/api/product-images/${testImageId}`);

    const images = await db.select().from(productImages).where(eq(productImages.id, testImageId));
    expect(images.length).toBe(0);
  });

  it('26. Hapus gambar yang merupakan primary', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('DELETE', `/api/product-images/${testImageId}`);
    expect(res.status).toBe(200);
    expect(res.json.data).toBe('OK');
  });

  it('27. imageId tidak ada', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('DELETE', '/api/product-images/99999');
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Gambar tidak ditemukan');
  });

  it('28. Tanpa token', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest('DELETE', `/api/product-images/${testImageId}`);
    expect(res.status).toBe(401);
  });

  it('29. Token tidak valid', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest('DELETE', `/api/product-images/${testImageId}`, undefined, {
      'Authorization': 'Bearer invalid-token',
    });
    expect(res.status).toBe(401);
  });
});