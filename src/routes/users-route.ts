import { Elysia, t } from 'elysia';
import {
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
} from '../service/users-service';
import { bearerAuth } from './auth-middleware';
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
  .delete('/api/users/logout', bearerAuth(logoutUser));

export const usersRoute = registerRoute
  .use(loginRoute)
  .use(listUsersRoute)
  .use(currentUserRoute)
  .use(logoutRoute)
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
  )
  .use(rateLimit({ windowMs: 60000, max: 60 })) // 60 requests per minute for current user
  .get('/api/users/current', bearerAuth(getCurrentUser))
  .use(rateLimit({ windowMs: 60000, max: 10 })) // 10 requests per minute for logout
  .delete('/api/users/logout', bearerAuth(logoutUser));

export const usersRouteWithoutRateLimit = new Elysia()
  .get('/api/users', async () => {
    const allUsers = await db.select().from(users);
    return {
      users: allUsers.map((u: any) => {
        const { password, ...rest } = u;
        return rest;
      }),
    };
  }, {
    detail: {
      summary: 'Get all users (admin endpoint)',
      responses: {
        200: {
          description: 'List of all users',
          content: {
            'application/json': {
              example: {
                users: [
                  {
                    id: 1,
                    name: 'John Doe',
                    email: 'john@example.com',
                    created_at: '2026-04-27T07:22:33.000Z'
                  },
                  {
                    id: 2,
                    name: 'Jane Smith',
                    email: 'jane@example.com',
                    created_at: '2026-04-27T08:15:22.000Z'
                  }
                ]
              }
            }
          }
        }
      }
    }
  })
  .get('/api/users/current', bearerAuth(getCurrentUser), {
    detail: {
      summary: 'Get current authenticated user',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Current user data',
          content: {
            'application/json': {
              example: {
                data: {
                  id: 1,
                  name: 'John Doe',
                  email: 'john@example.com',
                  created_at: '2026-04-27T07:22:33.000Z'
                }
              }
            }
          }
        },
        401: {
          description: 'Unauthorized - invalid or missing token',
          content: {
            'application/json': {
              example: {
                error: 'Unauthorized'
              }
            }
          }
        }
      }
    }
  })
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
                data: 'OK'
              }
            }
          }
        },
        401: {
          description: 'Unauthorized - invalid or missing token',
          content: {
            'application/json': {
              example: {
                error: 'Unauthorized'
              }
            }
          }
        }
      }
    }
  });
