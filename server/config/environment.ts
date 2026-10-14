/**
 * Server Configuration & Environment Validation
 * Strictly validates required secrets and endpoints for production readiness.
 */
import 'dotenv/config';

export interface AppConfig {
  databaseUrl: string;
  redisUrl?: string;
  jwtSecret: string;
  internalCommunicationSecret: string;
  tradingPlatformBaseUrl: string;
  tradingPlatformTimeoutMs: number;
  allowedOrigins: string[];
  isProduction: boolean;
  isTest: boolean;
  port: number;
}

export function validateAndLoadConfig(): AppConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  const jwtSecret = process.env.JWT_SECRET || 'Jt9#vQ7!mX2akL8SzP4&nR6*fhgjg8eerrnm';
  const internalSecret = process.env.INTERNAL_COMMUNICATION_SECRET || 'Tr@dingS2S#2026!Kp8$Xm4&Qr7r7484';
  const tradingPlatformBaseUrl = process.env.TRADING_PLATFORM_BASE_URL || 'https://trading-platform-3-1v13.onrender.com';
  const tradingPlatformTimeoutMs = parseInt(process.env.TRADING_PLATFORM_TIMEOUT_MS || '5000', 10);
  const databaseUrl = process.env.DATABASE_URL || '';
  const redisUrl = process.env.REDIS_URL;
  const rawOrigins = process.env.ALLOWED_ORIGINS || (isProduction ? '' : '*');
  const allowedOrigins = rawOrigins.split(',').map(s => s.trim()).filter(Boolean);
  const port = parseInt(process.env.PORT || '3000', 10);

  // Production security & readiness validation
  if (isProduction) {
    if (rawOrigins === '*' || allowedOrigins.includes('*')) {
      throw new Error('ALLOWED_ORIGINS cannot be "*" in production mode. Explicit allowed origins are required.');
    }
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required in production.');
    }
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET environment variable is required in production (minimum 32 characters).');
    }
    if (!process.env.INTERNAL_COMMUNICATION_SECRET || process.env.INTERNAL_COMMUNICATION_SECRET.length < 32) {
      throw new Error('INTERNAL_COMMUNICATION_SECRET environment variable is required in production (minimum 32 characters).');
    }
  }

  return {
    databaseUrl,
    redisUrl,
    jwtSecret,
    internalCommunicationSecret: internalSecret,
    tradingPlatformBaseUrl,
    tradingPlatformTimeoutMs,
    allowedOrigins,
    isProduction,
    isTest,
    port
  };
}

export const appConfig = validateAndLoadConfig();
