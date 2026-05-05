import { Elysia, t } from 'elysia';
import {
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
  updateUser,
} from '../service/users-service';
import { bearerAuth, getUserIdFromToken } from './auth-middleware';
import { rateLimit } from '../middleware/rate-limit';
import { db } from '../db';
import { users } from '../db/schema';

const registerRoute = new Elysia()
  .use(rateLimit({ windowMs: 60000, max: 10 })) // 10 requests per minute for registration
  .post(
    '/api/users',
    async ({ body, set }: any) => {
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
    },
    {
      body: t.Object({
        name: t.String({ maxLength: 255 }),
        email: t.String({ format: 'email', maxLength: 255 }),
        password: t.String({ minLength: 8, maxLength: 255 }),
      }),
      detail: {
        summary: 'Register a new user',
      },
    }
  );

const loginRoute = new Elysia()
  .use(rateLimit({ windowMs: 60000, max: 5 })) // 5 requests per minute for login
  .post(
    '/api/users/login',
    async ({ body, set }: any) => {
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
    },
    {
      body: t.Object({
        email: t.String({ format: 'email', maxLength: 255 }),
        password: t.String({ maxLength: 255 }),
      }),
      detail: {
        summary: 'Login with email and password',
      },
    }
  );

const listUsersRoute = new Elysia().get('/api/users', async () => {
  const allUsers = await db.select().from(users);
  return {
    users: allUsers.map((u: any) => {
      const { password, ...rest } = u;
      return rest;
    }),
  };
});

const currentUserRoute = new Elysia()
  .use(rateLimit({ windowMs: 60000, max: 60 })) // 60 requests per minute for current user
  .get('/api/users/current', bearerAuth(getCurrentUser));

const logoutRoute = new Elysia()
  .use(rateLimit({ windowMs: 60000, max: 10 })) // 10 requests per minute for logout
  .delete('/api/users/logout', bearerAuth(logoutUser), {
    detail: {
      summary: 'Logout and delete session',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Logout successful',
          content: {
            'application/json': {
              example: {
                data: 'OK',
              },
            },
          },
        },
        401: {
          description: 'Unauthorized - invalid or missing token',
          content: {
            'application/json': {
              example: {
                error: 'Unauthorized',
              },
            },
          },
        },
      },
    },
  });

const updateRoute = new Elysia()
  .use(rateLimit({ windowMs: 60000, max: 10 })) // 10 requests per minute for update
  .patch(
    '/api/users',
    async ({ body, set, headers }: any) => {
      const authHeader = headers['authorization'] || headers['Authorization'];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const token = authHeader.substring(7);

      try {
        const userId = await getUserIdFromToken(token);

        // Check if at least one field is provided
        if (!body.name && !body.email && !body.password) {
          set.status = 422;
          return { error: 'At least one field must be provided' };
        }

        const result = await updateUser(userId, body);
        return { data: result };
      } catch (err: any) {
        if (err.message === 'Email sudah digunakan') {
          set.status = 409;
          return { error: 'Email sudah digunakan' };
        }
        if (err.message === 'Unauthorized') {
          set.status = 401;
          return { error: 'Unauthorized' };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ maxLength: 255 })),
        email: t.Optional(t.String({ format: 'email', maxLength: 255 })),
        password: t.Optional(t.String({ minLength: 8, maxLength: 255 })),
      }),
      detail: {
        summary: 'Update current user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'User updated successfully',
            content: {
              'application/json': {
                example: {
                  data: 'OK',
                },
              },
            },
          },
          401: {
            description: 'Unauthorized - invalid or missing token',
            content: {
              'application/json': {
                example: {
                  error: 'Unauthorized',
                },
              },
            },
          },
          409: {
            description: 'Email already used by another user',
            content: {
              'application/json': {
                example: {
                  error: 'Email sudah digunakan',
                },
              },
            },
          },
        },
      },
    }
  );

export const usersRoute = registerRoute
  .use(loginRoute)
  .use(listUsersRoute)
  .use(currentUserRoute)
  .use(logoutRoute)
  .use(updateRoute);
