import { users, sessions } from '../db/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

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
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new Error('Valid email is required');
  }
  if (!input.password || input.password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  try {
    const existingUser = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    if (existingUser.length > 0) {
      throw new Error('Email sudah terdaftar');
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);

    await db.insert(users).values({
      name: input.name,
      email: input.email,
      password: hashedPassword,
    });

    const [newUser] = await db.select().from(users).where(eq(users.email, input.email));

    if (!newUser) {
      throw new Error('Failed to create user');
    }

    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  } catch (error) {
    console.error('Registration error:', error);
    if (error instanceof Error && error.message.includes('Email sudah terdaftar')) {
      throw error;
    }
    throw new Error('Failed to register user');
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
    const [user] = await db.select().from(users).where(eq(users.email, input.email));

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

    return { token };
  } catch (error) {
    console.error('Login error:', error);
    throw new Error('Email atau password salah');
  }
}
export async function getCurrentUser(token: string) {
  try {
    const [session] = await db.select().from(sessions).where(eq(sessions.token, token));

    if (!session) {
      throw new Error('Unauthorized');
    }

    const [user] = await db.select().from(users).where(eq(users.id, session.userId));

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
    const [session] = await db.select().from(sessions).where(eq(sessions.token, token));

    if (!session) {
      throw new Error('Unauthorized');
    }

    await db.delete(sessions).where(eq(sessions.token, token));
  } catch (error) {
    console.error('Logout error:', error);
    throw new Error('Unauthorized');
  }
}
