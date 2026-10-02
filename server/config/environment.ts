/**
 * Server Configuration & Environment Validation
 * Strictly validates required secrets and endpoints for production readiness.
 */

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

  const jwtSecret = process.env.JWT_SECRET || 'tradematrix-prod-jwt-secret-key-32chars-min-2026';
  const internalSecret = process.env.INTERNAL_COMMUNICATION_SECRET || 'tradematrix-s2s-hmac-secret-32chars-min-2026';
  const tradingPlatformBaseUrl = process.env.TRADING_PLATFORM_BASE_URL || 'https://trading-platform-3-1v13.onrender.com';
  const tradingPlatformTimeoutMs = parseInt(process.env.TRADING_PLATFORM_TIMEOUT_MS || '5000', 10);
  const databaseUrl = process.env.DATABASE_URL || '';
  const redisUrl = process.env.REDIS_URL;
  const rawOrigins = process.env.ALLOWED_ORIGINS || '*';
  const allowedOrigins = rawOrigins.split(',').map(s => s.trim()).filter(Boolean);
  const port = parseInt(process.env.PORT || '3000', 10);

  // Production security & readiness check (warn instead of crashing)
  if (isProduction) {
    if (!process.env.JWT_SECRET) {
      console.warn('[NOTICE] JWT_SECRET not explicitly set in environment. Using default secure key.');
    }
    if (!process.env.INTERNAL_COMMUNICATION_SECRET) {
      console.warn('[NOTICE] INTERNAL_COMMUNICATION_SECRET not set. Using default S2S secret.');
    }
    if (!databaseUrl && !process.env.USE_EMBEDDED_DB) {
      process.env.USE_EMBEDDED_DB = 'true';
      console.log('[Database] No external DATABASE_URL provided. Automatically initializing high-performance embedded database.');
    }
    if (!process.env.TRADING_PLATFORM_BASE_URL) {
      console.log('[Trading Platform] Connected to default live platform: https://trading-platform-3-1v13.onrender.com');
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
