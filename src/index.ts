import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { routes } from './routes';
import { usersRoute } from './routes/users-route';
import { productsRoute } from './routes/products-route';
import { productVariantsRoute } from './routes/product-variants-route';
import { variantAttributesRoute } from './routes/variant-attributes-route';
import { productPricesRoute } from './routes/product-prices-route';
import { productCostsRoute } from './routes/product-costs-route';
import { productImagesRoute } from './routes/product-images-route';
import {
  createInventory,
  listInventory,
  getInventoryDetail,
  updateInventorySettings,
  adjustStock,
  reserveStock,
  releaseStock,
  deleteInventory,
} from './routes/inventory-route';
import { loggerMiddleware } from './middleware/logger';
import { redis } from './cache/redis';
import { sql } from 'drizzle-orm';
import { db } from './db/index';
import mysql from 'mysql2/promise';

// Database initialization function
async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database...');

    // Create database using raw MySQL connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });

    await connection.execute('CREATE DATABASE IF NOT EXISTS simple_api');
    await connection.end();

    console.log('✅ Database created successfully');

    // Now create tables using Drizzle - create all required tables first
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS products (
        product_id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description VARCHAR(255),
        category_id BIGINT,
        department_id SMALLINT,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_variants (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        product_id BIGINT NOT NULL,
        sku VARCHAR(50) NOT NULL UNIQUE,
        variant_name VARCHAR(100),
        uom VARCHAR(10),
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        is_sellable BOOLEAN DEFAULT TRUE NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS warehouses (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address VARCHAR(500),
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventory (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        variant_id BIGINT NOT NULL,
        warehouse_id BIGINT NOT NULL,
        stock_qty DECIMAL(12,2) DEFAULT '0' NOT NULL,
        reserved_qty DECIMAL(12,2) DEFAULT '0' NOT NULL,
        min_stock DECIMAL(12,2),
        max_stock DECIMAL(12,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
        UNIQUE(variant_id, warehouse_id)
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_prices (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        variant_id BIGINT NOT NULL,
        price_type ENUM('retail', 'member', 'reseller') NOT NULL,
        price DECIMAL(12,2) NOT NULL,
        start_date DATETIME,
        end_date DATETIME,
        FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS variant_attributes (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        variant_id BIGINT NOT NULL,
        attribute_name VARCHAR(50),
        attribute_value VARCHAR(50),
        FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        token VARCHAR(255) NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    // Finally create the product_costs table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_costs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        variant_id BIGINT NOT NULL,
        cost_price DECIMAL(12,2),
        effective_date DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    // Don't exit on error, just log it
    console.log('⚠️ Continuing without database initialization');
  }
}

const app = new Elysia()
  .use(loggerMiddleware)
  .use(
    swagger({
      path: '/openapi',
    })
  )
  .use(routes)
  .use(usersRoute)
  .use(productsRoute)
  .use(productVariantsRoute)
  .use(variantAttributesRoute)
  .use(productPricesRoute)
  .group('/api', app => app
    .use(productCostsRoute)
    .use(productImagesRoute)
  )
  .use(createInventory)
  .use(listInventory)
  .use(getInventoryDetail)
  .use(updateInventorySettings)
  .use(adjustStock)
  .use(reserveStock)
  .use(releaseStock)
  .use(deleteInventory)
  .get('/test', () => ({ message: 'Test endpoint' }), {
    detail: {
      summary: 'Test endpoint for Swagger',
      tags: ['Test'],
    },
  });

// Initialize database before starting server
await initializeDatabase();

app.listen(Bun.env.PORT || 3000);

// Test Redis connection on startup
redis
  .ping()
  .then(() => {
    console.log('🟥 Redis connected and ready');
  })
  .catch((err) => {
    console.warn('🟥 Redis connection failed:', err.message);
  });

console.log(
  '🚀 Server running on ' +
    (app.server?.hostname || 'localhost') +
    ':' +
    (app.server?.port || 3000)
);

console.log('📖 Swagger UI available at: http://localhost:3000/openapi');
console.log('📄 OpenAPI JSON available at: http://localhost:3000/openapi/json');
