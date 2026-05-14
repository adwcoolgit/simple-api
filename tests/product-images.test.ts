import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { productImagesRoute } from '../src/routes/product-images-route';
import { db } from '../src/db';
import { users, sessions, products, productVariants, productImages } from '../src/db/schema';
import { eq, sql } from 'drizzle-orm';

// Create product_images table if not exists
async function createProductImagesTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS product_images (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      variant_id BIGINT,
      image_url VARCHAR(255),
      is_primary BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE NO ACTION ON UPDATE NO ACTION
    )
  `);
}
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

// Mock Redis
import { mock } from 'bun:test';

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
    // Create product_images table
    await createProductImagesTable();
    console.log('Product images table created');
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
let testUserId: number;
let testProductId: number;
let testVariantId: number;
let testImageId: number;

beforeEach(async () => {
  if (!dbAvailable) return;

  // Cleanup test data
  await db.delete(productImages).where(sql`1=1`);
  await db.delete(productVariants).where(sql`1=1`);
  await db.delete(products).where(sql`1=1`);
  await db.delete(sessions).where(sql`1=1`);
  await db.delete(users).where(sql`1=1`);

  // Create test user
  const hashedPassword = await bcrypt.hash(testPassword, 12);
  testUserId = await db.insert(users).values({
    name: testName,
    email: testEmail,
    password: hashedPassword,
  }).$returningId();

  // Create session token
  testToken = 'test-token';
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
        {
          image_url: 'https://example.com/images/test1.jpg',
          is_primary: true,
        },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.json.data).toHaveLength(1);
    expect(res.json.data[0].isPrimary).toBe(true);
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

  it('3. Kirim gambar baru ke variant yang sudah punya gambar primary → primary lama direset', async () => {
    if (!dbAvailable) return;

    // First, add an image
    await makeAuthRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
      images: [{ image_url: 'https://example.com/images/old.jpg', is_primary: true }],
    });

    // Add new images
    const res = await makeAuthRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
      images: [
        { image_url: 'https://example.com/images/new1.jpg', is_primary: true },
        { image_url: 'https://example.com/images/new2.jpg', is_primary: false },
      ],
    });
    expect(res.status).toBe(201);

    // Check DB: only one primary
    const images = await db.select().from(productImages).where(eq(productImages.variantId, testVariantId));
    const primaryImages = images.filter(img => img.isPrimary);
    expect(primaryImages).toHaveLength(1);
    expect(primaryImages[0].imageUrl).toBe('https://example.com/images/new1.jpg');
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
    expect(res.status).toBe(422);
    expect(res.json.error).toBe('Exactly one image must be set as primary');
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
    expect(res.status).toBe(422);
    expect(res.json.error).toBe('Exactly one image must be set as primary');
  });

  it('6. Array images kosong []', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
      images: [],
    });
    expect(res.status).toBe(422);
    expect(res.json.error).toBe('Images must not be empty');
  });

  it('7. Field images tidak dikirim', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
    });
    expect(res.status).toBe(422);
  });

  it('8. Field variant_id tidak dikirim', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('POST', '/api/product-images', {
      images: [{ image_url: 'https://example.com/images/test.jpg', is_primary: true }],
    });
    expect(res.status).toBe(422);
  });

  it('9. Salah satu item dalam array tidak punya image_url', async () => {
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

  it('12. Tanpa token', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
      images: [{ image_url: 'https://example.com/images/test.jpg', is_primary: true }],
    });
    expect(res.status).toBe(401);
  });

  it('13. Token tidak valid', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest('POST', '/api/product-images', {
      variant_id: testVariantId,
      images: [{ image_url: 'https://example.com/images/test.jpg', is_primary: true }],
    }, { 'Authorization': 'Bearer invalid-token' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/product-images/:variantId', () => {
  it('14. Variant punya beberapa gambar', async () => {
    if (!dbAvailable) return;

    await db.insert(productImages).values([
      { variantId: testVariantId, imageUrl: 'https://example.com/img1.jpg', isPrimary: false },
      { variantId: testVariantId, imageUrl: 'https://example.com/img2.jpg', isPrimary: true },
    ]);

    const res = await makeRequest('GET', `/api/product-images/${testVariantId}`);
    expect(res.status).toBe(200);
    expect(res.json.data).toHaveLength(2);
  });

  it('15. Gambar primary muncul paling atas', async () => {
    if (!dbAvailable) return;

    await db.insert(productImages).values([
      { variantId: testVariantId, imageUrl: 'https://example.com/img1.jpg', isPrimary: false },
      { variantId: testVariantId, imageUrl: 'https://example.com/img2.jpg', isPrimary: true },
    ]);

    const res = await makeRequest('GET', `/api/product-images/${testVariantId}`);
    expect(res.status).toBe(200);
    expect(res.json.data[0].is_primary).toBe(true);
  });

  it('16. Variant belum punya gambar', async () => {
    if (!dbAvailable) return;

    const res = await makeRequest('GET', `/api/product-images/${testVariantId}`);
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual([]);
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

    testVariantId = await db.insert(productVariants).values({
      productId: testProductId,
      sku: `TEST-IMG-${Date.now()}`,
      variantName: 'Test Variant for Images',
      isActive: true,
      isSellable: true,
    }).$returningId();
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
  });

  it('20. Setelah set primary, hanya satu gambar yang is_primary = true di variant tersebut', async () => {
    if (!dbAvailable) return;

    // Add another image
    await db.insert(productImages).values({
      variantId: testVariantId,
      imageUrl: 'https://example.com/test2.jpg',
      isPrimary: true,
    });

    // Set first as primary
    await makeAuthRequest('PATCH', `/api/product-images/${testImageId}/primary`, {
      variant_id: testVariantId,
    });

    // Check DB
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
  });

  it('22. imageId milik variant lain', async () => {
    if (!dbAvailable) return;

    // Create another variant
    const [otherVariant] = await db.insert(productVariants).values({
      productId: testProductId,
      sku: 'OTHER-SKU',
      variantName: 'Other Variant',
    }).$returningId();

    const [otherImg] = await db.insert(productImages).values({
      variantId: otherVariant!.id,
      imageUrl: 'https://example.com/other.jpg',
      isPrimary: false,
    }).$returningId();

    const res = await makeAuthRequest('PATCH', `/api/product-images/${otherImg!.id}/primary`, {
      variant_id: testVariantId,
    });
    expect(res.status).toBe(404);
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

    testProductId = await db.insert(products).values({
      name: 'Test Product for Images',
      description: 'Test Description',
      isActive: true,
    }).$returningId();
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
    expect(images).toHaveLength(0);
  });

  it('26. Hapus gambar yang merupakan primary', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('DELETE', `/api/product-images/${testImageId}`);
    expect(res.status).toBe(200);
  });

  it('27. imageId tidak ada', async () => {
    if (!dbAvailable) return;

    const res = await makeAuthRequest('DELETE', '/api/product-images/99999');
    expect(res.status).toBe(404);
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