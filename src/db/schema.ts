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
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 255 }),
  categoryId: bigint('category_id', { mode: 'number' }),
  departmentId: smallint('department_id'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
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

export const productCosts = mysqlTable('product_costs', {
  id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
  variantId: bigint('variant_id', { mode: 'number' }).notNull().references(() => productVariants.id),
  costPrice: decimal('cost_price', { precision: 12, scale: 2 }),
  effectiveDate: datetime('effective_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const productImages = mysqlTable('product_images', {
  id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
  variantId: bigint('variant_id', { mode: 'number' }).references(() => productVariants.id),
  imageUrl: varchar('image_url', { length: 255 }),
  isPrimary: boolean('is_primary').default(false).notNull(),
});

export const barcodes = mysqlTable('barcodes', {
  id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
  variantId: bigint('variant_id', { mode: 'number' }).notNull().references(() => productVariants.id),
  barcode: varchar('barcode', { length: 50 }).notNull(),
});

export const productTaxes = mysqlTable('product_taxes', {
  id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
  variantId: bigint('variant_id', { mode: 'number' }).notNull().references(() => productVariants.id),
  taxCode: varchar('tax_code', { length: 20 }),
  isInclusive: boolean('is_inclusive').default(false).notNull(),
});

export const warehouses = mysqlTable('warehouses', {
  id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  address: varchar('address', { length: 500 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const inventory = mysqlTable('inventory', {
  id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
  variantId: bigint('variant_id', { mode: 'number' }).notNull().references(() => productVariants.id),
  warehouseId: bigint('warehouse_id', { mode: 'number' }).notNull().references(() => warehouses.id),
  stockQty: decimal('stock_qty', { precision: 12, scale: 2 }).default('0').notNull(),
  reservedQty: decimal('reserved_qty', { precision: 12, scale: 2 }).default('0').notNull(),
  minStock: decimal('min_stock', { precision: 12, scale: 2 }),
  maxStock: decimal('max_stock', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  uniqueVariantWarehouse: sql`UNIQUE (${table.variantId}, ${table.warehouseId})`,
}));
