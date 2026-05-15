import mysql from 'mysql2/promise';

let dbAvailable: boolean | null = null;

/**
 * Check if the database is available and can be connected to
 */
export async function isDbAvailable(): Promise<boolean> {
  if (dbAvailable !== null) {
    return dbAvailable;
  }

  try {
    // Try to connect with different host options
    let testConnection;
    const hosts = ['localhost', '127.0.0.1'];
    let connected = false;

    for (const host of hosts) {
      try {
        testConnection = await mysql.createConnection({
          host: host,
          user: Bun.env.DB_USER || 'root',
          password: Bun.env.DB_PASSWORD || '',
          database: Bun.env.DB_NAME || 'simple_api',
          port: parseInt(Bun.env.DB_PORT || '3306'),
          connectTimeout: 5000,
        });

        // Test the connection with a simple query
        await testConnection.execute('SELECT 1');
        connected = true;
        break;
      } catch (hostError) {
        if (testConnection) {
          try {
            await testConnection.end();
          } catch {}
        }
      }
    }

    if (!connected) {
      dbAvailable = false;
      return false;
    }

    await testConnection!.end();
    dbAvailable = true;
    return true;
  } catch (error) {
    dbAvailable = false;
    return false;
  }
}