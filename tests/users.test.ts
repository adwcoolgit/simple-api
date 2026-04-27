import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { routes } from '../src/routes';
import { usersRoute } from '../src/routes/users-route';
import { db } from '../src/db';
import { users, sessions } from '../src/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';

const app = new Elysia().use(routes).use(usersRoute);

const testEmail = 'test@example.com';
const testPassword = 'password123';
const testName = 'Test User';

beforeEach(async () => {
  // Cleanup test data
  const userIds = await db.select({ id: users.id }).from(users).where(sql`${users.email} like 'test%'`);
  if (userIds.length > 0) {
    await db.delete(sessions).where(inArray(sessions.userId, userIds.map(u => u.id)));
  }
  await db.delete(users).where(sql`${users.email} like 'test%'`);
});

// Helper function to make requests
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

describe('POST /api/users — Registrasi', () => {
  it('1. Request valid, semua field lengkap', async () => {
    const res = await makeRequest('POST', '/api/users', {
      name: testName,
      email: testEmail,
      password: testPassword,
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ data: 'Success' });
  });

  it('2. Email sudah terdaftar', async () => {
    // First register
    await makeRequest('POST', '/api/users', {
      name: testName,
      email: testEmail,
      password: testPassword,
    });
    // Try again
    const res = await makeRequest('POST', '/api/users', {
      name: 'Another User',
      email: testEmail,
      password: 'anotherpass123',
    });
    expect(res.status).toBe(409);
    expect(res.json).toEqual({ error: 'Email sudah terdaftar' });
  });

  it('3. Field `email` tidak dikirim', async () => {
    const res = await makeRequest('POST', '/api/users', {
      name: testName,
      password: testPassword,
    });
    expect(res.status).toBe(422);
  });

  it('4. Field `password` tidak dikirim', async () => {
    const res = await makeRequest('POST', '/api/users', {
      name: testName,
      email: testEmail,
    });
    expect(res.status).toBe(422);
  });

  it('5. Field `name` tidak dikirim', async () => {
    const res = await makeRequest('POST', '/api/users', {
      email: testEmail,
      password: testPassword,
    });
    expect(res.status).toBe(422);
  });

  it('6. Format `email` tidak valid (bukan format email)', async () => {
    const res = await makeRequest('POST', '/api/users', {
      name: testName,
      email: 'invalidemail',
      password: testPassword,
    });
    expect(res.status).toBe(422);
  });

  it('7. `password` kurang dari 8 karakter', async () => {
    const res = await makeRequest('POST', '/api/users', {
      name: testName,
      email: testEmail,
      password: '1234567',
    });
    expect(res.status).toBe(422);
  });

  it('8. Request body kosong', async () => {
    const res = await makeRequest('POST', '/api/users');
    expect(res.status).toBe(422);
  });

  it('9. Field dikirim tapi nilainya string kosong ""', async () => {
    const res = await makeRequest('POST', '/api/users', {
      name: '',
      email: '',
      password: '',
    });
    expect(res.status).toBe(422);
  });

  it('10. Field dikirim tapi nilainya `null`', async () => {
    const res = await makeRequest('POST', '/api/users', {
      name: null,
      email: null,
      password: null,
    });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/users/login — Login', () => {
  beforeEach(async () => {
    // Register test user
    await makeRequest('POST', '/api/users', {
      name: testName,
      email: testEmail,
      password: testPassword,
    });
  });

  it('1. Email dan password benar', async () => {
    const res = await makeRequest('POST', '/api/users/login', {
      email: testEmail,
      password: testPassword,
    });
    expect(res.status).toBe(200);
    expect(res.json.data).toHaveProperty('token');
    expect(res.json.data.token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i); // UUID v4 regex
  });

  it('2. Email terdaftar tapi password salah', async () => {
    const res = await makeRequest('POST', '/api/users/login', {
      email: testEmail,
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Email atau password salah' });
  });

  it('3. Email tidak terdaftar', async () => {
    const res = await makeRequest('POST', '/api/users/login', {
      email: 'nonexistent@example.com',
      password: testPassword,
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Email atau password salah' });
  });

  it('4. Field `email` tidak dikirim', async () => {
    const res = await makeRequest('POST', '/api/users/login', {
      password: testPassword,
    });
    expect(res.status).toBe(422);
  });

  it('5. Field `password` tidak dikirim', async () => {
    const res = await makeRequest('POST', '/api/users/login', {
      email: testEmail,
    });
    expect(res.status).toBe(422);
  });

  it('6. Format `email` tidak valid', async () => {
    const res = await makeRequest('POST', '/api/users/login', {
      email: 'invalidemail',
      password: testPassword,
    });
    expect(res.status).toBe(422);
  });

  it('7. Request body kosong', async () => {
    const res = await makeRequest('POST', '/api/users/login');
    expect(res.status).toBe(422);
  });

  it('8. Login dua kali dengan kredensial yang sama', async () => {
    const res1 = await makeRequest('POST', '/api/users/login', {
      email: testEmail,
      password: testPassword,
    });
    const res2 = await makeRequest('POST', '/api/users/login', {
      email: testEmail,
      password: testPassword,
    });
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.json.data.token).not.toBe(res2.json.data.token);
    // Check two sessions in DB
    const sessionsCount = await db.select().from(sessions).where(sql`${sessions.userId} in (select ${users.id} from ${users} where ${users.email} = ${testEmail})`);
    expect(sessionsCount.length).toBe(2);
  });

  it('9. Password dikirim sebagai plain text yang identik dengan hash (edge case bcrypt)', async () => {
    // Get the hashed password from DB
    const user = await db.select({ password: users.password }).from(users).where(eq(users.email, testEmail)).limit(1);
    const hashedPassword = user[0]!.password;
    const res = await makeRequest('POST', '/api/users/login', {
      email: testEmail,
      password: hashedPassword, // Send hash as plain text
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Email atau password salah' });
  });
});

describe('GET /api/users/current — Get User Login', () => {
  let token: string;
  let userData: any;

  beforeEach(async () => {
    // Register and login
    await makeRequest('POST', '/api/users', {
      name: testName,
      email: testEmail,
      password: testPassword,
    });
    const loginRes = await makeRequest('POST', '/api/users/login', {
      email: testEmail,
      password: testPassword,
    });
    token = loginRes.json.data.token;
    userData = await db.select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt }).from(users).where(eq(users.email, testEmail)).limit(1);
    userData = userData[0]!;
  });

  it('1. Token valid di header `Authorization`', async () => {
    const res = await makeRequest('GET', '/api/users/current', undefined, {
      'Authorization': `Bearer ${token}`,
    });
    expect(res.status).toBe(200);
    expect(res.json.data).toHaveProperty('id');
    expect(res.json.data).toHaveProperty('name');
    expect(res.json.data).toHaveProperty('email');
    expect(res.json.data).toHaveProperty('createdAt');
  });

  it('2. Response tidak mengandung field `password`', async () => {
    const res = await makeRequest('GET', '/api/users/current', undefined, {
      'Authorization': `Bearer ${token}`,
    });
    expect(res.status).toBe(200);
    expect(res.json.data).not.toHaveProperty('password');
  });

  it('3. Header `Authorization` tidak dikirim', async () => {
    const res = await makeRequest('GET', '/api/users/current');
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('4. Header dikirim tapi token tidak ada di tabel `sessions` (token random)', async () => {
    const res = await makeRequest('GET', '/api/users/current', undefined, {
      'Authorization': 'Bearer random-invalid-token',
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('5. Format header salah — tidak diawali `"Bearer "`', async () => {
    const res = await makeRequest('GET', '/api/users/current', undefined, {
      'Authorization': token,
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('6. Token dikirim tapi nilai setelah `"Bearer "` adalah string kosong', async () => {
    const res = await makeRequest('GET', '/api/users/current', undefined, {
      'Authorization': 'Bearer ',
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('7. Token adalah UUID valid tapi sudah pernah dihapus (expired/logout)', async () => {
    // Delete the session
    await db.delete(sessions).where(eq(sessions.token, token));
    const res = await makeRequest('GET', '/api/users/current', undefined, {
      'Authorization': `Bearer ${token}`,
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('8. Data yang dikembalikan sesuai dengan data user yang login (bukan user lain)', async () => {
    const res = await makeRequest('GET', '/api/users/current', undefined, {
      'Authorization': `Bearer ${token}`,
    });
    expect(res.status).toBe(200);
    expect(res.json.data.id).toBe(userData.id);
    expect(res.json.data.name).toBe(userData.name);
    expect(res.json.data.email).toBe(userData.email);
    expect(res.json.data.createdAt).toBe(userData.createdAt.toISOString());
  });
});

describe('DELETE /api/users/logout — Logout', () => {
  let token: string;

  beforeEach(async () => {
    // Register and login
    await makeRequest('POST', '/api/users', {
      name: testName,
      email: testEmail,
      password: testPassword,
    });
    const loginRes = await makeRequest('POST', '/api/users/login', {
      email: testEmail,
      password: testPassword,
    });
    token = loginRes.json.data.token;
  });

  it('1. Token valid', async () => {
    const res = await makeRequest('DELETE', '/api/users/logout', undefined, {
      'Authorization': `Bearer ${token}`,
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ data: 'OK' });
  });

  it('2. Setelah logout, session benar-benar terhapus dari tabel `sessions`', async () => {
    await makeRequest('DELETE', '/api/users/logout', undefined, {
      'Authorization': `Bearer ${token}`,
    });
    const session = await db.select().from(sessions).where(eq(sessions.token, token));
    expect(session.length).toBe(0);
  });

  it('3. Setelah logout, token yang sama tidak bisa digunakan di `GET /api/users/current`', async () => {
    await makeRequest('DELETE', '/api/users/logout', undefined, {
      'Authorization': `Bearer ${token}`,
    });
    const res = await makeRequest('GET', '/api/users/current', undefined, {
      'Authorization': `Bearer ${token}`,
    });
    expect(res.status).toBe(401);
  });

  it('4. Header `Authorization` tidak dikirim', async () => {
    const res = await makeRequest('DELETE', '/api/users/logout');
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('5. Token tidak ada di tabel `sessions`', async () => {
    const res = await makeRequest('DELETE', '/api/users/logout', undefined, {
      'Authorization': 'Bearer nonexistent-token',
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('6. Format header salah — tidak diawali `"Bearer "`', async () => {
    const res = await makeRequest('DELETE', '/api/users/logout', undefined, {
      'Authorization': token,
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: 'Unauthorized' });
  });

  it('7. Logout dua kali dengan token yang sama', async () => {
    const res1 = await makeRequest('DELETE', '/api/users/logout', undefined, {
      'Authorization': `Bearer ${token}`,
    });
    const res2 = await makeRequest('DELETE', '/api/users/logout', undefined, {
      'Authorization': `Bearer ${token}`,
    });
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(401);
  });

  it('8. Token milik user lain tidak bisa digunakan untuk logout user ini', async () => {
    // Create another user
    await makeRequest('POST', '/api/users', {
      name: 'Other User',
      email: 'other@example.com',
      password: 'otherpass123',
    });
    const otherLogin = await makeRequest('POST', '/api/users/login', {
      email: 'other@example.com',
      password: 'otherpass123',
    });
    const otherToken = otherLogin.json.data.token;

    // Try to logout with other token
    const res = await makeRequest('DELETE', '/api/users/logout', undefined, {
      'Authorization': `Bearer ${otherToken}`,
    });
    expect(res.status).toBe(200); // Logs out the other user

    // Check that original session still exists
    const originalSession = await db.select().from(sessions).where(eq(sessions.token, token));
    expect(originalSession.length).toBe(1);
  });
});