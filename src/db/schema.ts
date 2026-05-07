import {
  mysqlTable,
  int,
  bigint,
  smallint,
  varchar,
  timestamp,
  datetime,
  boolean,
  mysqlEnum,
  decimal,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const sessions = mysqlTable('sessions', {
  id: int('id').autoincrement().primaryKey(),
  token: varchar('token', { length: 255 }).notNull(),
  userId: int('user_id').notNull(),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).$onUpdate(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const products = mysqlTable('products', {
  productId: bigint('product_id', { mode: 'number' }).autoincrement().primaryKey(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  description: varchar('description', { length: 255 }),
  categoryId: bigint('category_id', { mode: 'number' }),
  departmentId: smallint('department_id'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).$onUpdate(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const productVariants = mysqlTable('product_variants', {
  id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
  productId: bigint('product_id', { mode: 'number' }).notNull().references(() => products.productId),
  sku: varchar('sku', { length: 50 }).notNull().unique(),
  variantName: varchar('variant_name', { length: 100 }),
  uom: varchar('uom', { length: 10 }),
  isActive: boolean('is_active').default(true).notNull(),
  isSellable: boolean('is_sellable').default(true).notNull(),
});

export const variantAttributes = mysqlTable('variant_attributes', {
  id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
  variantId: bigint('variant_id', { mode: 'number' }).notNull().references(() => productVariants.id),
  attributeName: varchar('attribute_name', { length: 50 }),
  attributeValue: varchar('attribute_value', { length: 50 }),
});

export const productPrices = mysqlTable('product_prices', {
  id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
  variant_id: bigint('variant_id', { mode: 'number' }).notNull().references(() => productVariants.id),
  price_type: mysqlEnum('price_type', ['retail', 'member', 'reseller']).notNull(),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  start_date: datetime('start_date'),
  end_date: datetime('end_date'),
});
