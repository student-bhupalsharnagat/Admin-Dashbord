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

  const jwtSecret = process.env.JWT_SECRET || (isProduction ? '' : 'dev-jwt-secret-key-32chars-min-tradematrix-2026');
  const internalSecret = process.env.INTERNAL_COMMUNICATION_SECRET || (isProduction ? '' : 'dev-internal-s2s-secret-32chars-tradematrix');
  const tradingPlatformBaseUrl = process.env.TRADING_PLATFORM_BASE_URL || 'http://localhost:3001';
  const tradingPlatformTimeoutMs = parseInt(process.env.TRADING_PLATFORM_TIMEOUT_MS || '5000', 10);
  const databaseUrl = process.env.DATABASE_URL || '';
  const redisUrl = process.env.REDIS_URL;
  const rawOrigins = process.env.ALLOWED_ORIGINS || (isProduction ? '' : '*');
  const allowedOrigins = rawOrigins.split(',').map(s => s.trim()).filter(Boolean);
  const port = parseInt(process.env.PORT || '3000', 10);

  // Production security validations
  if (isProduction) {
    if (process.env.ALLOWED_ORIGINS === '*' || allowedOrigins.includes('*') || rawOrigins === '*') {
      const errorMsg = '[Configuration Error] ALLOWED_ORIGINS cannot be "*" in production. Explicit trusted origins are required.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    const missing: string[] = [];
    if (!jwtSecret || jwtSecret.length < 32) {
      missing.push('JWT_SECRET (must be at least 32 characters)');
    }
    if (!internalSecret || internalSecret.length < 32) {
      missing.push('INTERNAL_COMMUNICATION_SECRET (must be at least 32 characters)');
    }
    if (!databaseUrl && !process.env.USE_EMBEDDED_DB) {
      missing.push('DATABASE_URL');
    }
    if (!process.env.TRADING_PLATFORM_BASE_URL) {
      missing.push('TRADING_PLATFORM_BASE_URL');
    }

    if (missing.length > 0) {
      const errorMsg = `[Configuration Error] Missing or insecure required production environment variables:\n - ${missing.join('\n - ')}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
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
