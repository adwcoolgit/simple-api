import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const connection = mysql.createPool({
  host: Bun.env.DB_HOST || 'localhost',
  user: Bun.env.DB_USER || 'root',
  password: Bun.env.DB_PASSWORD || '',
  database: Bun.env.DB_NAME || 'simple_api',
  port: parseInt(Bun.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const db = drizzle(connection);
