import { Elysia, t } from 'elysia';
import { registerUser, loginUser, getCurrentUser, logoutUser } from '../service/users-service';
import { bearerAuth } from './auth-middleware';
import { db } from '../db';
import { users } from '../db/schema';

export const usersRoute = new Elysia({ tags: ['Users'] })
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
      name: t.String({ maxLength: 255 }),
      email: t.String({ format: 'email', maxLength: 255 }),
      password: t.String({ minLength: 8, maxLength: 255 }),
    }),
    detail: {
      summary: 'Register a new user',
      responses: {
        200: {
          description: 'User registered successfully',
          content: {
            'application/json': {
              example: {
                data: 'Success'
              }
            }
          }
        },
        409: {
          description: 'Email already registered',
          content: {
            'application/json': {
              example: {
                error: 'Email sudah terdaftar'
              }
            }
          }
        },
        422: {
          description: 'Validation error',
          content: {
            'application/json': {
              example: {
                error: 'Validation failed'
              }
            }
          }
        }
      }
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
      email: t.String({ format: 'email', maxLength: 255 }),
      password: t.String({ maxLength: 255 }),
    }),
    detail: {
      summary: 'Login with email and password',
      responses: {
        200: {
          description: 'Login successful',
          content: {
            'application/json': {
              example: {
                data: {
                  token: 'uuid-token-string-here'
                }
              }
            }
          }
        },
        401: {
          description: 'Invalid email or password',
          content: {
            'application/json': {
              example: {
                error: 'Email atau password salah'
              }
            }
          }
        },
        422: {
          description: 'Validation error',
          content: {
            'application/json': {
              example: {
                error: 'Validation failed'
              }
            }
          }
        }
      }
    },
  })
  .get('/api/users', async () => {
    const allUsers = await db.select().from(users);
    return {
      users: allUsers.map((u: any) => {
        const { password, ...rest } = u;
        return rest;
      })
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
