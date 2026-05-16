import mysql from 'mysql2/promise';

async function setupDatabase() {
  console.log('🗄️ Setting up database schema for CI...');

  // Database connection details
  const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'rootpassword',
    database: process.env.DB_NAME || 'simple_api',
    multipleStatements: true,
  };

  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log('🔍 Checking database connection...');
    await connection.execute('SELECT 1;');
    console.log('✅ Database connection verified');

    console.log('📋 Creating tables...');

    // Create tables individually
    const tableSQLs = [
      // Users table
      `CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`password\` varchar(255) NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT (now()),
        \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`users_id\` PRIMARY KEY(\`id\`),
        CONSTRAINT \`users_email_unique\` UNIQUE(\`email\`)
      )`,

      // Sessions table
      `CREATE TABLE IF NOT EXISTS \`sessions\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`token\` varchar(255) NOT NULL,
        \`user_id\` int NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`sessions_id\` PRIMARY KEY(\`id\`)
      )`,

      // Products table
      `CREATE TABLE IF NOT EXISTS \`products\` (
        \`product_id\` bigint AUTO_INCREMENT NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`description\` varchar(255),
        \`category_id\` bigint,
        \`department_id\` smallint,
        \`is_active\` boolean NOT NULL DEFAULT true,
        \`created_at\` timestamp NOT NULL DEFAULT (now()),
        \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`products_product_id\` PRIMARY KEY(\`product_id\`)
      )`,

      // Product variants table
      `CREATE TABLE IF NOT EXISTS \`product_variants\` (
        \`id\` bigint AUTO_INCREMENT NOT NULL,
        \`product_id\` bigint NOT NULL,
        \`sku\` varchar(50) NOT NULL,
        \`variant_name\` varchar(100),
        \`uom\` varchar(10),
        \`is_active\` boolean NOT NULL DEFAULT true,
        \`is_sellable\` boolean NOT NULL DEFAULT true,
        CONSTRAINT \`product_variants_id\` PRIMARY KEY(\`id\`),
        CONSTRAINT \`product_variants_sku_unique\` UNIQUE(\`sku\`)
      )`,

      // Barcodes table
      `CREATE TABLE IF NOT EXISTS \`barcodes\` (
        \`id\` bigint AUTO_INCREMENT NOT NULL,
        \`variant_id\` bigint NOT NULL,
        \`barcode\` varchar(50) NOT NULL,
        CONSTRAINT \`barcodes_id\` PRIMARY KEY(\`id\`)
      )`,

      // Product taxes table
      `CREATE TABLE IF NOT EXISTS \`product_taxes\` (
        \`id\` bigint AUTO_INCREMENT NOT NULL,
        \`variant_id\` bigint NOT NULL,
        \`tax_code\` varchar(20),
        \`is_inclusive\` boolean NOT NULL DEFAULT false,
        CONSTRAINT \`product_taxes_id\` PRIMARY KEY(\`id\`)
      )`,

      // Warehouses table
      `CREATE TABLE IF NOT EXISTS \`warehouses\` (
        \`id\` bigint AUTO_INCREMENT NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`address\` varchar(500),
        \`is_active\` boolean NOT NULL DEFAULT true,
        \`created_at\` timestamp NOT NULL DEFAULT (now()),
        \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`warehouses_id\` PRIMARY KEY(\`id\`)
      )`,

      // Inventory table
      `CREATE TABLE IF NOT EXISTS \`inventory\` (
        \`id\` bigint AUTO_INCREMENT NOT NULL,
        \`variant_id\` bigint NOT NULL,
        \`warehouse_id\` bigint NOT NULL,
        \`stock_qty\` decimal(12,2) NOT NULL DEFAULT '0',
        \`reserved_qty\` decimal(12,2) NOT NULL DEFAULT '0',
        \`min_stock\` decimal(12,2),
        \`max_stock\` decimal(12,2),
        \`created_at\` timestamp NOT NULL DEFAULT (now()),
        \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`inventory_id\` PRIMARY KEY(\`id\`)
      )`,

      // Product prices table
      `CREATE TABLE IF NOT EXISTS \`product_prices\` (
        \`id\` bigint AUTO_INCREMENT NOT NULL,
        \`variant_id\` bigint NOT NULL,
        \`price_type\` enum('retail','member','reseller') NOT NULL,
        \`price\` decimal(12,2) NOT NULL,
        \`start_date\` datetime,
        \`end_date\` datetime,
        CONSTRAINT \`product_prices_id\` PRIMARY KEY(\`id\`)
      )`,

      // Product costs table
      `CREATE TABLE IF NOT EXISTS \`product_costs\` (
        \`id\` bigint AUTO_INCREMENT NOT NULL,
        \`variant_id\` bigint NOT NULL,
        \`cost_price\` decimal(12,2),
        \`effective_date\` datetime,
        \`created_at\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`product_costs_id\` PRIMARY KEY(\`id\`)
      )`,

      // Product images table
      `CREATE TABLE IF NOT EXISTS \`product_images\` (
        \`id\` bigint AUTO_INCREMENT NOT NULL,
        \`variant_id\` bigint,
        \`image_url\` varchar(255),
        \`is_primary\` boolean NOT NULL DEFAULT false,
        CONSTRAINT \`product_images_id\` PRIMARY KEY(\`id\`)
      )`,

      // Variant attributes table
      `CREATE TABLE IF NOT EXISTS \`variant_attributes\` (
        \`id\` bigint AUTO_INCREMENT NOT NULL,
        \`variant_id\` bigint NOT NULL,
        \`attribute_name\` varchar(50),
        \`attribute_value\` varchar(50),
        CONSTRAINT \`variant_attributes_id\` PRIMARY KEY(\`id\`)
      )`
    ];

    for (const sql of tableSQLs) {
      await connection.execute(sql);
    }

    console.log('🔗 Adding foreign key constraints...');

    const constraintSQLs = [
      `ALTER TABLE \`sessions\` ADD CONSTRAINT \`sessions_user_id_users_id_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE \`product_variants\` ADD CONSTRAINT \`product_variants_product_id_products_product_id_fk\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`product_id\`) ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE \`barcodes\` ADD CONSTRAINT \`barcodes_variant_id_product_variants_id_fk\` FOREIGN KEY (\`variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE \`product_taxes\` ADD CONSTRAINT \`product_taxes_variant_id_product_variants_id_fk\` FOREIGN KEY (\`variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE \`inventory\` ADD CONSTRAINT \`inventory_variant_id_product_variants_id_fk\` FOREIGN KEY (\`variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE \`inventory\` ADD CONSTRAINT \`inventory_warehouse_id_warehouses_id_fk\` FOREIGN KEY (\`warehouse_id\`) REFERENCES \`warehouses\`(\`id\`) ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE \`product_prices\` ADD CONSTRAINT \`product_prices_variant_id_product_variants_id_fk\` FOREIGN KEY (\`variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE \`product_costs\` ADD CONSTRAINT \`product_costs_variant_id_product_variants_id_fk\` FOREIGN KEY (\`variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE \`product_images\` ADD CONSTRAINT \`product_images_variant_id_product_variants_id_fk\` FOREIGN KEY (\`variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE no action ON UPDATE no action`,
      `ALTER TABLE \`variant_attributes\` ADD CONSTRAINT \`variant_attributes_variant_id_product_variants_id_fk\` FOREIGN KEY (\`variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE no action ON UPDATE no action`
    ];

    for (const sql of constraintSQLs) {
      try {
        await connection.execute(sql);
      } catch (constraintError: any) {
        // Foreign key might already exist, ignore
        if (!constraintError.message.includes('already exists') && !constraintError.message.includes('Duplicate key')) {
          console.warn('Warning adding constraint:', constraintError.message);
        }
      }
    }

    console.log('✅ Database schema setup completed successfully!');

    // List tables
    const [tables] = await connection.execute('SHOW TABLES;');
    console.log('📊 Tables created:', tables);

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

await setupDatabase();