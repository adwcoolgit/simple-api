import { Elysia } from 'elysia';
import { db } from '../db';
import { users, sessions } from '../db/schema';
import { eq } from 'drizzle-orm';

export const authMiddleware = new Elysia()
  .derive(async ({ headers, cookie }) => {
    const token = cookie.auth_token || headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new Error('Unauthorized');
    }

    const session = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1);
    if (!session[0]) {
      throw new Error('Unauthorized');
    }

    const user = await db.select().from(users).where(eq(users.id, session[0].userId)).limit(1);
    if (!user[0]) {
      throw new Error('Unauthorized');
    }

    return { user: user[0] };
  })
  .onError(({ error, set }) => {
    if (error instanceof Error && error.message === 'Unauthorized') {
      set.status = 401;
      return { error: 'Unauthorized' };
    }
  });