import { users, sessions } from '../db/schema';
import { db, dbRead } from '../db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { redis } from '../cache/redis';

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginUserInput {
  email: string;
  password: string;
}

export async function registerUser(input: RegisterUserInput) {
  // Input validation
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('Name is required');
  }
  if (input.name.length > 255) {
    throw new Error('Nama terlalu panjang, maksimal 255 karakter');
  }
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new Error('Valid email is required');
  }
  if (input.email.length > 255) {
    throw new Error('Email terlalu panjang, maksimal 255 karakter');
  }
  if (!input.password || input.password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  if (input.password.length > 255) {
    throw new Error('Password terlalu panjang, maksimal 255 karakter');
  }

  try {
    const existingUser = await dbRead.select().from(users).where(eq(users.email, input.email)).limit(1);
    if (existingUser.length > 0) {
      throw new Error('Email sudah terdaftar');
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);

    await db.insert(users).values({
      name: input.name,
      email: input.email,
      password: hashedPassword,
    });

    const [newUser] = await dbRead.select().from(users).where(eq(users.email, input.email));

    if (!newUser) {
      throw new Error('Failed to create user');
    }

    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  } catch (error: any) {
    console.error('Registration error:', error);

    // Handle database constraint violation
    if (error?.message?.includes('varchar') ||
        error?.message?.includes('length') ||
        error?.code === 'ER_DATA_TOO_LONG' ||
        error?.message?.includes('Data too long')) {
      throw new Error('Input terlalu panjang, maksimal 255 karakter');
    }

    if (error instanceof Error && error.message.includes('Email sudah terdaftar')) {
      throw error;
    }

    throw new Error('Gagal mendaftarkan user');
  }
}

export async function loginUser(input: LoginUserInput) {
  // Input validation
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new Error('Email atau password salah');
  }
  if (!input.password) {
    throw new Error('Email atau password salah');
  }

  try {
    const [user] = await dbRead.select().from(users).where(eq(users.email, input.email));

    if (!user) {
      throw new Error('Email atau password salah');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);

    if (!isPasswordValid) {
      throw new Error('Email atau password salah');
    }

    const token = crypto.randomUUID();

    await db.insert(sessions).values({
      token: token,
      userId: Number(user.id),
    });

    // Cache token -> user_id in Redis with TTL 1 hour
    try {
      await redis.set(token, String(user.id), 'EX', 3600);
    } catch (err) {
      // Redis unavailable, continue with DB only
      console.warn('Failed to cache session in Redis:', err);
    }

    return { token };
  } catch (error) {
    console.error('Login error:', error);
    throw new Error('Email atau password salah');
  }
}
export async function getCurrentUser(token: string) {
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
      console.warn('Redis unavailable, falling back to DB:', err);
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
        // Redis unavailable, continue
        console.warn('Failed to cache session in Redis:', err);
      }
    }

    // Get user data
    const [user] = await dbRead.select().from(users).where(eq(users.id, userId));

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error) {
    console.error('Get current user error:', error);
    throw new Error('Unauthorized');
  }
}

export async function logoutUser(token: string) {
  try {
    const [session] = await dbRead.select().from(sessions).where(eq(sessions.token, token));

    if (!session) {
      throw new Error('Unauthorized');
    }

    await db.delete(sessions).where(eq(sessions.token, token));

    // Invalidate cache
    try {
      await redis.del(token);
    } catch (err) {
      // Redis unavailable, continue
      console.warn('Failed to invalidate session cache in Redis:', err);
    }
  } catch (error) {
    console.error('Logout error:', error);
    throw new Error('Unauthorized');
  }
}
