import { Elysia } from 'elysia';

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
