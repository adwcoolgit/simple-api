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
  const existingUser = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (existingUser.length > 0) {
    throw new Error('Email sudah terdaftar');
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

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
}

export async function loginUser(input: LoginUserInput) {
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
}
