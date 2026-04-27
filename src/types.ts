// API Response Types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

export interface LoginResponse {
  token: string;
}

export interface RegisterResponse {
  message: string;
}

// Environment Configuration
export interface EnvConfig {
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  PORT: number;
}

export function validateEnv(): EnvConfig {
  const config = {
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: parseInt(process.env.DB_PORT || '3306'),
    DB_NAME: process.env.DB_NAME || 'simple_api',
    DB_USER: process.env.DB_USER || 'root',
    DB_PASSWORD: process.env.DB_PASSWORD || '',
    PORT: parseInt(process.env.PORT || '3000'),
  };

  // Validate required environment variables
  if (!config.DB_USER) {
    throw new Error('DB_USER environment variable is required');
  }

  if (config.DB_PORT < 1 || config.DB_PORT > 65535) {
    throw new Error('DB_PORT must be between 1 and 65535');
  }

  if (config.PORT < 1 || config.PORT > 65535) {
    throw new Error('PORT must be between 1 and 65535');
  }

  return config;
}
