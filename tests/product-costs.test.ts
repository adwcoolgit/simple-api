import { describe, it, beforeEach, afterEach } from 'bun:test';
import { expect } from 'bun:test';
import { Elysia } from 'elysia';
import { db } from '../src/db/index';
import { users, productVariants, products, productCosts, inventory } from '../src/db/schema';
import { eq, sql } from 'drizzle-orm';
import { productCostsRoute } from '../src/routes/product-costs-route';
import { routes } from '../src/routes';
import { usersRoute } from '../src/routes/users-route';

// Test app setup
const app = new Elysia()
  .use(routes)
  .use(usersRoute)
  .use(productCostsRoute)
  .get('/test', () => ({ message: 'Test endpoint' }));

// Test data setup
let testUserId: number;
let testProductId: number;
let testVariantId: number;
let testToken: string = 'test-token-123';

// Setup test data before each test
beforeEach(async () => {
  // Clean up existing data
  await db.delete(productCosts);
  await db.delete(productVariants);
  await db.delete(products);
  await db.delete(users);

  // Create test user
  await db.insert(users).values({
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedpassword',
  });
  const userResult = await db.select().from(users).where(eq(users.email, 'test@example.com'));
  testUserId = userResult[0].id;

  // Create test product
  await db.insert(products).values({
    name: 'Test Product',
    description: 'Test product description',
    isActive: true,
  });
  const productResult = await db.select().from(products).where(eq(products.name, 'Test Product'));
  testProductId = productResult[0].productId;

  // Create test variant
  await db.insert(productVariants).values({
    productId: testProductId,
    sku: 'TEST-SKU-001',
    variantName: 'Test Variant',
    isActive: true,
    isSellable: true,
  });
  const variantResult = await db.select().from(productVariants).where(eq(productVariants.sku, 'TEST-SKU-001'));
  testVariantId = variantResult[0].id;
});

// Clean up after each test
afterEach(async () => {
  await db.delete(productCosts);
  await db.delete(inventory);
  await db.delete(productVariants);
  await db.delete(products);
  await db.delete(users);
});

describe('POST /api/product-costs', () => {
  it('should create product cost with all valid fields', async () => {
    const response = await app.handle(
      new Request('http://localhost/product-costs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          variant_id: testVariantId,
          cost_price: 150000.0,
          effective_date: '2026-01-01T00:00:00.000Z',
        }),
      })
    );

    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.data).toHaveProperty('id');
    expect(result.data.variant_id).toBe(testVariantId);
    expect(result.data.cost_price).toBe('150000.00');
    expect(result.data.effective_date).toBe('2026-01-01T00:00:00.000Z');
  });

  it('should return 404 when variant does not exist', async () => {
    const response = await app.handle(
      new Request('http://localhost/product-costs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          variant_id: 99999,
          cost_price: 150000.0,
          effective_date: '2026-01-01T00:00:00.000Z',
        }),
      })
    );

    expect(response.status).toBe(404);
    const result = await response.json();
    expect(result.error).toBe('Variant tidak ditemukan');
  });

  it('should return 422 when cost_price is negative', async () => {
    const response = await app.handle(
      new Request('http://localhost/product-costs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          variant_id: testVariantId,
          cost_price: -1000.0,
          effective_date: '2026-01-01T00:00:00.000Z',
        }),
      })
    );

    expect(response.status).toBe(422);
  });

  it('should return 422 when cost_price is not provided', async () => {
    const response = await app.handle(
      new Request('http://localhost/product-costs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          variant_id: testVariantId,
          effective_date: '2026-01-01T00:00:00.000Z',
        }),
      })
    );

    expect(response.status).toBe(422);
  });

  it('should return 422 when effective_date is not provided', async () => {
    const response = await app.handle(
      new Request('http://localhost/product-costs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          variant_id: testVariantId,
          cost_price: 150000.0,
        }),
      })
    );

    expect(response.status).toBe(422);
  });

  it('should return 422 when effective_date format is invalid (not datetime)', async () => {
    const response = await app.handle(
      new Request('http://localhost/product-costs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          variant_id: testVariantId,
          cost_price: 150000.0,
          effective_date: 'invalid-date',
        }),
      })
    );

    expect(response.status).toBe(422);
  });

  it('should return 422 when variant_id is not provided', async () => {
    const response = await app.handle(
      new Request('http://localhost/product-costs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          cost_price: 150000.0,
          effective_date: '2026-01-01T00:00:00.000Z',
        }),
      })
    );

    expect(response.status).toBe(422);
  });

  it('should return 401 when Authorization header is missing', async () => {
    const response = await app.handle(
      new Request('http://localhost/product-costs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variant_id: testVariantId,
          cost_price: 150000.0,
          effective_date: '2026-01-01T00:00:00.000Z',
        }),
      })
    );

    expect(response.status).toBe(401);
  });

  it('should return 401 when token is invalid', async () => {
    const response = await app.handle(
      new Request('http://localhost/product-costs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token',
        },
        body: JSON.stringify({
          variant_id: testVariantId,
          cost_price: 150000.0,
          effective_date: '2026-01-01T00:00:00.000Z',
        }),
      })
    );

    expect(response.status).toBe(401);
  });

  it('should allow multiple cost records for the same variant (different history)', async () => {
    // First record
    const response1 = await app.handle(
      new Request('http://localhost/product-costs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          variant_id: testVariantId,
          cost_price: 150000.0,
          effective_date: '2026-01-01T00:00:00.000Z',
        }),
      })
    );

    // Second record
    const response2 = await app.handle(
      new Request('http://localhost/product-costs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          variant_id: testVariantId,
          cost_price: 175000.0,
          effective_date: '2026-06-01T00:00:00.000Z',
        }),
      })
    );

    expect(response1.status).toBe(201);
    expect(response2.status).toBe(201);
  });
});

describe('GET /api/product-costs/:variantId', () => {
  it('should return all cost records for existing variant with data', async () => {
    // Create test data
    await db.insert(productCosts).values([
      {
        variantId: testVariantId,
        costPrice: 150000.0,
        effectiveDate: new Date('2026-01-01'),
      },
      {
        variantId: testVariantId,
        costPrice: 175000.0,
        effectiveDate: new Date('2026-06-01'),
      },
    ]);

    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testVariantId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${testToken}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.data).toHaveLength(2);
    expect(result.data[0].cost_price).toBe('175000.00'); // Most recent first
    expect(result.data[1].cost_price).toBe('150000.00');
  });

  it('should return empty array when variant exists but has no cost data', async () => {
    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testVariantId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${testToken}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.data).toEqual([]);
  });

  it('should return 404 when variant does not exist', async () => {
    const response = await app.handle(
      new Request('http://localhost/product-costs/99999', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${testToken}`,
        },
      })
    );

    expect(response.status).toBe(404);
    const result = await response.json();
    expect(result.error).toBe('Variant tidak ditemukan');
  });

  it('should return records ordered by effective_date DESC', async () => {
    // Create test data with different dates
    await db.insert(productCosts).values([
      {
        variantId: testVariantId,
        costPrice: 150000.0,
        effectiveDate: new Date('2026-01-01'),
      },
      {
        variantId: testVariantId,
        costPrice: 160000.0,
        effectiveDate: new Date('2026-03-01'),
      },
      {
        variantId: testVariantId,
        costPrice: 175000.0,
        effectiveDate: new Date('2026-06-01'),
      },
    ]);

    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testVariantId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${testToken}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.data).toHaveLength(3);
    expect(result.data[0].effective_date).toBe('2026-06-01T00:00:00.000Z');
    expect(result.data[1].effective_date).toBe('2026-03-01T00:00:00.000Z');
    expect(result.data[2].effective_date).toBe('2026-01-01T00:00:00.000Z');
  });

  it('should return 401 when Authorization header is missing', async () => {
    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testVariantId}`, {
        method: 'GET',
      })
    );

    expect(response.status).toBe(401);
  });

  it('should return 401 when token is invalid', async () => {
    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testVariantId}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      })
    );

    expect(response.status).toBe(401);
  });
});

describe('GET /api/product-costs/:variantId/current', () => {
  it('should return most recent cost with effective_date in the past', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30); // 30 days ago

    await db.insert(productCosts).values([
      {
        variantId: testVariantId,
        costPrice: 150000.0,
        effectiveDate: pastDate,
      },
      {
        variantId: testVariantId,
        costPrice: 175000.0,
        effectiveDate: new Date(pastDate.getTime() + 86400000), // 1 day later
      },
    ]);

    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testVariantId}/current`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${testToken}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.data.cost_price).toBe('175000.00');
    expect(result.data.variant_id).toBe(testVariantId);
  });

  it('should return most recent cost considering effective_date <= NOW()', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    await db.insert(productCosts).values([
      {
        variantId: testVariantId,
        costPrice: 150000.0,
        effectiveDate: pastDate,
      },
      {
        variantId: testVariantId,
        costPrice: 200000.0,
        effectiveDate: futureDate, // Future date should not be considered
      },
    ]);

    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testVariantId}/current`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${testToken}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.data.cost_price).toBe('150000.00'); // Should return past date, not future
  });

  it('should return 404 when no active cost is found (only future dates)', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    await db.insert(productCosts).values({
      variantId: testVariantId,
      costPrice: 150000.0,
      effectiveDate: futureDate,
    });

    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testVariantId}/current`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${testToken}`,
        },
      })
    );

    expect(response.status).toBe(404);
    const result = await response.json();
    expect(result.error).toBe('Harga pokok aktif tidak ditemukan');
  });

  it('should return 404 when variant has no cost data', async () => {
    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testVariantId}/current`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${testToken}`,
        },
      })
    );

    expect(response.status).toBe(404);
    const result = await response.json();
    expect(result.error).toBe('Harga pokok aktif tidak ditemukan');
  });

  it('should return 404 when variant does not exist', async () => {
    const response = await app.handle(
      new Request('http://localhost/product-costs/99999/current', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${testToken}`,
        },
      })
    );

    expect(response.status).toBe(404);
    const result = await response.json();
    expect(result.error).toBe('Variant tidak ditemukan');
  });

  it('should return 401 when Authorization header is missing', async () => {
    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testVariantId}/current`, {
        method: 'GET',
      })
    );

    expect(response.status).toBe(401);
  });
});

describe('PATCH /api/product-costs/:id', () => {
  let testCostId: number;

  beforeEach(async () => {
    await db.insert(productCosts).values({
      variantId: testVariantId,
      costPrice: 150000.0,
      effectiveDate: new Date('2026-01-01'),
    });
    const costResult = await db.select().from(productCosts).where(eq(productCosts.variantId, testVariantId));
    testCostId = costResult[0].id;
  });

  it('should update cost_price only', async () => {
    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testCostId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          cost_price: 175000.0,
        }),
      })
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.data).toBe('OK');

    // Verify the update
    const updated = await db.select().from(productCosts).where(eq(productCosts.id, testCostId));
    expect(updated[0].costPrice).toBe(175000.0);
    expect(updated[0].effectiveDate?.toISOString()).toBe(new Date('2026-01-01').toISOString());
  });

  it('should update effective_date only', async () => {
    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testCostId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          effective_date: '2026-06-01T00:00:00.000Z',
        }),
      })
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.data).toBe('OK');

    // Verify the update
    const updated = await db.select().from(productCosts).where(eq(productCosts.id, testCostId));
    expect(updated[0].costPrice).toBe(150000.0);
    expect(updated[0].effectiveDate?.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('should update all fields', async () => {
    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testCostId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          cost_price: 175000.0,
          effective_date: '2026-06-01T00:00:00.000Z',
        }),
      })
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.data).toBe('OK');

    // Verify the update
    const updated = await db.select().from(productCosts).where(eq(productCosts.id, testCostId));
    expect(updated[0].costPrice).toBe(175000.0);
    expect(updated[0].effectiveDate?.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('should return 404 when record does not exist', async () => {
    const response = await app.handle(
      new Request('http://localhost/product-costs/99999', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          cost_price: 175000.0,
        }),
      })
    );

    expect(response.status).toBe(404);
    const result = await response.json();
    expect(result.error).toBe('Data tidak ditemukan');
  });

  it('should return 422 when request body is empty (no fields)', async () => {
    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testCostId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(422);
  });

  it('should return 422 when cost_price is negative', async () => {
    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testCostId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          cost_price: -1000.0,
        }),
      })
    );

    expect(response.status).toBe(422);
  });

  it('should ignore variant_id in request body (cannot be changed)', async () => {
    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testCostId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          variant_id: 99999, // Should be ignored
          cost_price: 175000.0,
        }),
      })
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.data).toBe('OK');

    // Verify variant_id was not changed
    const updated = await db.select().from(productCosts).where(eq(productCosts.id, testCostId));
    expect(updated[0].variantId).toBe(testVariantId);
  });

  it('should return 401 when Authorization header is missing', async () => {
    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testCostId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cost_price: 175000.0,
        }),
      })
    );

    expect(response.status).toBe(401);
  });

  it('should return 401 when token is invalid', async () => {
    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testCostId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token',
        },
        body: JSON.stringify({
          cost_price: 175000.0,
        }),
      })
    );

    expect(response.status).toBe(401);
  });
});

describe('DELETE /api/product-costs/:id', () => {
  let testCostId: number;

  beforeEach(async () => {
    await db.insert(productCosts).values({
      variantId: testVariantId,
      costPrice: 150000.0,
      effectiveDate: new Date('2026-01-01'),
    });
    const costResult = await db.select().from(productCosts).where(eq(productCosts.variantId, testVariantId));
    testCostId = costResult[0].id;
  });

  it('should successfully delete existing record', async () => {
    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testCostId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${testToken}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.data).toBe('OK');

    // Verify record was deleted
    const deleted = await db.select().from(productCosts).where(eq(productCosts.id, testCostId));
    expect(deleted).toHaveLength(0);
  });

  it('should return 404 when record does not exist', async () => {
    const response = await app.handle(
      new Request('http://localhost/product-costs/99999', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${testToken}`,
        },
      })
    );

    expect(response.status).toBe(404);
    const result = await response.json();
    expect(result.error).toBe('Data tidak ditemukan');
  });

  it('should return 401 when Authorization header is missing', async () => {
    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testCostId}`, {
        method: 'DELETE',
      })
    );

    expect(response.status).toBe(401);
  });

  it('should return 401 when token is invalid', async () => {
    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testCostId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      })
    );

    expect(response.status).toBe(401);
  });

  it('should allow current endpoint to return next active cost after deletion', async () => {
    // Create multiple costs
    await db.insert(productCosts).values([
      {
        variantId: testVariantId,
        costPrice: 140000.0,
        effectiveDate: new Date('2025-12-01'),
      },
      {
        variantId: testVariantId,
        costPrice: 160000.0,
        effectiveDate: new Date('2026-02-01'),
      },
    ]);

    // Delete the most recent (current) cost
    const response = await app.handle(
      new Request(`http://localhost/product-costs/${testCostId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${testToken}`,
        },
      })
    );

    expect(response.status).toBe(200);

    // Check current cost should now return the next most recent
    const currentResponse = await app.handle(
      new Request(`http://localhost/product-costs/${testVariantId}/current`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${testToken}`,
        },
      })
    );

    expect(currentResponse.status).toBe(200);
    const currentResult = await currentResponse.json();
    expect(currentResult.data.cost_price).toBe('160000.00'); // Next most recent after deletion
  });
});