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
  userPanelBaseUrl: string;
  tradingPlatformTimeoutMs: number;
  allowedOrigins: string[];
  isProduction: boolean;
  isTest: boolean;
  port: number;
}

export const DEFAULT_TRADING_PLATFORM_URL = 'https://trading-platform-2t6r.onrender.com';
export const DEFAULT_USER_PANEL_URL = 'https://user-panel-dashbord-ofrt.onrender.com';

export function validateAndLoadConfig(): AppConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  const jwtSecret = process.env.JWT_SECRET || 'Jt9#vQ7!mX2akL8SzP4&nR6*fhgjg8eerrnm';
  const internalSecret = process.env.INTERNAL_COMMUNICATION_SECRET || process.env.INTERNAL_API_SECRET || process.env.CENTRAL_ADMIN_INTERNAL_SECRET || 'nextrade-internal-hmac-secret-2026';

  const rawTradingPlatformUrl = process.env.TRADING_PLATFORM_URL || process.env.TRADING_PLATFORM_BASE_URL || DEFAULT_TRADING_PLATFORM_URL;
  const tradingPlatformBaseUrl = (rawTradingPlatformUrl.trim() || DEFAULT_TRADING_PLATFORM_URL).replace(/\/+$/, '');

  const rawUserPanelUrl = process.env.USER_PANEL_URL || process.env.USER_PANEL_BASE_URL || DEFAULT_USER_PANEL_URL;
  const userPanelBaseUrl = (rawUserPanelUrl.trim() || DEFAULT_USER_PANEL_URL).replace(/\/+$/, '');
  const tradingPlatformTimeoutMs = parseInt(process.env.TRADING_PLATFORM_TIMEOUT_MS || '10000', 10);
  const databaseUrl = process.env.DATABASE_URL || '';
  const redisUrl = process.env.REDIS_URL;
  const rawOrigins = process.env.ALLOWED_ORIGINS || (isProduction ? 'https://trading-platform-2t6r.onrender.com,https://user-panel-dashbord-ofrt.onrender.com,https://admin-dashbord-wxcq.onrender.com' : '*');
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
    if ((!process.env.INTERNAL_COMMUNICATION_SECRET && !process.env.INTERNAL_API_SECRET) || internalSecret.length < 32) {
      throw new Error('INTERNAL_COMMUNICATION_SECRET environment variable is required in production (minimum 32 characters).');
    }
  }

  return {
    databaseUrl,
    redisUrl,
    jwtSecret,
    internalCommunicationSecret: internalSecret,
    tradingPlatformBaseUrl,
    userPanelBaseUrl,
    tradingPlatformTimeoutMs,
    allowedOrigins,
    isProduction,
    isTest,
    port
  };
}

export const appConfig = validateAndLoadConfig();
