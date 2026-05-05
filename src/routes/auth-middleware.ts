import { Elysia } from 'elysia';
import { dbRead } from '../db';
import { sessions } from '../db/schema';
import { eq } from 'drizzle-orm';
import { redis } from '../cache/redis';

// Bearer token authentication middleware
export const bearerAuth = (serviceFn: (token: string) => Promise<any>) =>
  async ({ set, headers }: any) => {
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const token = authHeader.substring(7);

    try {
      const result = await serviceFn(token);
      // Handle both void returns (like logout) and value returns (like getCurrentUser)
      return result === undefined ? { data: 'OK' } : { data: result };
    } catch (err: any) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }
  };

// Helper function to get userId from token
export const getUserIdFromToken = async (token: string): Promise<number> => {
  try {
    let userId: number | null = null;

    // Try Redis cache first
    try {
      const cachedUserId = await redis.get(token);
      if (cachedUserId) {
        userId = parseInt(cachedUserId);
      }
    } catch (err) {
      // Redis unavailable, will fallback to DB
      // Skip Redis errors in test environment
      if (process.env.NODE_ENV !== 'test') {
        console.warn('Redis unavailable, falling back to DB:', err);
      }
    }

    if (!userId) {
      // Cache miss or Redis error, query DB
      const [session] = await dbRead.select().from(sessions).where(eq(sessions.token, token));

      if (!session) {
        throw new Error('Unauthorized');
      }

      userId = session.userId;

      // Cache the result in Redis
      try {
        await redis.set(token, String(userId), 'EX', 3600);
      } catch (err) {
        // Redis unavailable, skip in test environment
        if (process.env.NODE_ENV !== 'test') {
          console.warn('Failed to cache session in Redis:', err);
        }
      }
    }

    return userId;
  } catch (error) {
    throw new Error('Unauthorized');
  }
};
