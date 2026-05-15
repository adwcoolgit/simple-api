import mysql from 'mysql2/promise';

// Set test environment
process.env.DB_NAME = 'simple_api';

// Set environment to skip Redis for tests
process.env.REDIS_HOST = '';
process.env.REDIS_PORT = '';

// Setup test database
async function setupTestDatabase() {
  console.log('Checking database connection...');

  try {
    // Try to connect with different host options
    let testConnection;
    const hosts = ['localhost', '127.0.0.1'];
    let connected = false;

    for (const host of hosts) {
      try {
        console.log(`Trying to connect to MySQL at ${host}:3306...`);
        testConnection = await mysql.createConnection({
          host: host,
          user: Bun.env.DB_USER || 'root',
          password: Bun.env.DB_PASSWORD || '',
          database: 'simple_api',
          port: parseInt(Bun.env.DB_PORT || '3306'),
          connectTimeout: 5000,
        });

        // Test the connection with a simple query
        await testConnection.execute('SELECT 1');
        console.log(`Connected to MySQL at ${host}:3306`);
        connected = true;
        break;
      } catch (hostError) {
        console.log(`Failed to connect to ${host}:3306`);
        if (testConnection) {
          try {
            await testConnection.end();
          } catch {}
        }
      }
    }

    if (!connected) {
      throw new Error('Could not connect to MySQL on any host');
    }

    // Ensure barcodes table exists using the same connection
    try {
      await testConnection!.execute(`
        CREATE TABLE IF NOT EXISTS \`barcodes\` (
          \`id\` bigint AUTO_INCREMENT NOT NULL,
          \`variant_id\` bigint NOT NULL,
          \`barcode\` varchar(50) NOT NULL,
          CONSTRAINT \`barcodes_id\` PRIMARY KEY(\`id\`)
        )
      `);

      // Add foreign key constraint
      try {
        await testConnection!.execute(`
          ALTER TABLE \`barcodes\` ADD CONSTRAINT \`barcodes_variant_id_product_variants_id_fk\`
          FOREIGN KEY (\`variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE no action ON UPDATE no action
        `);
      } catch (fkError: any) {
        // Foreign key might already exist, ignore
        if (!fkError.message.includes('already exists')) {
          console.warn('Warning adding foreign key:', fkError.message);
        }
      }

      console.log('Barcodes table ensured');
    } catch (tableError: any) {
      console.warn('Warning creating barcodes table:', tableError.message);
    }

    await testConnection!.end();
    console.log('Test database connection verified');
  } catch (error) {
    console.error(
      'Database connection failed:',
      error instanceof Error ? error.message : String(error)
    );
    console.error('Make sure MySQL is running on localhost:3306');
    console.error('Default credentials: root / (empty password)');
    console.error('Or set DB_HOST, DB_USER, DB_PASSWORD environment variables');

    // Don't exit - allow tests to run in mock mode or skip database tests
    console.log('Continuing with tests that may not require database...');
  }
}

// Run setup before tests
await setupTestDatabase();

// Mocks commented out due to TypeScript issues
// mock('ioredis', { ... });
// mock('../src/middleware/rate-limit', { ... });
