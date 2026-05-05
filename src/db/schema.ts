import {
  mysqlTable,
  int,
  bigint,
  smallint,
  varchar,
  timestamp,
  boolean,
} from 'drizzle-orm/mysql-core';

export const sessions = mysqlTable('sessions', {
  id: int('id').autoincrement().primaryKey(),
  token: varchar('token', { length: 255 }).notNull(),
  userId: int('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const products = mysqlTable('products', {
  productId: bigint('product_id', { mode: 'number' }).autoincrement().primaryKey(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  description: varchar('description', { length: 255 }),
  categoryId: bigint('category_id', { mode: 'number' }),
  departmentId: smallint('department_id'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});
