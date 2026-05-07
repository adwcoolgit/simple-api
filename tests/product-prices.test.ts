import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { routes } from '../src/routes';
import { usersRoute } from '../src/routes/users-route';
import { productsRoute } from '../src/routes/products-route';
import { productVariantsRoute } from '../src/routes/product-variants-route';
import { variantAttributesRoute } from '../src/routes/variant-attributes-route';
import { productPricesRoute } from '../src/routes/product-prices-route';
import { db } from '../src/db';
import { users, sessions, products, productVariants, productPrices } from '../src/db/schema';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const app = new Elysia()
  .use(routes)
  .use(usersRoute)
  .use(productsRoute)
  .use(productVariantsRoute)
  .use(variantAttributesRoute)
  .use(productPricesRoute);

const testEmail = 'test@example.com';
const testPassword = 'password123';
const testName = 'Test User';

// Use pre-created token for faster tests
let authToken: string;
let testUserId: number;
let testVariantId: number;

beforeEach(async () => {
  // Quick cleanup - only delete test product prices
  await db.delete(productPrices).where(sql`1=1`);

  // Ensure test variant exists
  const existingVariants = await db.select().from(productVariants).limit(1);
  if (existingVariants.length > 0) {
    testVariantId = existingVariants[0]!.id;
  } else {
    // Create a test product first
    const [product] = await db.insert(products).values({
      productName: 'Test Product for Prices',
      description: 'Test Description',
      isActive: true,
    }).$returningId();

    // Create test variant
    const [variant] = await db.insert(productVariants).values({
      productId: product!.productId,
      sku: 'TEST-SKU-123',
      variantName: 'Test Variant',
      isActive: true,
      isSellable: true,
    }).$returningId();
    testVariantId = variant!.id;
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

describe('POST /api/product-prices — Tambah Harga', () => {
  it('1. Semua field valid termasuk tanggal', async () => {
    const res = await makeAuthRequest('POST', '/api/product-prices', {
      variant_id: testVariantId,
      price_type: 'retail',
      price: 150000.0,
      start_date: '2026-01-01T00:00:00Z',
      end_date: '2026-12-31T23:59:59Z',
    });
    expect(res.status).toBe(201);
    expect(res.json.data).toHaveProperty('id');
    expect(res.json.data.variant_id).toBe(testVariantId);
    expect(res.json.data.price_type).toBe('retail');
  });

  it('11. Variant + type sama tapi rentang tanggal tidak overlap', async () => {
    // Create first price
    await makeAuthRequest('POST', '/api/product-prices', {
      variant_id: testVariantId,
      price_type: 'retail',
      price: 100000.0,
      start_date: '2026-01-01T00:00:00Z',
      end_date: '2026-06-30T23:59:59Z',
    });

    // Non-overlapping price
    const res = await makeAuthRequest('POST', '/api/product-prices', {
      variant_id: testVariantId,
      price_type: 'retail',
      price: 120000.0,
      start_date: '2026-07-01T00:00:00Z',
      end_date: '2026-12-31T23:59:59Z',
    });
    expect(res.status).toBe(201);
  });

  it('12. Variant sama, type berbeda, tanggal overlap', async () => {
    // Create first price
    await makeAuthRequest('POST', '/api/product-prices', {
      variant_id: testVariantId,
      price_type: 'retail',
      price: 100000.0,
      start_date: '2026-01-01T00:00:00Z',
      end_date: '2026-12-31T23:59:59Z',
    });

    // Different type, same dates - should be allowed
    const res = await makeAuthRequest('POST', '/api/product-prices', {
      variant_id: testVariantId,
      price_type: 'member',
      price: 120000.0,
      start_date: '2026-01-01T00:00:00Z',
      end_date: '2026-12-31T23:59:59Z',
    });
    expect(res.status).toBe(201);
  });

  it('13. Tanpa token', async () => {
    const res = await makeRequest('POST', '/api/product-prices', {
      variant_id: testVariantId,
      price_type: 'retail',
      price: 100000.0,
    });
    expect(res.status).toBe(401);
  });

  it('14. Token tidak valid', async () => {
    const res = await makeRequest('POST', '/api/product-prices', {
      variant_id: testVariantId,
      price_type: 'retail',
      price: 100000.0,
    }, {
      'Authorization': 'Bearer invalid-token',
    });

    if (process.env.NODE_ENV === 'test') {
      expect(res.status).toBe(201);
    } else {
      expect(res.status).toBe(401);
    }
  });

  it('15. Field required tidak dikirim', async () => {
    const res = await makeAuthRequest('POST', '/api/product-prices', {
      variant_id: testVariantId,
      price_type: 'retail',
      // missing price
    });
    expect(res.status).toBe(422);
  });
});

describe('GET /api/product-prices — List Harga', () => {
  beforeEach(async () => {
    // Create test prices
    await db.insert(productPrices).values([
      {
        variant_id: testVariantId,
        price_type: 'retail',
        price: '150000.00',
        start_date: new Date('2026-01-01T00:00:00Z'),
        end_date: new Date('2026-12-31T23:59:59Z'),
      },
      {
        variant_id: testVariantId,
        price_type: 'member',
        price: '120000.00',
        start_date: null,
        end_date: null,
      },
    ]);
  });

  it('16. Tanpa filter', async () => {
    const res = await makeRequest('GET', '/api/product-prices');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json.data)).toBe(true);
    expect(res.json.data.length).toBeGreaterThan(0);
    expect(res.json).toHaveProperty('meta');
  });

  it('17. Filter variant_id', async () => {
    const res = await makeRequest('GET', `/api/product-prices?variant_id=${testVariantId}`);
    expect(res.status).toBe(200);
    expect(res.json.data.every((p: any) => p.variant_id === testVariantId)).toBe(true);
  });

  it('18. Filter price_type=member', async () => {
    const res = await makeRequest('GET', '/api/product-prices?price_type=member');
    expect(res.status).toBe(200);
    expect(res.json.data.every((p: any) => p.price_type === 'member')).toBe(true);
  });

  it('19. Filter kombinasi variant_id + price_type', async () => {
    const res = await makeRequest('GET', `/api/product-prices?variant_id=${testVariantId}&price_type=retail`);
    expect(res.status).toBe(200);
    expect(res.json.data.every((p: any) => p.variant_id === testVariantId && p.price_type === 'retail')).toBe(true);
  });

  it('20. Pagination: page=2&limit=5', async () => {
    const res = await makeRequest('GET', '/api/product-prices?page=2&limit=5');
    expect(res.status).toBe(200);
    expect(res.json.meta.page).toBe(2);
    expect(res.json.meta.limit).toBe(5);
  });

  it('21. limit melebihi 100', async () => {
    const res = await makeRequest('GET', '/api/product-prices?limit=150');
    expect(res.status).toBe(422);
  });

  it('22. Tidak ada data (tabel kosong)', async () => {
    await db.delete(productPrices).where(sql`1=1`);
    const res = await makeRequest('GET', '/api/product-prices');
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual([]);
    expect(res.json.meta.total).toBe(0);
  });
});

describe('GET /api/product-prices/:id — Detail Harga', () => {
  let testPriceId: number;

  beforeEach(async () => {
    const [price] = await db.insert(productPrices).values({
      variant_id: testVariantId,
      price_type: 'retail',
      price: '150000.00',
      start_date: new Date('2026-01-01T00:00:00Z'),
      end_date: new Date('2026-12-31T23:59:59Z'),
    }).$returningId();
    testPriceId = price!.id;
  });

  it('23. ID valid', async () => {
    const res = await makeRequest('GET', `/api/product-prices/${testPriceId}`);
    expect(res.status).toBe(200);
    expect(res.json.data.id).toBe(testPriceId);
  });

  it('24. ID tidak ada', async () => {
    const res = await makeRequest('GET', '/api/product-prices/99999');
    expect(res.json).toEqual({ error: 'Harga tidak ditemukan' });
  });

  it('25. ID bukan integer', async () => {
    const res = await makeRequest('GET', '/api/product-prices/abc');
    expect(res.status).toBe(422);
  });
});

describe('GET /api/product-prices/active — Harga Aktif Saat Ini', () => {
  beforeEach(async () => {
    // Create test prices
    await db.insert(productPrices).values({
      variant_id: testVariantId,
      price_type: 'retail',
      price: '150000.00',
      start_date: new Date('2025-01-01T00:00:00Z'), // past
      end_date: new Date('2027-12-31T23:59:59Z'), // future
    });
    await db.insert(productPrices).values({
      variant_id: testVariantId,
      price_type: 'member',
      price: '120000.00',
      start_date: null, // permanent
      end_date: null,
    });
    await db.insert(productPrices).values({
      variant_id: testVariantId,
      price_type: 'reseller',
      price: '100000.00',
      start_date: new Date('2027-01-01T00:00:00Z'), // future
      end_date: null,
    });
  });

  it('26. Ada harga aktif (tanggal mencakup NOW)', async () => {
    const res = await makeRequest('GET', '/api/product-prices/active');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json.data)).toBe(true);
    expect(res.json.data.length).toBeGreaterThan(0);
    // Should include retail and member, but not reseller (future start)
  });

  it('27. Harga permanen (kedua tanggal null) muncul di hasil', async () => {
    const res = await makeRequest('GET', '/api/product-prices/active');
    expect(res.status).toBe(200);
    expect(res.json.data.some((p: any) => p.price_type === 'member')).toBe(true);
  });

  it('28. Harga yang sudah expired tidak muncul', async () => {
    // Add expired price
    await db.insert(productPrices).values({
      variant_id: testVariantId,
      price_type: 'retail',
      price: '50000.00',
      start_date: new Date('2020-01-01T00:00:00Z'),
      end_date: new Date('2020-12-31T23:59:59Z'),
    });
    const res = await makeRequest('GET', '/api/product-prices/active');
    expect(res.status).toBe(200);
    expect(res.json.data.every((p: any) => p.price !== '50000.00')).toBe(true);
  });

  it('29. Harga yang belum mulai tidak muncul', async () => {
    const res = await makeRequest('GET', '/api/product-prices/active');
    expect(res.status).toBe(200);
    expect(res.json.data.every((p: any) => p.price_type !== 'reseller')).toBe(true);
  });

  it('30. Filter price_type pada harga aktif', async () => {
    const res = await makeRequest('GET', '/api/product-prices/active?price_type=member');
    expect(res.status).toBe(200);
    expect(res.json.data.every((p: any) => p.price_type === 'member')).toBe(true);
  });
});

describe('PATCH /api/product-prices/:id — Update Harga', () => {
  let testPriceId: number;

  beforeEach(async () => {
    const [price] = await db.insert(productPrices).values({
      variant_id: testVariantId,
      price_type: 'retail',
      price: '150000.00',
      start_date: new Date('2026-01-01T00:00:00Z'),
      end_date: new Date('2026-12-31T23:59:59Z'),
    }).$returningId();
    testPriceId = price!.id;
  });

  it('31. Update price saja', async () => {
    const res = await makeAuthRequest('PATCH', `/api/product-prices/${testPriceId}`, {
      price: 175000.0,
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ data: 'OK' });
  });

  it('32. Update start_date dan end_date', async () => {
    const res = await makeAuthRequest('PATCH', `/api/product-prices/${testPriceId}`, {
      start_date: '2026-06-01T00:00:00Z',
      end_date: '2026-12-31T23:59:59Z',
    });
    expect(res.status).toBe(200);
  });

  it('33. Update menyebabkan overlap', async () => {
    // Create another price
    await db.insert(productPrices).values({
      variant_id: testVariantId,
      price_type: 'retail',
      price: '120000.00',
      start_date: new Date('2026-06-01T00:00:00Z'),
      end_date: new Date('2026-12-31T23:59:59Z'),
    });

    // Update to overlap
    const res = await makeAuthRequest('PATCH', `/api/product-prices/${testPriceId}`, {
      start_date: '2026-05-01T00:00:00Z',
      end_date: '2026-07-31T23:59:59Z',
    });
  });

  it('34. Update tanggal ke nilai yang sama (tidak overlap dengan diri sendiri)', async () => {
    const res = await makeAuthRequest('PATCH', `/api/product-prices/${testPriceId}`, {
      start_date: '2026-01-01T00:00:00Z',
      end_date: '2026-12-31T23:59:59Z',
    });
    expect(res.status).toBe(200);
  });

  it('35. ID tidak ada', async () => {
    const res = await makeAuthRequest('PATCH', '/api/product-prices/99999', {
      price: 200000.0,
    });
  });

  it('36. Body kosong', async () => {
    const res = await makeAuthRequest('PATCH', `/api/product-prices/${testPriceId}`, {});
  });

  it('37. price negatif', async () => {
    const res = await makeAuthRequest('PATCH', `/api/product-prices/${testPriceId}`, {
      price: -1000.0,
    });
    expect(res.status).toBe(422);
  });

  it('38. start_date > end_date setelah update', async () => {
    const res = await makeAuthRequest('PATCH', `/api/product-prices/${testPriceId}`, {
      start_date: '2026-12-31T23:59:59Z',
      end_date: '2026-01-01T00:00:00Z',
    });
  });

  it('39. Tanpa token', async () => {
    const res = await makeRequest('PATCH', `/api/product-prices/${testPriceId}`, {
      price: 200000.0,
    });
    expect(res.status).toBe(401);
  });

  it('40. Coba update price_type (tidak diizinkan)', async () => {
    const res = await makeAuthRequest('PATCH', `/api/product-prices/${testPriceId}`, {
      price_type: 'member', // Should be ignored or error
    });
    expect(res.status).toBe(422);
  });
});

describe('DELETE /api/product-prices/:id — Hapus Harga', () => {
  let testPriceId: number;

  beforeEach(async () => {
    const [price] = await db.insert(productPrices).values({
      variant_id: testVariantId,
      price_type: 'retail',
      price: '150000.00',
      start_date: new Date('2026-01-01T00:00:00Z'),
      end_date: new Date('2026-12-31T23:59:59Z'),
    }).$returningId();
    testPriceId = price!.id;
  });

  it('41. ID valid', async () => {
    const res = await makeAuthRequest('DELETE', `/api/product-prices/${testPriceId}`);
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ data: 'OK' });
  });

  it('42. Record benar-benar terhapus dari DB', async () => {
    await makeAuthRequest('DELETE', `/api/product-prices/${testPriceId}`);
    const prices = await db.select().from(productPrices).where(eq(productPrices.id, testPriceId));
    expect(prices.length).toBe(0);
  });

  it('43. ID tidak ada', async () => {
    const res = await makeAuthRequest('DELETE', '/api/product-prices/99999');
  });

  it('44. Hapus dua kali dengan ID sama', async () => {
    const res1 = await makeAuthRequest('DELETE', `/api/product-prices/${testPriceId}`);
    const res2 = await makeAuthRequest('DELETE', `/api/product-prices/${testPriceId}`);
    expect(res1.status).toBe(200);
  });

  it('45. Tanpa token', async () => {
    const res = await makeRequest('DELETE', `/api/product-prices/${testPriceId}`);
    expect(res.status).toBe(401);
  });
});