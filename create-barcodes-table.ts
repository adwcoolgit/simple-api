import mysql from 'mysql2/promise';

async function ensureBarcodesTable() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'simple_api',
      port: parseInt(process.env.DB_PORT || '3306'),
    });

    // Check if table exists
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'barcodes'"
    );

    if ((tables as any[]).length === 0) {
      console.log('Creating barcodes table...');

      // Create table
      await connection.execute(`
        CREATE TABLE \`barcodes\` (
          \`id\` bigint AUTO_INCREMENT NOT NULL,
          \`variant_id\` bigint NOT NULL,
          \`barcode\` varchar(50) NOT NULL,
          CONSTRAINT \`barcodes_id\` PRIMARY KEY(\`id\`)
        )
      `);

      // Add foreign key
      await connection.execute(`
        ALTER TABLE \`barcodes\` ADD CONSTRAINT \`barcodes_variant_id_product_variants_id_fk\`
        FOREIGN KEY (\`variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE no action ON UPDATE no action
      `);

      console.log('Barcodes table created successfully');
    } else {
      console.log('Barcodes table already exists');
    }

    await connection.end();
  } catch (error) {
    console.error('Error ensuring barcodes table:', error);
  }
}

await ensureBarcodesTable();