import { users } from '../db/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export interface RegisterUserInput {
  name: string;
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
