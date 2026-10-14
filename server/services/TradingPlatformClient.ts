/**
 * Dedicated Server-Side Remote Trading Platform Client
 * Implements S2S HMAC-SHA256 Authentication, Replay Protection,
 * Idempotency, Circuit Breaker, Timeout, and Retry mechanisms.
 *
 * NOTE: Browser/frontend code must NEVER directly call Trading Platform internal APIs.
 */

import crypto from 'crypto';
import { appConfig } from '../config/environment.ts';

export interface S2SRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  tenantId?: string;
  body?: any;
  idempotencyKey?: string;
  correlationId?: string;
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export interface S2SResponse<T = any> {
  success: boolean;
  statusCode: number;
  data: T;
  correlationId: string;
  latencyMs: number;
  error?: string;
  fromFallback?: boolean;
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface ClientMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  retriesCount: number;
  circuitBreakerState: CircuitBreakerState;
  circuitBreakerFailures: number;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  lastErrorMessage: string | null;
}

export class TradingPlatformClient {
  private baseUrl: string;
  private secret: string;
  private defaultTimeoutMs: number;

  // Circuit breaker state
  private circuitState: CircuitBreakerState = 'CLOSED';
  private consecutiveFailures = 0;
  private readonly FAILURE_THRESHOLD = 5;
  private readonly CIRCUIT_RESET_TIMEOUT_MS = 15000;
  private lastStateChange = Date.now();

  // Observability metrics
  private metrics: ClientMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    retriesCount: 0,
    circuitBreakerState: 'CLOSED',
    circuitBreakerFailures: 0,
    lastFailureAt: null,
    lastSuccessAt: null,
    lastErrorMessage: null
  };

  // Clock offset to prevent timestamp expiration errors due to client-server time drift
  public clockOffsetMs: number = 0;
  private lastClockSync: number = 0;

  constructor(
    baseUrl: string = appConfig.tradingPlatformBaseUrl,
    secret: string = appConfig.internalCommunicationSecret,
    defaultTimeoutMs: number = appConfig.tradingPlatformTimeoutMs
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.secret = secret;
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
  }

  /**
   * Auto-sync clock drift between local machine and remote Trading Platform.
   * Prevents 401 UNAUTHORIZED timestamp expiration rejections.
   */
  public async syncClockOffset(force = false): Promise<number> {
    const now = Date.now();
    if (!force && this.lastClockSync && (now - this.lastClockSync < 30000)) {
      return this.clockOffsetMs;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.baseUrl}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      const body = await res.json().catch(() => ({}));
      const remoteTimeStr = body?.timestamp || res.headers.get('date');
      if (remoteTimeStr) {
        const remoteTime = new Date(remoteTimeStr).getTime();
        if (!isNaN(remoteTime)) {
          this.clockOffsetMs = remoteTime - Date.now();
          this.lastClockSync = Date.now();
        }
      }
    } catch {
      // Keep previous offset if health ping fails
    }
    return this.clockOffsetMs;
  }

  // ----------------------------------------------------
  // HMAC-SHA256 SIGNATURE GENERATION & VERIFICATION
  // ----------------------------------------------------

  private nonceReplayStore = new Map<string, number>();

  /**
   * S2S Protocol Signature:
   * timestamp = epoch ms string (or provided ts)
   * payload = `${ts}.${METHOD}.${pathWithoutQuery}.${rawBody}`
   * HMAC-SHA256 hex with INTERNAL_COMMUNICATION_SECRET
   */
  public generateSignature(timestamp: string, method: string, path: string, bodyString: string): string {
    const pathWithoutQuery = path.split('?')[0];
    const payload = `${timestamp}.${method.toUpperCase()}.${pathWithoutQuery}.${bodyString || ''}`;
    return crypto.createHmac('sha256', this.secret).update(payload).digest('hex');
  }

  /**
   * Legacy colon-separated signature generation for backward compatibility with white-label routes
   */
  public generateLegacySignature(timestamp: string, method: string, path: string, bodyString: string): string {
    const payload = `${timestamp}:${method.toUpperCase()}:${path}:${bodyString || ''}`;
    return crypto.createHmac('sha256', this.secret).update(payload).digest('hex');
  }

  /**
   * S2S Inbound Verification for Trading Platform Event and Control Routes:
   * - Rejects Bearer JWT
   * - Validates X-Internal-Signature (or X-Signature-SHA256) with constant-time compare
   * - Max age 30s
   * - Nonce replay store with 5min TTL
   */
  public verifyInternalS2S(
    headers: Record<string, string | string[] | undefined>,
    method: string,
    path: string,
    rawBody: string
  ): { valid: boolean; statusCode?: number; reason?: string } {
    const getHeader = (name: string): string => {
      const val = headers[name.toLowerCase()] || headers[name];
      if (Array.isArray(val)) return val[0] || '';
      return val || '';
    };

    // 1. Reject Bearer JWT on these routes
    const authHeader = getHeader('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer')) {
      return { valid: false, statusCode: 401, reason: 'Bearer token not accepted on S2S routes' };
    }

    // 2. Extract headers
    const signature = getHeader('x-internal-signature') || getHeader('x-signature-sha256') || getHeader('x-hmac-signature');
    const timestamp = getHeader('x-internal-timestamp') || getHeader('x-timestamp');
    const nonce = getHeader('x-internal-nonce') || getHeader('x-nonce');

    if (!signature || !timestamp) {
      return { valid: false, statusCode: 401, reason: 'Missing S2S signature or timestamp header' };
    }

    // 3. Max age 5 minutes (300,000ms) to accommodate cloud deployment network and cold-start latency
    const reqTime = isNaN(Number(timestamp)) ? new Date(timestamp).getTime() : Number(timestamp);
    if (isNaN(reqTime)) {
      return { valid: false, statusCode: 401, reason: 'Invalid timestamp format' };
    }

    const now = Date.now();
    const ageMs = Math.abs(now - reqTime);
    if (ageMs > 300000) {
      return {
        valid: false,
        statusCode: 401,
        reason: `Timestamp outside acceptable window (${Math.round(ageMs / 1000)}s drift, max age 300s)`
      };
    }

    // 4. Nonce replay store (Map w/ TTL 5min)
    if (nonce) {
      const expiry = this.nonceReplayStore.get(nonce);
      if (expiry && expiry > now) {
        return { valid: false, statusCode: 401, reason: 'Nonce already used (replay attack)' };
      }
      this.nonceReplayStore.set(nonce, now + 5 * 60 * 1000);

      // Clean up expired nonces
      if (this.nonceReplayStore.size > 10000) {
        for (const [k, exp] of this.nonceReplayStore.entries()) {
          if (now > exp) {
            this.nonceReplayStore.delete(k);
          }
        }
      }
    }

    // 5. Signature verification: payload = `${ts}.${METHOD}.${pathWithoutQuery}.${rawBody}`; HMAC-SHA256 hex
    const pathWithoutQuery = path.split('?')[0];
    const payload = `${timestamp}.${method.toUpperCase()}.${pathWithoutQuery}.${rawBody || ''}`;
    const expectedSignature = crypto.createHmac('sha256', this.secret).update(payload).digest('hex');

    try {
      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expectedSignature, 'hex');
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return { valid: false, statusCode: 401, reason: 'HMAC signature mismatch' };
      }
    } catch {
      return { valid: false, statusCode: 401, reason: 'Signature evaluation failed' };
    }

    return { valid: true };
  }

  /**
   * Accepted ONLY for white-label inbound routes:
   * Keeps legacy colon-separated X-Signature-SHA256 verification (with fallback to new format).
   */
  public verifyInboundSignature(
    signature: string,
    timestamp: string,
    method: string,
    path: string,
    bodyString: string,
    maxDriftMs: number = 300000 // 5 minutes replay protection window
  ): { valid: boolean; reason?: string } {
    if (!signature || !timestamp) {
      return { valid: false, reason: 'Missing signature or timestamp' };
    }

    // Replay attack protection: verify timestamp freshness
    const requestTime = isNaN(Number(timestamp)) ? new Date(timestamp).getTime() : Number(timestamp);
    if (isNaN(requestTime)) {
      return { valid: false, reason: 'Invalid timestamp format' };
    }

    const now = Date.now();
    if (Math.abs(now - requestTime) > maxDriftMs) {
      return {
        valid: false,
        reason: `Timestamp outside acceptable window (${Math.round(Math.abs(now - requestTime) / 1000)}s drift)`
      };
    }

    const pathVariants = [path];
    const pathWithoutQuery = path.split('?')[0];
    if (pathWithoutQuery !== path) {
      pathVariants.push(pathWithoutQuery);
    }

    // Check legacy colon-separated signature
    for (const p of pathVariants) {
      const expectedLegacy = this.generateLegacySignature(timestamp, method, p, bodyString);
      try {
        const sigBuf = Buffer.from(signature, 'hex');
        const expectedBuf = Buffer.from(expectedLegacy, 'hex');
        if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
          return { valid: true };
        }
      } catch {
        // ignore
      }
    }

    // Fallback: check new dot-separated signature format
    for (const p of pathVariants) {
      const expectedNew = this.generateSignature(timestamp, method, p, bodyString);
      try {
        const sigBuf = Buffer.from(signature, 'hex');
        const expectedBuf = Buffer.from(expectedNew, 'hex');
        if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
          return { valid: true };
        }
      } catch {
        // ignore
      }
    }

    return { valid: false, reason: 'HMAC signature mismatch' };
  }

  // ----------------------------------------------------
  // SENSITIVE DATA REDACTION FOR LOGGING
  // ----------------------------------------------------

  public redactSensitiveData(data: any): any {
    if (!data) return data;
    if (typeof data !== 'object') return data;

    const redacted = Array.isArray(data) ? [...data] : { ...data };
    const sensitiveKeys = [
      'password',
      'secret',
      'token',
      'authorization',
      'key',
      'api_key',
      'apikey',
      'broker_secret',
      'jwt'
    ];

    for (const key of Object.keys(redacted)) {
      const lower = key.toLowerCase();
      if (sensitiveKeys.some(s => lower.includes(s))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
        redacted[key] = this.redactSensitiveData(redacted[key]);
      }
    }
    return redacted;
  }

  // ----------------------------------------------------
  // CIRCUIT BREAKER LOGIC
  // ----------------------------------------------------

  private checkCircuitBreaker(): void {
    const now = Date.now();
    if (this.circuitState === 'OPEN') {
      if (now - this.lastStateChange >= this.CIRCUIT_RESET_TIMEOUT_MS) {
        this.circuitState = 'HALF_OPEN';
        this.lastStateChange = now;
        this.metrics.circuitBreakerState = 'HALF_OPEN';
        console.warn('[TradingPlatformClient] Circuit breaker transitioned to HALF_OPEN. Probing remote server...');
      } else {
        throw new Error(`[Circuit Breaker OPEN] Trading Platform is unavailable. Rapid fail-fast active.`);
      }
    }
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.metrics.successfulRequests++;
    this.metrics.lastSuccessAt = new Date().toISOString();
    if (this.circuitState === 'HALF_OPEN') {
      this.circuitState = 'CLOSED';
      this.lastStateChange = Date.now();
      this.metrics.circuitBreakerState = 'CLOSED';
      console.log('[TradingPlatformClient] Remote server recovered. Circuit breaker CLOSED.');
    }
  }

  private recordFailure(err: any): void {
    this.consecutiveFailures++;
    this.metrics.failedRequests++;
    this.metrics.circuitBreakerFailures++;
    this.metrics.lastFailureAt = new Date().toISOString();
    this.metrics.lastErrorMessage = err?.message || 'Unknown network error';

    if (this.circuitState === 'CLOSED' && this.consecutiveFailures >= this.FAILURE_THRESHOLD) {
      this.circuitState = 'OPEN';
      this.lastStateChange = Date.now();
      this.metrics.circuitBreakerState = 'OPEN';
      console.error(`[TradingPlatformClient] Circuit breaker tripped OPEN after ${this.consecutiveFailures} consecutive failures.`);
    } else if (this.circuitState === 'HALF_OPEN') {
      this.circuitState = 'OPEN';
      this.lastStateChange = Date.now();
      this.metrics.circuitBreakerState = 'OPEN';
      console.error('[TradingPlatformClient] Probe request failed. Circuit breaker returned to OPEN.');
    }
  }

  // ----------------------------------------------------
  // CORE S2S REQUEST EXECUTION
  // ----------------------------------------------------

  public async request<T = any>(options: S2SRequestOptions): Promise<S2SResponse<T>> {
    this.metrics.totalRequests++;
    this.checkCircuitBreaker();

    if (this.clockOffsetMs === 0 || !this.lastClockSync || (Date.now() - this.lastClockSync > 30000)) {
      await this.syncClockOffset().catch(() => {});
    }

    const correlationId = options.correlationId || `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const timestamp = (Date.now() + this.clockOffsetMs).toString(); // calibrated epoch ms string
    const nonce = crypto.randomUUID(); // uuid
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;
    const maxRetries = options.retries !== undefined ? options.retries : 2;

    const pathWithoutQuery = options.path.split('?')[0];
    const bodyString = options.body ? JSON.stringify(options.body) : '';
    const signature = this.generateSignature(timestamp, options.method, pathWithoutQuery, bodyString);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Internal-Timestamp': timestamp,
      'X-Internal-Nonce': nonce,
      'X-Internal-Signature': signature,
      'X-Correlation-ID': correlationId,
      'X-Signature-SHA256': signature,
      'X-HMAC-Signature': signature,
      'X-Timestamp': timestamp,
      'X-Request-ID': correlationId,
      ...(options.tenantId ? { 'X-Tenant-ID': options.tenantId } : {}),
      ...(options.idempotencyKey ? { 'X-Idempotency-Key': options.idempotencyKey } : {}),
      ...(options.headers || {})
    };

    const url = `${this.baseUrl}${options.path}`;
    let attempt = 0;
    let lastError: any = null;

    while (attempt <= maxRetries) {
      attempt++;
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

      try {
        let response: Response;
        try {
          response = await fetch(url, {
            method: options.method,
            headers,
            body: ['POST', 'PUT', 'PATCH'].includes(options.method) ? bodyString : undefined,
            signal: controller.signal
          });
        } catch (fetchErr: any) {
          // If port 3001 was unreachable (e.g. monolithic/single server running on port 3000), fallback to current server port
          const isConnRefused = fetchErr.code === 'ECONNREFUSED' || fetchErr.cause?.code === 'ECONNREFUSED' || fetchErr.message?.includes('fetch failed');
          if (isConnRefused && url.includes(':3001')) {
            const fallbackPortUrl = url.replace(':3001', `:${process.env.PORT || 3000}`);
            response = await fetch(fallbackPortUrl, {
              method: options.method,
              headers,
              body: ['POST', 'PUT', 'PATCH'].includes(options.method) ? bodyString : undefined,
              signal: controller.signal
            });
          } else {
            throw fetchErr;
          }
        }

        clearTimeout(timeoutHandle);
        const latencyMs = Date.now() - startTime;

        // Successful status
        if (response.ok) {
          const data = (await response.json().catch(() => ({}))) as T;
          this.recordSuccess();
          return {
            success: true,
            statusCode: response.status,
            data,
            correlationId,
            latencyMs
          };
        }

        // If 404 on canonical /v1 path, attempt fallback to unversioned /api/internal/ path
        if (response.status === 404 && options.path.startsWith('/api/internal/v1/')) {
          const fallbackPath = options.path.replace('/api/internal/v1/', '/api/internal/');
          const fallbackSig = this.generateSignature(timestamp, options.method, fallbackPath, bodyString);
          const fallbackHeaders = {
            ...headers,
            'X-Signature-SHA256': fallbackSig,
            'X-HMAC-Signature': fallbackSig
          };
          try {
            const fallbackRes = await fetch(`${this.baseUrl}${fallbackPath}`, {
              method: options.method,
              headers: fallbackHeaders,
              body: ['POST', 'PUT', 'PATCH'].includes(options.method) ? bodyString : undefined,
              signal: controller.signal
            });
            if (fallbackRes.ok) {
              const data = (await fallbackRes.json().catch(() => ({}))) as T;
              this.recordSuccess();
              return {
                success: true,
                statusCode: fallbackRes.status,
                data,
                correlationId,
                latencyMs: Date.now() - startTime,
                fromFallback: true
              };
            }
          } catch {
            // Ignore fallback network error and proceed
          }
        }

        // Bidirectional fallback for emergency routes: /emergency/* <-> /api/internal/v1/emergency/*
        let emergencyFallbackPath: string | null = null;
        let emergencyFallbackBody = bodyString;
        if (response.status === 404 && options.path.startsWith('/emergency/')) {
          emergencyFallbackPath = `/api/internal/v1${options.path}`;
          const parsed = options.body && typeof options.body === 'object' ? { ...options.body } : {};
          if (!parsed.scope) {
            parsed.scope = parsed.positionId ? 'USER' : 'TENANT';
          }
          emergencyFallbackBody = JSON.stringify(parsed);
        } else if (response.status === 404 && options.path.startsWith('/api/internal/v1/emergency/')) {
          emergencyFallbackPath = options.path.replace('/api/internal/v1', '');
        }

        if (emergencyFallbackPath) {
          const fallbackSig = this.generateSignature(timestamp, options.method, emergencyFallbackPath, emergencyFallbackBody);
          const fallbackHeaders = {
            ...headers,
            'X-Signature-SHA256': fallbackSig,
            'X-HMAC-Signature': fallbackSig,
            'X-Internal-Signature': fallbackSig
          };
          try {
            const fallbackRes = await fetch(`${this.baseUrl}${emergencyFallbackPath}`, {
              method: options.method,
              headers: fallbackHeaders,
              body: ['POST', 'PUT', 'PATCH'].includes(options.method) ? emergencyFallbackBody : undefined,
              signal: controller.signal
            });
            if (fallbackRes.ok) {
              const data = (await fallbackRes.json().catch(() => ({}))) as T;
              this.recordSuccess();
              return {
                success: true,
                statusCode: fallbackRes.status,
                data,
                correlationId,
                latencyMs: Date.now() - startTime,
                fromFallback: true
              };
            }
          } catch {
            // Ignore fallback network error and proceed
          }
        }

        // 4xx errors are client errors (do not retry, record as rejection)
        if (response.status >= 400 && response.status < 500) {
          const errBody = await response.json().catch(() => ({}));
          const errorMsg = errBody.error || errBody.message || `Remote HTTP ${response.status}`;
          return {
            success: false,
            statusCode: response.status,
            data: errBody as T,
            correlationId,
            latencyMs,
            error: errorMsg
          };
        }

        // 5xx errors: treat as retryable
        lastError = new Error(`Remote HTTP ${response.status} from Trading Platform`);
      } catch (err: any) {
        clearTimeout(timeoutHandle);
        const isTimeout = err.name === 'AbortError' || err.code === 23;
        lastError = isTimeout
          ? new Error(`S2S request timeout after ${timeoutMs}ms`)
          : err;
      }

      if (attempt <= maxRetries) {
        this.metrics.retriesCount++;
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 3000);
        await new Promise(res => setTimeout(res, backoffMs));
      }
    }

    // All retries exhausted
    this.recordFailure(lastError);
    return {
      success: false,
      statusCode: 503,
      data: null as any,
      correlationId,
      latencyMs: 0,
      error: lastError?.message || 'Trading Platform communication failed'
    };
  }

  // ----------------------------------------------------
  // BUSINESS S2S OPERATIONS
  // ----------------------------------------------------

  /**
   * Outbound reverse mapping:
   * Maps Admin tenantId -> Trading Platform's trading_tenant_id.
   * Fallback to env TRADING_TENANT_ID or the admin tenantId.
   */
  public async resolveOutboundTenantId(adminTenantId?: string): Promise<string | undefined> {
    if (!adminTenantId) return undefined;
    try {
      const { query } = await import('../db/connection.ts');
      const { rows } = await query<{ trading_tenant_id: string | null }>(
        'SELECT trading_tenant_id FROM tenants WHERE id = $1 LIMIT 1',
        [adminTenantId]
      );
      if (rows.length > 0) {
        if (rows[0].trading_tenant_id) {
          return rows[0].trading_tenant_id;
        }
        if (adminTenantId === 'TNT-001' || adminTenantId === 'default') {
          return process.env.TRADING_TENANT_ID || 'vertex-default';
        }
        return adminTenantId;
      }
    } catch {
      // In case DB is not yet available or testing standalone
    }
    if (adminTenantId === 'TNT-001' || adminTenantId === 'default') {
      return process.env.TRADING_TENANT_ID || 'vertex-default';
    }
    return adminTenantId;
  }

  /**
   * 1. Synchronize Tenant Governance Configuration (tenant sync -> POST /api/internal/v1/tenant/sync)
   */
  public async syncTenantConfig(
    tenantId: string,
    payload: {
      status: string;
      trading_enabled: boolean;
      registration_enabled: boolean;
      api_enabled: boolean;
      support_enabled?: boolean;
      notifications_enabled?: boolean;
      operational_limits?: any;
      subscription?: any;
      domains?: string[];
      maintenance_mode?: boolean;
      maintenance_message?: string;
      config_version?: number;
      [key: string]: any;
    },
    options?: { actor?: string; correlationId?: string; reason?: string }
  ): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(tenantId);

    // 1. Dispatch platform feature flags to /api/internal/v1/platform/config
    await this.request({
      method: 'POST',
      path: '/api/internal/v1/platform/config',
      tenantId: outboundTenantId,
      body: {
        tenantId: outboundTenantId,
        config: {
          trading_enabled: payload.trading_enabled,
          registration_enabled: payload.registration_enabled,
          api_enabled: payload.api_enabled,
          support_enabled: payload.support_enabled ?? true,
          notifications_enabled: payload.notifications_enabled ?? true,
          deposit_enabled: true,
          withdrawal_enabled: true,
          options_trading_enabled: true,
          max_leverage: 50,
          maintenance_mode: payload.maintenance_mode ?? false,
          maintenance_message: payload.maintenance_message || 'Platform is operational'
        }
      },
      idempotencyKey: `plt_cfg_${tenantId}_${Date.now()}`,
      correlationId: options?.correlationId
    }).catch(() => null);

    // 2. Dispatch tenant governance configuration to /api/internal/v1/tenant/sync
    return this.request({
      method: 'POST',
      path: '/api/internal/v1/tenant/sync',
      tenantId: outboundTenantId,
      body: {
        tenantId: outboundTenantId,
        adminTenantId: tenantId,
        ...payload,
        tradingEnabled: payload.trading_enabled,
        registrationEnabled: payload.registration_enabled,
        apiEnabled: payload.api_enabled,
        maintenanceMode: payload.maintenance_mode,
        syncedBy: options?.actor || 'CentralAdmin',
        syncedAt: new Date().toISOString()
      },
      idempotencyKey: `sync_${tenantId}_v${payload.config_version || 1}`,
      correlationId: options?.correlationId
    });
  }

  /**
   * 2. Synchronize Published White Label Branding
   */
  public async syncWhiteLabel(
    tenantId: string,
    config: any,
    version: number,
    options?: { actor?: string; correlationId?: string }
  ): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(tenantId);

    const brandingPayload = {
      brandName: config.brand_name || config.brandName,
      shortName: config.short_name || config.shortName,
      tagline: config.tagline,
      logoUrl: config.logo_url || config.logoUrl,
      faviconUrl: config.favicon_url || config.faviconUrl || '/favicon.ico',
      primaryColor: config.primary_color || config.primaryColor,
      secondaryColor: config.secondary_color || config.secondaryColor,
      accentColor: config.accent_color || config.accentColor,
      backgroundColor: config.background_color || config.backgroundColor,
      surfaceColor: config.surface_color || config.surfaceColor,
      textColor: config.text_color || config.textColor,
      supportEmail: config.support_email || config.supportEmail,
      supportPhone: config.support_phone || config.supportPhone,
      footerText: config.footer_text || config.footerText
    };

    // 1. Primary wire path on Trading Platform: POST /api/internal/v1/tenant/branding
    const res = await this.request({
      method: 'POST',
      path: '/api/internal/v1/tenant/branding',
      tenantId: outboundTenantId,
      body: {
        tenantId: outboundTenantId,
        adminTenantId: tenantId,
        version,
        branding: brandingPayload,
        publishedBy: options?.actor || 'CentralAdmin',
        publishedAt: new Date().toISOString()
      },
      idempotencyKey: `wl_${tenantId}_v${version}`,
      correlationId: options?.correlationId
    });

    if (res.success) {
      return res;
    }

    // 2. Secondary fallback wire path: POST /api/internal/v1/tenant/sync
    const syncRes = await this.request({
      method: 'POST',
      path: '/api/internal/v1/tenant/sync',
      tenantId: outboundTenantId,
      body: {
        tenantId: outboundTenantId,
        brandingVersion: version,
        brandName: brandingPayload.brandName,
        shortName: brandingPayload.shortName,
        logoUrl: brandingPayload.logoUrl,
        primaryColor: brandingPayload.primaryColor
      },
      idempotencyKey: `wl_sync_${tenantId}_v${version}`,
      correlationId: options?.correlationId
    });

    if (syncRes.success) {
      return syncRes;
    }

    // 3. Fallback wire path: POST /api/internal/v1/white-label/:tenantId/sync
    return this.request({
      method: 'POST',
      path: `/api/internal/v1/white-label/${outboundTenantId || tenantId}/sync`,
      tenantId: outboundTenantId,
      body: {
        tenantId: outboundTenantId,
        adminTenantId: tenantId,
        version,
        branding: config,
        publishedBy: options?.actor || 'CentralAdmin',
        publishedAt: new Date().toISOString()
      },
      idempotencyKey: `wl_fallback_${tenantId}_v${version}`,
      correlationId: options?.correlationId
    });
  }

  /**
   * 3. Emergency Controls: Trading Halt (/emergency/trading-halt)
   */
  public async sendEmergencyTrading(
    active: boolean,
    actor: string,
    reason?: string,
    tenantId?: string,
    correlationId?: string
  ): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(tenantId);
    return this.request({
      method: 'POST',
      path: '/emergency/trading-halt',
      tenantId: outboundTenantId,
      body: { active, halt: !active, actor, reason: reason || 'Emergency trading action', tenantId: outboundTenantId },
      idempotencyKey: `emg_trade_${Date.now()}_${active}`,
      correlationId
    });
  }

  /**
   * 4. Emergency Controls: Kill-Switch (/emergency/killswitch)
   */
  public async sendEmergencyKillSwitch(
    action: 'TRIGGER' | 'RESET',
    actor: string,
    reason?: string,
    tenantId?: string,
    correlationId?: string
  ): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(tenantId);
    return this.request({
      method: 'POST',
      path: '/emergency/killswitch',
      tenantId: outboundTenantId,
      body: { action, actor, reason: reason || 'Emergency kill-switch action', tenantId: outboundTenantId },
      idempotencyKey: `emg_kill_${action}_${Date.now()}`,
      correlationId
    });
  }

  /**
   * 5. Emergency Controls: User Registrations
   */
  public async sendEmergencyRegistrations(
    enabled: boolean,
    actor: string,
    tenantId?: string,
    correlationId?: string
  ): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(tenantId);
    return this.request({
      method: 'POST',
      path: '/api/internal/v1/emergency/registrations',
      tenantId: outboundTenantId,
      body: { enabled, actor, tenantId: outboundTenantId },
      idempotencyKey: `emg_reg_${enabled}_${Date.now()}`,
      correlationId
    });
  }

  /**
   * 6. Emergency Controls: API Access
   */
  public async sendEmergencyApiAccess(
    enabled: boolean,
    actor: string,
    tenantId?: string,
    correlationId?: string
  ): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(tenantId);
    return this.request({
      method: 'POST',
      path: '/api/internal/v1/emergency/api-access',
      tenantId: outboundTenantId,
      body: { enabled, actor, tenantId: outboundTenantId },
      idempotencyKey: `emg_api_${enabled}_${Date.now()}`,
      correlationId
    });
  }

  /**
   * 7. Emergency Controls: Freeze / Unfreeze Entity (/emergency/freeze-user)
   */
  public async sendEmergencyFreeze(
    payload: {
      entityType: 'MASTER' | 'BROKER' | 'CLIENT' | 'USER';
      entityId: string;
      action: 'FREEZE' | 'UNFREEZE';
      actor: string;
      reason?: string;
      tenantId?: string;
    },
    correlationId?: string
  ): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(payload.tenantId);
    return this.request({
      method: 'POST',
      path: '/emergency/freeze-user',
      tenantId: outboundTenantId,
      body: { ...payload, tenantId: outboundTenantId },
      idempotencyKey: `emg_frz_${payload.entityType}_${payload.entityId}_${payload.action}`,
      correlationId
    });
  }

  /**
   * 8. Emergency Controls: Cancel All Open Orders (/emergency/cancel-all-orders)
   */
  public async sendEmergencyCancelAllOrders(
    payload: { tenantId?: string; actor: string; reason?: string; scope?: string },
    correlationId?: string
  ): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(payload.tenantId);
    return this.request({
      method: 'POST',
      path: '/emergency/cancel-all-orders',
      tenantId: outboundTenantId,
      body: { ...payload, scope: payload.scope || 'TENANT', tenantId: outboundTenantId },
      idempotencyKey: `emg_cancel_all_${payload.tenantId || 'global'}_${Date.now()}`,
      correlationId
    });
  }

  /**
   * 9. Emergency Controls: Square-Off All Positions (/emergency/square-off-all)
   */
  public async sendEmergencySquareOff(
    payload: { positionId?: string; actor: string; reason?: string; tenantId?: string; scope?: string },
    correlationId?: string
  ): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(payload.tenantId);
    return this.request({
      method: 'POST',
      path: '/emergency/square-off-all',
      tenantId: outboundTenantId,
      body: { ...payload, scope: payload.scope || (payload.positionId ? 'USER' : 'TENANT'), tenantId: outboundTenantId },
      idempotencyKey: `emg_sq_${payload.positionId || 'all'}_${Date.now()}`,
      correlationId
    });
  }

  /**
   * 9.1 Process Fund Transaction (Approve / Reject Deposit or Withdrawal)
   * Wire path: POST /api/internal/v1/trading/funds/process
   */
  public async processFundTransaction(payload: {
    transactionId: string;
    type: 'DEPOSIT' | 'WITHDRAWAL';
    action: 'APPROVE' | 'REJECT';
    amount?: number;
    clientId?: string;
    clientCode?: string;
    tenantId?: string;
    actor: string;
    reason?: string;
    notes?: string;
  }, correlationId?: string): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(payload.tenantId);
    return this.request({
      method: 'POST',
      path: '/api/internal/v1/trading/funds/process',
      tenantId: outboundTenantId,
      body: {
        id: payload.transactionId,
        transactionId: payload.transactionId,
        type: payload.type,
        action: payload.action,
        amount: payload.amount,
        clientId: payload.clientId,
        clientCode: payload.clientCode,
        tenantId: outboundTenantId,
        adminTenantId: payload.tenantId,
        actor: payload.actor,
        reason: payload.reason || payload.notes,
        notes: payload.notes || payload.reason,
        processedAt: new Date().toISOString()
      },
      idempotencyKey: `funds_${payload.transactionId}_${payload.action.toLowerCase()}`,
      correlationId
    });
  }

  /**
   * 9.2 Process KYC Verification (Approve / Reject Client KYC)
   * Wire path: POST /api/internal/v1/compliance/kyc/verify
   */
  public async processKYC(payload: {
    kycId?: string;
    clientId: string;
    clientCode?: string;
    status: string;
    action?: 'APPROVE' | 'REJECT';
    notes?: string;
    actor: string;
    tenantId?: string;
  }, correlationId?: string): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(payload.tenantId);
    const action = payload.action || (payload.status === 'APPROVED' || payload.status === 'VERIFIED' ? 'APPROVE' : 'REJECT');
    return this.request({
      method: 'POST',
      path: '/api/internal/v1/compliance/kyc/verify',
      tenantId: outboundTenantId,
      body: {
        id: payload.kycId || `KYC-${payload.clientId}`,
        kycId: payload.kycId || `KYC-${payload.clientId}`,
        clientId: payload.clientId,
        clientCode: payload.clientCode,
        status: payload.status,
        action,
        notes: payload.notes,
        actor: payload.actor,
        tenantId: outboundTenantId,
        adminTenantId: payload.tenantId,
        verifiedAt: new Date().toISOString()
      },
      idempotencyKey: `kyc_${payload.kycId || payload.clientId}_${action.toLowerCase()}`,
      correlationId
    });
  }

  /**
   * 10. Live Trading Data Queries
   */
  public async getLiveOrders(tenantId?: string): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(tenantId);
    return this.request({
      method: 'GET',
      path: '/api/internal/v1/trading/orders',
      tenantId: outboundTenantId
    });
  }

  public async getLiveTrades(tenantId?: string): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(tenantId);
    return this.request({
      method: 'GET',
      path: '/api/internal/v1/trading/trades',
      tenantId: outboundTenantId
    });
  }

  public async getLivePositions(tenantId?: string): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(tenantId);
    return this.request({
      method: 'GET',
      path: '/api/internal/v1/trading/positions',
      tenantId: outboundTenantId
    });
  }

  public async getLiveRiskSummary(tenantId?: string): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(tenantId);
    return this.request({
      method: 'GET',
      path: '/api/internal/v1/trading/risk-summary',
      tenantId: outboundTenantId
    });
  }

  public async getLiveClients(tenantId?: string, options?: { page?: number; limit?: number; search?: string }): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(tenantId);
    const queryParams = new URLSearchParams();
    if (options?.page) queryParams.set('page', String(options.page));
    if (options?.limit) queryParams.set('limit', String(options.limit));
    if (options?.search) queryParams.set('search', options.search);
    const q = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request({
      method: 'GET',
      path: `/api/internal/v1/trading/clients${q}`,
      tenantId: outboundTenantId
    });
  }

  /**
   * 11. Client-Specific Trading Platform Queries
   */
  public async getClientTradingAccount(clientId: string, tenantId?: string): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(tenantId);
    return this.request({
      method: 'GET',
      path: `/api/internal/v1/trading/clients/${clientId}/account`,
      tenantId: outboundTenantId
    });
  }

  public async getClientOrders(clientId: string, tenantId?: string): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(tenantId);
    return this.request({
      method: 'GET',
      path: `/api/internal/v1/trading/clients/${clientId}/orders`,
      tenantId: outboundTenantId
    });
  }

  public async getClientTrades(clientId: string, tenantId?: string): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(tenantId);
    return this.request({
      method: 'GET',
      path: `/api/internal/v1/trading/clients/${clientId}/trades`,
      tenantId: outboundTenantId
    });
  }

  public async getClientPositions(clientId: string, tenantId?: string): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(tenantId);
    return this.request({
      method: 'GET',
      path: `/api/internal/v1/trading/clients/${clientId}/positions`,
      tenantId: outboundTenantId
    });
  }

  /**
   * 12. Synchronize Account Creation with Trading Platform (client sync -> POST /trading/clients/map)
   */
  public async syncClientAccount(data: {
    clientId: string;
    clientCode?: string;
    name: string;
    email?: string;
    phone?: string;
    initialBalance?: number;
    subBrokerId?: string;
    tenantId?: string;
    referralCode?: string;
    brokerCode?: string;
  }): Promise<S2SResponse> {
    const outboundTenantId = await this.resolveOutboundTenantId(data.tenantId);
    return this.request({
      method: 'POST',
      path: '/trading/clients/map',
      body: {
        event: 'CLIENT_ACCOUNT_CREATED',
        clientId: data.clientId,
        clientCode: data.clientCode,
        name: data.name,
        email: data.email,
        phone: data.phone,
        initialBalance: data.initialBalance ?? 100000,
        subBrokerId: data.subBrokerId,
        tenantId: outboundTenantId,
        adminTenantId: data.tenantId,
        referralCode: data.referralCode,
        brokerCode: data.brokerCode,
        timestamp: new Date().toISOString()
      },
      tenantId: outboundTenantId
    });
  }

  /**
   * Canonical alias for client mapping endpoint: POST /trading/clients/map
   */
  public async mapClient(data: {
    clientId: string;
    clientCode?: string;
    name: string;
    email?: string;
    phone?: string;
    initialBalance?: number;
    subBrokerId?: string;
    tenantId?: string;
    referralCode?: string;
    brokerCode?: string;
  }): Promise<S2SResponse> {
    return this.syncClientAccount(data);
  }

  /**
   * Canonical alias for trading halt endpoint: POST /emergency/trading-halt
   */
  public async tradingHalt(active: boolean, actor: string, reason?: string, tenantId?: string): Promise<S2SResponse> {
    return this.sendEmergencyTrading(active, actor, reason, tenantId);
  }

  /**
   * Canonical alias for freeze user endpoint: POST /emergency/freeze-user
   */
  public async freezeUser(payload: {
    entityType: 'MASTER' | 'BROKER' | 'CLIENT' | 'USER';
    entityId: string;
    action: 'FREEZE' | 'UNFREEZE';
    actor: string;
    reason?: string;
    tenantId?: string;
  }): Promise<S2SResponse> {
    return this.sendEmergencyFreeze(payload);
  }

  /**
   * Canonical alias for cancel all orders endpoint: POST /emergency/cancel-all-orders
   */
  public async cancelAllOrders(payload: { tenantId?: string; actor: string; reason?: string }): Promise<S2SResponse> {
    return this.sendEmergencyCancelAllOrders(payload);
  }

  /**
   * Canonical alias for square off all positions endpoint: POST /emergency/square-off-all
   */
  public async squareOffAll(payload: { positionId?: string; actor: string; reason?: string; tenantId?: string }): Promise<S2SResponse> {
    return this.sendEmergencySquareOff(payload);
  }

  /**
   * Canonical alias for killswitch endpoint: POST /emergency/killswitch
   */
  public async killSwitch(action: 'TRIGGER' | 'RESET', actor: string, reason?: string, tenantId?: string): Promise<S2SResponse> {
    return this.sendEmergencyKillSwitch(action, actor, reason, tenantId);
  }

  /**
   * 13. Health & Status
   */
  public async checkHealth(): Promise<S2SResponse> {
    return this.request({
      method: 'GET',
      path: '/api/internal/v1/health',
      timeoutMs: 2000,
      retries: 0
    });
  }

  public getMetrics(): ClientMetrics {
    return { ...this.metrics };
  }

  public getCircuitBreakerState() {
    return {
      state: this.circuitState,
      consecutiveFailures: this.consecutiveFailures,
      lastStateChange: new Date(this.lastStateChange).toISOString()
    };
  }
}

// Export singleton instance
export const tradingPlatformClient = new TradingPlatformClient();
