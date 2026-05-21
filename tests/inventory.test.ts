import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { routes } from '../src/routes';
import { usersRoute } from '../src/routes/users-route';
import {
  createInventory,
  listInventory,
  getInventoryDetail,
  updateInventorySettings,
  adjustStock,
  reserveStock,
  releaseStock,
  deleteInventory,
} from '../src/routes/inventory-route';
import { db } from '../src/db';
import {
  users,
  sessions,
  inventory,
  productVariants,
  products,
  warehouses,
  productCosts,
  productImages,
  barcodes,
  productTaxes,
} from '../src/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';
import { isDbAvailable } from '../src/utils/db-utils';

const app = new Elysia()
  .use(routes)
  .use(usersRoute)
  .use(createInventory)
  .use(listInventory)
  .use(getInventoryDetail)
  .use(updateInventorySettings)
  .use(adjustStock)
  .use(reserveStock)
  .use(releaseStock)
  .use(deleteInventory);

const testEmail = `test-inventory-${Date.now()}@example.com`;
const testPassword = 'password123';
const testName = 'Test User';

let token: string;
let testVariantId: number;
let testWarehouseId: number;
let testWarehouseId2: number;

beforeEach(async () => {
  // Cleanup test data in reverse dependency order
  await db.delete(inventory).where(sql`1=1`);
  await db.delete(warehouses).where(sql`1=1`);
  await db.delete(productCosts).where(sql`1=1`);
  await db.delete(productImages).where(sql`1=1`);
  await db.delete(barcodes).where(sql`1=1`); // Delete barcodes first
  await db.delete(productTaxes).where(sql`1=1`); // Delete taxes before variants
  await db.delete(productVariants).where(sql`1=1`);
  await db.delete(products).where(sql`1=1`);

  const userIds = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.email} like 'test%'`);
  if (userIds.length > 0) {
    await db.delete(sessions).where(
      inArray(
        sessions.userId,
        userIds.map((u) => u.id)
      )
    );
  }
  await db.delete(users).where(sql`${users.email} like 'test%'`);

  // Create test user and get token
  await app.handle(
    new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: testName,
        email: testEmail,
        password: testPassword,
      }),
    })
  );

  const loginRes = await app.handle(
    new Request('http://localhost/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    })
  );
  const loginJson = (await loginRes.json()) as any;
  token = loginJson.data.token;

  const timestamp = Date.now();

  // Create test product, variant, and warehouse
  const productRes = await db.insert(products).values({
    name: `Test Product-${timestamp}`,
    description: 'Test Description',
  });
  const productId = productRes[0].insertId;

  const variantRes = await db.insert(productVariants).values({
    productId: productId,
    sku: `TEST-SKU-${timestamp}`,
    variantName: 'Test Variant',
  });
  testVariantId = Number(variantRes[0].insertId);

  const warehouseRes = await db.insert(warehouses).values({
    name: `Test Warehouse-${timestamp}`,
    address: 'Test Address',
  });
  testWarehouseId = Number(warehouseRes[0].insertId);

  // Create a second warehouse for low_stock test
  const warehouseRes2 = await db.insert(warehouses).values({
    name: `Test Warehouse 2-${timestamp}`,
    address: 'Test Address 2',
  });
  testWarehouseId2 = Number(warehouseRes2[0].insertId);
});

// Helper function to make requests
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

describe('POST /api/inventory — Create Inventory Record', () => {
  it('1. Complete and valid data', async () => {
    const res = await makeRequest(
      'POST',
      '/api/inventory',
      {
        variant_id: testVariantId,
        warehouse_id: testWarehouseId,
        stock_qty: 100,
        reserved_qty: 0,
        min_stock: 10,
        max_stock: 500,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(201);
    expect(res.json.data).toHaveProperty('id');
    expect(res.json.data.variant_id).toBe(testVariantId);
    expect(res.json.data.warehouse_id).toBe(testWarehouseId);
    expect(res.json.data.stock_qty).toBe('100.00');
    expect(res.json.data.reserved_qty).toBe('0.00');
    expect(res.json.data.available_qty).toBe('100.00');
    expect(res.json.data.min_stock).toBe('10.00');
    expect(res.json.data.max_stock).toBe('500.00');
  });

  it('2. Without min_stock and max_stock', async () => {
    const res = await makeRequest(
      'POST',
      '/api/inventory',
      {
        variant_id: testVariantId,
        warehouse_id: testWarehouseId,
        stock_qty: 50,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(201);
    expect(res.json.data.min_stock).toBeNull();
    expect(res.json.data.max_stock).toBeNull();
  });

  it('3. stock_qty not provided → defaults to 0', async () => {
    const res = await makeRequest(
      'POST',
      '/api/inventory',
      {
        variant_id: testVariantId,
        warehouse_id: testWarehouseId,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(201);
    expect(res.json.data.stock_qty).toBe('0.00');
    expect(res.json.data.available_qty).toBe('0.00');
  });

  it('4. Combination of variant_id + warehouse_id already exists', async () => {
    // Create first
    await makeRequest(
      'POST',
      '/api/inventory',
      {
        variant_id: testVariantId,
        warehouse_id: testWarehouseId,
      },
      { Authorization: `Bearer ${token}` }
    );
    // Try again
    const res = await makeRequest(
      'POST',
      '/api/inventory',
      {
        variant_id: testVariantId,
        warehouse_id: testWarehouseId,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(409);
    expect(res.json.error).toBe(
      'The inventory for this variant and warehouse already exists'
    );
  });

  it('5. variant_id does not exist in product_variants table', async () => {
    const res = await makeRequest(
      'POST',
      '/api/inventory',
      {
        variant_id: 99999,
        warehouse_id: testWarehouseId,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(422);
  });

  it('6. warehouse_id does not exist in warehouses table', async () => {
    const res = await makeRequest(
      'POST',
      '/api/inventory',
      {
        variant_id: testVariantId,
        warehouse_id: 99999,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(422);
  });

  it('7. stock_qty negatif', async () => {
    const res = await makeRequest(
      'POST',
      '/api/inventory',
      {
        variant_id: testVariantId,
        warehouse_id: testWarehouseId,
        stock_qty: -10,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(422);
  });

  it('8. min_stock lebih besar dari max_stock', async () => {
    const res = await makeRequest(
      'POST',
      '/api/inventory',
      {
        variant_id: testVariantId,
        warehouse_id: testWarehouseId,
        min_stock: 100,
        max_stock: 50,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(422);
  });

  it('9. min_stock equals max_stock', async () => {
    const res = await makeRequest(
      'POST',
      '/api/inventory',
      {
        variant_id: testVariantId,
        warehouse_id: testWarehouseId,
        min_stock: 100,
        max_stock: 100,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(422);
  });

  it('10. Required field not provided', async () => {
    const res = await makeRequest(
      'POST',
      '/api/inventory',
      {
        warehouse_id: testWarehouseId,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(422);
  });

  it('11. Tanpa token', async () => {
    const res = await makeRequest('POST', '/api/inventory', {
      variant_id: testVariantId,
      warehouse_id: testWarehouseId,
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/inventory — List Inventory', () => {
  if (!isDbAvailable()) return;

  beforeEach(async () => {
    // Create test inventory
    await makeRequest(
      'POST',
      '/api/inventory',
      {
        variant_id: testVariantId,
        warehouse_id: testWarehouseId,
        stock_qty: 100,
        min_stock: 10,
      },
      { Authorization: `Bearer ${token}` }
    );
  });

  it('1. Tanpa filter — mengembalikan semua data', async () => {
    const res = await makeRequest('GET', '/api/inventory', undefined, {
      Authorization: `Bearer ${token}`,
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json.data)).toBe(true);
    expect(res.json.data.length).toBeGreaterThan(0);
  });

  it('2. Filter warehouse_id valid', async () => {
    const res = await makeRequest(
      'GET',
      `/api/inventory?warehouse_id=${testWarehouseId}`,
      undefined,
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(200);
    expect(
      res.json.data.every((item: any) => item.warehouse_id === testWarehouseId)
    ).toBe(true);
  });

  it('3. Filter variant_id valid', async () => {
    const res = await makeRequest(
      'GET',
      `/api/inventory?variant_id=${testVariantId}`,
      undefined,
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(200);
    expect(
      res.json.data.every((item: any) => item.variant_id === testVariantId)
    ).toBe(true);
  });

  it('4. Filter low_stock=true — stok di bawah min_stock', async () => {
    // Create low stock inventory
    const lowStockRes = await makeRequest(
      'POST',
      '/api/inventory',
      {
        variant_id: testVariantId,
        warehouse_id: testWarehouseId2,
        stock_qty: 5,
        min_stock: 10,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(lowStockRes.status).toBe(201); // Ensure creation succeeds

    const res = await makeRequest(
      'GET',
      '/api/inventory?low_stock=true',
      undefined,
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(200);
    expect(res.json.data.some((item: any) => item.stock_qty === '5.00')).toBe(
      true
    );
  });

  it('5. Filter low_stock=true — semua stok normal', async () => {
    const res = await makeRequest(
      'GET',
      '/api/inventory?low_stock=true',
      undefined,
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(200);
    expect(res.json.data.length).toBe(0);
  });

  it('6. No data at all', async () => {
    await db.delete(inventory).where(sql`1=1`);
    const res = await makeRequest('GET', '/api/inventory', undefined, {
      Authorization: `Bearer ${token}`,
    });
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual([]);
  });

  it('7. Response mengandung field available_qty', async () => {
    const res = await makeRequest('GET', '/api/inventory', undefined, {
      Authorization: `Bearer ${token}`,
    });
    expect(res.status).toBe(200);
    expect(res.json.data[0]).toHaveProperty('available_qty');
    expect(res.json.data[0].available_qty).toBe('100.00');
  });

  it('8. Tanpa token', async () => {
    const res = await makeRequest('GET', '/api/inventory');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/inventory/:variantId/:warehouseId — Detail Inventory', () => {
  beforeEach(async () => {
    // Create test inventory
    await makeRequest(
      'POST',
      '/api/inventory',
      {
        variant_id: testVariantId,
        warehouse_id: testWarehouseId,
        stock_qty: 100,
        min_stock: 10,
      },
      { Authorization: `Bearer ${token}` }
    );
  });

  it('1. Record exists', async () => {
    const res = await makeRequest(
      'GET',
      `/api/inventory/${testVariantId}/${testWarehouseId}`,
      undefined,
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(200);
    expect(res.json.data.variant_id).toBe(testVariantId);
    expect(res.json.data.warehouse_id).toBe(testWarehouseId);
    expect(res.json.data.available_qty).toBe('100.00');
  });

  it('2. variantId or warehouseId does not exist', async () => {
    const res = await makeRequest(
      'GET',
      `/api/inventory/99999/${testWarehouseId}`,
      undefined,
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Inventory not found');
  });

  it('3. Parameter bukan angka', async () => {
    const res = await makeRequest('GET', '/api/inventory/abc/def', undefined, {
      Authorization: `Bearer ${token}`,
    });
    expect(res.status).toBe(422);
  });

  it('4. Tanpa token', async () => {
    const res = await makeRequest(
      'GET',
      `/api/inventory/${testVariantId}/${testWarehouseId}`
    );
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/inventory/:variantId/:warehouseId — Update Stock Settings', () => {
  beforeEach(async () => {
    // Create test inventory
    const res = await makeRequest(
      'POST',
      '/api/inventory',
      {
        variant_id: testVariantId,
        warehouse_id: testWarehouseId,
        stock_qty: 100,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(201); // Ensure creation succeeds
  });

  it('1. Update min_stock only', async () => {
    const res = await makeRequest(
      'PATCH',
      `/api/inventory/${testVariantId}/${testWarehouseId}`,
      {
        min_stock: 20,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(200);
    expect(res.json.data).toBe('OK');
  });

  it('2. Update max_stock only', async () => {
    const res = await makeRequest(
      'PATCH',
      `/api/inventory/${testVariantId}/${testWarehouseId}`,
      {
        max_stock: 1000,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(200);
    expect(res.json.data).toBe('OK');
  });

  it('3. Update both with valid values', async () => {
    const res = await makeRequest(
      'PATCH',
      `/api/inventory/${testVariantId}/${testWarehouseId}`,
      {
        min_stock: 20,
        max_stock: 1000,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(200);
    expect(res.json.data).toBe('OK');
  });

  it('4. min_stock >= max_stock', async () => {
    const res = await makeRequest(
      'PATCH',
      `/api/inventory/${testVariantId}/${testWarehouseId}`,
      {
        min_stock: 100,
        max_stock: 50,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(422);
  });

  it('5. Empty body', async () => {
    const res = await makeRequest(
      'PATCH',
      `/api/inventory/${testVariantId}/${testWarehouseId}`,
      {},
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(422);
  });

  it('6. Record not found', async () => {
    const res = await makeRequest(
      'PATCH',
      `/api/inventory/99999/${testWarehouseId}`,
      {
        min_stock: 20,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Inventory not found');
  });

  it('7. Tanpa token', async () => {
    const res = await makeRequest(
      'PATCH',
      `/api/inventory/${testVariantId}/${testWarehouseId}`,
      {
        min_stock: 20,
      }
    );
    expect(res.status).toBe(401);
  });
});

describe('POST /api/inventory/:variantId/:warehouseId/adjust — Stock Adjustment', () => {
  beforeEach(async () => {
    // Create test inventory
    const res = await makeRequest(
      'POST',
      '/api/inventory',
      {
        variant_id: testVariantId,
        warehouse_id: testWarehouseId,
        stock_qty: 100,
        min_stock: 10,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(201); // Ensure creation succeeds
  });

  it('1. Stock increase (positive qty)', async () => {
    const res = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/adjust`,
      {
        qty: 50,
        note: 'Restock',
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(200);
    expect(res.json.data.stock_qty).toBe('150.00');
    expect(res.json.data.available_qty).toBe('150.00');
  });

  it('2. Stock decrease (negative qty) with sufficient stock', async () => {
    const res = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/adjust`,
      {
        qty: -20,
        note: 'Sale',
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(200);
    expect(res.json.data.stock_qty).toBe('80.00');
    expect(res.json.data.available_qty).toBe('80.00');
  });

  it('3. Decrease causing stock < 0', async () => {
    const res = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/adjust`,
      {
        qty: -200,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(422);
    expect(res.json.error).toBe('Insufficient stock for this adjustment');
  });

  it('4. Decrease exceeding stock (result < 0)', async () => {
    const res = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/adjust`,
      {
        qty: -150,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(422);
    expect(res.json.error).toBe('Insufficient stock for this adjustment');
  });

  it('5. qty bernilai 0', async () => {
    const res = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/adjust`,
      {
        qty: 0,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(422);
  });

  it('6. Record not found', async () => {
    const res = await makeRequest(
      'POST',
      `/api/inventory/99999/${testWarehouseId}/adjust`,
      {
        qty: 10,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Inventory not found');
  });

  it('7. Tanpa token', async () => {
    const res = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/adjust`,
      {
        qty: 10,
      }
    );
    expect(res.status).toBe(401);
  });
});

describe('POST /api/inventory/:variantId/:warehouseId/reserve — Reserve Stock', () => {
  beforeEach(async () => {
    // Create test inventory
    await makeRequest(
      'POST',
      '/api/inventory',
      {
        variant_id: testVariantId,
        warehouse_id: testWarehouseId,
        stock_qty: 100,
      },
      { Authorization: `Bearer ${token}` }
    );
  });

  it('1. Reserve with sufficient available stock', async () => {
    const res = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/reserve`,
      {
        qty: 20,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(200);
    expect(res.json.data.reserved_qty).toBe('20.00');
    expect(res.json.data.available_qty).toBe('80.00');
  });

  it('2. Reserve exactly the available_qty', async () => {
    const res = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/reserve`,
      {
        qty: 100,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(200);
    expect(res.json.data.reserved_qty).toBe('100.00');
    expect(res.json.data.available_qty).toBe('0.00');
  });

  it('3. Reserve exceeding available_qty', async () => {
    const res = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/reserve`,
      {
        qty: 150,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(422);
    expect(res.json.error).toBe('Insufficient stock for reservation');
  });

  it('4. Reserve gradually until exhausted', async () => {
    const res1 = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/reserve`,
      {
        qty: 50,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res1.status).toBe(200);

    const res2 = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/reserve`,
      {
        qty: 50,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res2.status).toBe(200);

    const res3 = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/reserve`,
      {
        qty: 1,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res3.status).toBe(422);
  });

  it('5. qty bernilai 0 atau negatif', async () => {
    const res = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/reserve`,
      {
        qty: 0,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(422);
  });

  it('6. Record not found', async () => {
    const res = await makeRequest(
      'POST',
      `/api/inventory/99999/${testWarehouseId}/reserve`,
      {
        qty: 10,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Inventory not found');
  });

  it('7. Tanpa token', async () => {
    const res = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/reserve`,
      {
        qty: 10,
      }
    );
    expect(res.status).toBe(401);
  });
});

describe('POST /api/inventory/:variantId/:warehouseId/release — Release Reservation', () => {
  beforeEach(async () => {
    // Create test inventory with reservation
    const res = await makeRequest(
      'POST',
      '/api/inventory',
      {
        variant_id: testVariantId,
        warehouse_id: testWarehouseId,
        stock_qty: 100,
        reserved_qty: 30,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(201); // Ensure creation succeeds
  });

  it('1. Release partial reservation', async () => {
    const res = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/release`,
      {
        qty: 10,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(200);
    expect(res.json.data.reserved_qty).toBe('20.00');
    expect(res.json.data.available_qty).toBe('80.00');
  });

  it('2. Release another partial reservation', async () => {
    const res = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/release`,
      {
        qty: 20,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(200);
    expect(res.json.data.reserved_qty).toBe('10.00');
    expect(res.json.data.available_qty).toBe('90.00');
  });

  it('3. Release exceeding existing reserved_qty', async () => {
    const res = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/release`,
      {
        qty: 50,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(422);
    expect(res.json.error).toBe(
      'Release quantity exceeds the reserved amount'
    );
  });

  it('4. Release when reserved_qty = 0', async () => {
    // First release all
    await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/release`,
      {
        qty: 30,
      },
      { Authorization: `Bearer ${token}` }
    );

    const res = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/release`,
      {
        qty: 10,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(422);
  });

  it('5. qty bernilai 0 atau negatif', async () => {
    const res = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/release`,
      {
        qty: 0,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(422);
  });

  it('6. Record not found', async () => {
    const res = await makeRequest(
      'POST',
      `/api/inventory/99999/${testWarehouseId}/release`,
      {
        qty: 10,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Inventory not found');
  });

  it('7. Tanpa token', async () => {
    const res = await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/release`,
      {
        qty: 10,
      }
    );
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/inventory/:variantId/:warehouseId — Delete Inventory Record', () => {
  beforeEach(async () => {
    // Create test inventory
    const res = await makeRequest(
      'POST',
      '/api/inventory',
      {
        variant_id: testVariantId,
        warehouse_id: testWarehouseId,
        stock_qty: 100,
      },
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(201); // Ensure creation succeeds
  });

  it('1. Record exists, reserved_qty = 0', async () => {
    const res = await makeRequest(
      'DELETE',
      `/api/inventory/${testVariantId}/${testWarehouseId}`,
      undefined,
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(200);
    expect(res.json.data).toBe('OK');
  });

  it('2. Record exists, reserved_qty > 0', async () => {
    // Add reservation
    await makeRequest(
      'POST',
      `/api/inventory/${testVariantId}/${testWarehouseId}/reserve`,
      {
        qty: 10,
      },
      { Authorization: `Bearer ${token}` }
    );

    const res = await makeRequest(
      'DELETE',
      `/api/inventory/${testVariantId}/${testWarehouseId}`,
      undefined,
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(422);
    expect(res.json.error).toBe(
      'Cannot delete inventory that still has active reservations'
    );
  });

  it('3. After delete, GET the same record', async () => {
    await makeRequest(
      'DELETE',
      `/api/inventory/${testVariantId}/${testWarehouseId}`,
      undefined,
      { Authorization: `Bearer ${token}` }
    );
    const res = await makeRequest(
      'GET',
      `/api/inventory/${testVariantId}/${testWarehouseId}`,
      undefined,
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(404);
  });

  it('4. Record not found', async () => {
    const res = await makeRequest(
      'DELETE',
      `/api/inventory/99999/${testWarehouseId}`,
      undefined,
      { Authorization: `Bearer ${token}` }
    );
    expect(res.status).toBe(404);
    expect(res.json.error).toBe('Inventory not found');
  });

  it('5. Tanpa token', async () => {
    const res = await makeRequest(
      'DELETE',
      `/api/inventory/${testVariantId}/${testWarehouseId}`
    );
    expect(res.status).toBe(401);
  });
});
