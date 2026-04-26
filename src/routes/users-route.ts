import { Elysia, t } from 'elysia';
import { registerUser } from '../service/users-service';

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
  });
