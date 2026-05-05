import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { routes } from '../src/routes';
import { usersRoute } from '../src/routes/users-route';
import { productsRoute } from '../src/routes/products-route';
import { db } from '../src/db';
import { users, sessions, products } from '../src/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';

const app = new Elysia().use(routes).use(usersRoute).use(productsRoute);

const testEmail = 'test@example.com';
const testPassword = 'password123';
const testName = 'Test User';

let authToken: string;
let testUserId: number;

beforeEach(async () => {
  // Cleanup test data
  await db.delete(products).where(sql`${products.pluName} like 'test%'`);
  const userIds = await db.select({ id: users.id }).from(users).where(sql`${users.email} like 'test%'`);
  if (userIds.length > 0) {
    await db.delete(sessions).where(inArray(sessions.userId, userIds.map(u => u.id)));
  }
  await db.delete(users).where(sql`${users.email} like 'test%'`);

  // Register test user
  await app.handle(new Request('http://localhost/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: testName,
      email: testEmail,
      password: testPassword,
    }),
  }));

  // Login to get token
  const loginRes = await app.handle(new Request('http://localhost/api/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  }));
  const loginJson = await loginRes.json() as any;
  authToken = loginJson.data.token;

  // Get user ID
  const user = await db.select({ id: users.id }).from(users).where(eq(users.email, testEmail)).limit(1);
  testUserId = user[0]!.id;
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

describe('POST /api/products — Buat Product Baru', () => {
  it('1. Semua field valid', async () => {
    const res = await makeAuthRequest('POST', '/api/products', {
      plu_name: 'Indomie Goreng',
      description: 'Mie instan rasa goreng',
      category_id: "1",
      department_id: 2,
      is_active: true,
    });
    expect(res.status).toBe(201);
    expect(res.json.data).toHaveProperty('pluNo');
    expect(res.json.data.pluName).toBe('Indomie Goreng');
    expect(res.json.data.description).toBe('Mie instan rasa goreng');
    expect(res.json.data.categoryId).toBe(1);
    expect(res.json.data.departmentId).toBe(2);
    expect(res.json.data.isActive).toBe(true);
  });

  it('2. Hanya `plu_name` (field lain opsional tidak dikirim)', async () => {
    const res = await makeAuthRequest('POST', '/api/products', {
      plu_name: 'Test Product Only Name',
    });
    expect(res.status).toBe(201);
    expect(res.json.data.pluName).toBe('Test Product Only Name');
    expect(res.json.data.description).toBeNull();
    expect(res.json.data.categoryId).toBeNull();
    expect(res.json.data.departmentId).toBeNull();
    expect(res.json.data.isActive).toBe(true);
  });

  it('3. `plu_name` tidak dikirim', async () => {
    const res = await makeAuthRequest('POST', '/api/products', {
      description: 'Test Description',
    });
    expect(res.status).toBe(422);
  });

  it('4. `plu_name` string kosong', async () => {
    const res = await makeAuthRequest('POST', '/api/products', {
      plu_name: '',
    });
    expect(res.status).toBe(422);
  });

  it('5. Tanpa header Authorization', async () => {
    const res = await makeRequest('POST', '/api/products', {
      plu_name: 'Test Product',
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('6. Token tidak valid', async () => {
    const res = await makeRequest('POST', '/api/products', {
      plu_name: 'Test Product',
    }, {
      'Authorization': 'Bearer invalid-token',
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('7. `is_active` tidak dikirim → default `true` di DB', async () => {
    const res = await makeAuthRequest('POST', '/api/products', {
      plu_name: 'Test Product Default Active',
    });
    expect(res.status).toBe(201);
    expect(res.json.data.isActive).toBe(true);
  });
});

describe('GET /api/products — List Semua Product', () => {
  beforeEach(async () => {
    // Create test products
    await db.insert(products).values([
      { pluName: 'Test Product 1', description: 'Desc 1', categoryId: 1, departmentId: 1, isActive: true },
      { pluName: 'Test Product 2', description: 'Desc 2', categoryId: 1, departmentId: 2, isActive: false },
      { pluName: 'Test Product 3', description: 'Desc 3', categoryId: 2, departmentId: 1, isActive: true },
    ]);
  });

  it('8. List semua product (ada data)', async () => {
    const res = await makeAuthRequest('GET', '/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json.data)).toBe(true);
    expect(res.json.data.length).toBeGreaterThan(0);
    expect(res.json).toHaveProperty('meta');
    expect(res.json.meta).toHaveProperty('total');
    expect(res.json.meta).toHaveProperty('page');
    expect(res.json.meta).toHaveProperty('limit');
  });

  it('9. List saat tidak ada data', async () => {
    await db.delete(products).where(sql`${products.pluName} like 'Test%'`);
    const res = await makeAuthRequest('GET', '/api/products');
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual([]);
    expect(res.json.meta.total).toBe(0);
  });

  it('10. Filter `is_active=true`', async () => {
    const res = await makeAuthRequest('GET', '/api/products?is_active=true');
    expect(res.status).toBe(200);
    expect(res.json.data.every((p: any) => p.isActive === true)).toBe(true);
  });

  it('11. Filter `is_active=false`', async () => {
    const res = await makeAuthRequest('GET', '/api/products?is_active=false');
    expect(res.status).toBe(200);
    expect(res.json.data.every((p: any) => p.isActive === false)).toBe(true);
  });

  it('12. Filter `category_id`', async () => {
    const res = await makeAuthRequest('GET', '/api/products?category_id=1');
    expect(res.status).toBe(200);
    expect(res.json.data.every((p: any) => p.categoryId === 1)).toBe(true);
  });

  it('13. Filter `department_id`', async () => {
    const res = await makeAuthRequest('GET', '/api/products?department_id=2');
    expect(res.status).toBe(200);
    expect(res.json.data.every((p: any) => p.departmentId === 2)).toBe(true);
  });

  it('14. Pagination `page=2&limit=5`', async () => {
    const res = await makeAuthRequest('GET', '/api/products?page=2&limit=2');
    expect(res.status).toBe(200);
    expect(res.json.meta.page).toBe(2);
    expect(res.json.meta.limit).toBe(2);
  });

  it('15. `limit` melebihi total data', async () => {
    const res = await makeAuthRequest('GET', '/api/products?limit=100');
    expect(res.status).toBe(200);
    expect(res.json.data.length).toBeLessThanOrEqual(3);
  });

  it('16. Tanpa header Authorization', async () => {
    const res = await makeRequest('GET', '/api/products');
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });
});

describe('GET /api/products/:pluNo — Detail Product', () => {
  let testPluNo: number;

  beforeEach(async () => {
    const [product] = await db.insert(products).values({
      pluName: 'Test Detail Product',
      description: 'Test Description',
      isActive: true,
    }).$returningId();
    testPluNo = product!.pluNo;
  });

  it('17. `pluNo` valid dan ada', async () => {
    const res = await makeAuthRequest('GET', `/api/products/${testPluNo}`);
    expect(res.status).toBe(200);
    expect(res.json.data.pluNo).toBe(testPluNo);
    expect(res.json.data.pluName).toBe('Test Detail Product');
  });

  it('18. `pluNo` tidak ada di DB', async () => {
    const res = await makeAuthRequest('GET', '/api/products/99999');
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Product tidak ditemukan' });
  });

  it('19. `pluNo` bukan angka', async () => {
    const res = await makeAuthRequest('GET', '/api/products/abc');
    expect(res.status).toBe(422);
  });

  it('20. Tanpa header Authorization', async () => {
    const res = await makeRequest('GET', `/api/products/${testPluNo}`);
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });
});

describe('PATCH /api/products/:pluNo — Update Product', () => {
  let testPluNo: number;

  beforeEach(async () => {
    const [product] = await db.insert(products).values({
      pluName: 'Test Update Product',
      description: 'Original Description',
      isActive: true,
    }).$returningId();
    testPluNo = product!.pluNo;
  });

  it('21. Update `plu_name` saja', async () => {
    const res = await makeAuthRequest('PATCH', `/api/products/${testPluNo}`, {
      plu_name: 'Updated Product Name',
    });
    expect(res.status).toBe(200);
    expect(res.json.data.pluName).toBe('Updated Product Name');
    expect(res.json.data.description).toBe('Original Description');
  });

  it('22. Update `description` saja', async () => {
    const res = await makeAuthRequest('PATCH', `/api/products/${testPluNo}`, {
      description: 'Updated Description',
    });
    expect(res.status).toBe(200);
    expect(res.json.data.description).toBe('Updated Description');
  });

  it('23. Update `is_active` dari `true` ke `false`', async () => {
    const res = await makeAuthRequest('PATCH', `/api/products/${testPluNo}`, {
      is_active: false,
    });
    expect(res.status).toBe(200);
    expect(res.json.data.isActive).toBe(false);
  });

  it('24. Update semua field sekaligus', async () => {
    const res = await makeAuthRequest('PATCH', `/api/products/${testPluNo}`, {
      plu_name: 'Fully Updated Product',
      description: 'Fully Updated Description',
      category_id: "5",
      department_id: 3,
      is_active: false,
    });
    expect(res.status).toBe(200);
    expect(res.json.data.pluName).toBe('Fully Updated Product');
    expect(res.json.data.description).toBe('Fully Updated Description');
    expect(res.json.data.categoryId).toBe(5);
    expect(res.json.data.departmentId).toBe(3);
    expect(res.json.data.isActive).toBe(false);
  });

  it('25. `plu_no` tidak ada di DB', async () => {
    const res = await makeAuthRequest('PATCH', '/api/products/99999', {
      plu_name: 'Nonexistent Product',
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Product tidak ditemukan' });
  });

  it('26. Body kosong', async () => {
    const res = await makeAuthRequest('PATCH', `/api/products/${testPluNo}`, {});
    expect(res.status).toBe(422);
    expect(res.json).toEqual({ error: 'At least one field must be provided' });
  });

  it('27. `plu_no` bukan angka', async () => {
    const res = await makeAuthRequest('PATCH', '/api/products/abc', {
      plu_name: 'Invalid PLU',
    });
    expect(res.status).toBe(422);
  });

  it('28. Tanpa header Authorization', async () => {
    const res = await makeRequest('PATCH', `/api/products/${testPluNo}`, {
      plu_name: 'Unauthorized Update',
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('29. `updated_at` berubah setelah update', async () => {
    const beforeUpdate = await db.select({ updatedAt: products.updatedAt }).from(products).where(eq(products.pluNo, testPluNo));
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait a bit
    await makeAuthRequest('PATCH', `/api/products/${testPluNo}`, {
      plu_name: 'Updated for Timestamp',
    });
    const afterUpdate = await db.select({ updatedAt: products.updatedAt }).from(products).where(eq(products.pluNo, testPluNo));
    expect(new Date(afterUpdate[0]!.updatedAt).getTime()).toBeGreaterThan(new Date(beforeUpdate[0]!.updatedAt).getTime());
  });
});

describe('DELETE /api/products/:pluNo — Soft Delete Product', () => {
  let testPluNo: number;

  beforeEach(async () => {
    const [product] = await db.insert(products).values({
      pluName: 'Test Delete Product',
      description: 'Test Description',
      isActive: true,
    }).$returningId();
    testPluNo = product!.pluNo;
  });

  it('30. `pluNo` valid', async () => {
    const res = await makeAuthRequest('DELETE', `/api/products/${testPluNo}`);
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ data: 'OK' });
  });

  it('31. Setelah delete, record masih ada di DB', async () => {
    await makeAuthRequest('DELETE', `/api/products/${testPluNo}`);
    const product = await db.select().from(products).where(eq(products.pluNo, testPluNo));
    expect(product.length).toBe(1);
    expect(product[0]!.isActive).toBe(false);
  });

  it('32. Setelah delete, GET product tersebut tergantung filter `is_active`', async () => {
    await makeAuthRequest('DELETE', `/api/products/${testPluNo}`);
    const allRes = await makeAuthRequest('GET', '/api/products');
    const activeRes = await makeAuthRequest('GET', '/api/products?is_active=true');
    const inactiveRes = await makeAuthRequest('GET', '/api/products?is_active=false');

    expect(allRes.json.data.some((p: any) => p.pluNo === testPluNo)).toBe(true);
    expect(activeRes.json.data.some((p: any) => p.pluNo === testPluNo)).toBe(false);
    expect(inactiveRes.json.data.some((p: any) => p.pluNo === testPluNo)).toBe(true);
  });

  it('33. Delete dua kali pada `pluNo` yang sama', async () => {
    const res1 = await makeAuthRequest('DELETE', `/api/products/${testPluNo}`);
    const res2 = await makeAuthRequest('DELETE', `/api/products/${testPluNo}`);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  it('34. `pluNo` tidak ada di DB', async () => {
    const res = await makeAuthRequest('DELETE', '/api/products/99999');
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: 'Product tidak ditemukan' });
  });

  it('35. `pluNo` bukan angka', async () => {
    const res = await makeAuthRequest('DELETE', '/api/products/abc');
    expect(res.status).toBe(422);
  });

  it('36. Tanpa header Authorization', async () => {
    const res = await makeRequest('DELETE', `/api/products/${testPluNo}`);
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });
});