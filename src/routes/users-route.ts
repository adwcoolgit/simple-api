import { Elysia, t } from 'elysia';
import { registerUser, loginUser } from '../service/users-service';

export const usersRoute = new Elysia()
  .post('/api/users', async ({ body, set }: any) => {
    try {
      const user = await registerUser(body);
      return { data: 'Success' };
    } catch (err: any) {
      if (err.message === 'Email sudah terdaftar') {
        set.status = 409;
        return { error: 'Email sudah terdaftar' };
      }
      throw err;
    }
  }, {
    body: t.Object({
      name: t.String(),
      email: t.String({ format: 'email' }),
      password: t.String({ minLength: 8 }),
    }),
    detail: {
      summary: 'Register a new user',
    },
  })
  .post('/api/users/login', async ({ body, set }: any) => {
    try {
      const result = await loginUser(body);
      return { data: result };
    } catch (err: any) {
      if (err.message === 'Email atau password salah') {
        set.status = 401;
        return { error: 'Email atau password salah' };
      }
      throw err;
    }
  }, {
    body: t.Object({
      email: t.String({ format: 'email' }),
      password: t.String(),
    }),
    detail: {
      summary: 'Login with email and password',
    },
  });
